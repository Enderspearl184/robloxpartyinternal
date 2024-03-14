const fetch = require("node-fetch")
const http = require('http')
const fs = require('fs')

//read from Render environment secret or from a .gitignore-ed file :)
const cookies = JSON.parse(process.env.cookies || fs.readFileSync('cookies.txt',"utf8"))
const debugRejoinConversations=true

const conversations=[
    {id:27615296457,playerCount:2},
    {id:27615313032,playerCount:3},
    {id:27615343718,playerCount:4},
    {id:27615350481,playerCount:5},
    {id:27615364149,playerCount:6},
    {id:27615368528,playerCount:7},
    {id:27615377279,playerCount:8},
    {id:27615380761,playerCount:9},
    {id:27615384184,playerCount:10},
]

//wrapper function to perform a request that needs an xsrf token
function XsrfRequest(url,opts) {
    return new Promise(async(resolve,reject)=>{
        fetch(url,opts).then(async(response)=>{
            //if xsrf token is returned then retry with it
            //otherwise, just resolve with the Response
            let xsrf = response.headers.get("x-csrf-token")
            if (response.headers.get("x-csrf-token")) {
                opts.headers["x-csrf-token"]=xsrf
                //Retry request with the new xsrf header
                fetch(url,opts).then(async(res)=>{
                    resolve(res)
                },reject)
            } else {
                resolve(response)
            }
        },reject)
    })
}

async function refreshUsers(forceReset) {
    console.debug("Refreshing online users..")
    for (let cookie of cookies) {
        //use studio url as that counts as Online i think
        fetch("https://assetgame.roblox.com/Game/ClientPresence.ashx?version=old&PlaceID=10709056285&LocationType=Studio",{headers:{"User-Agent":"RobloxStudio/WinInet",Cookie:`.ROBLOSECURITY=${cookie.cookie}`}})

        //rejoin all conversations debug
        fetch("https://users.roblox.com/v1/users/authenticated",
        {headers:{Cookie:`.ROBLOSECURITY=${cookie.cookie}`}}
        ).then(res=>res.json().then(async(json)=>{
            //this gets your user id
            if (forceReset) {
                let userId = json.id
                if (userId) {
                    //leave all conversations
                    let leavePromises=[]
                    for (let conversation of conversations) {
                        leavePromises.push(
                            XsrfRequest(
                            "https://chat.roblox.com/v2/remove-from-conversation",
                            {
                            method:"POST",
                            headers:
                            {
                                "Content-Type":"application/json",
                                Cookie:`.ROBLOSECURITY=${cookie.cookie}`,
                            },
                            body:JSON.stringify({
                                "participantUserId": userId,
                                "conversationId": conversation.id
                            })
                            }
                            )   
                        )
                    }
                    await Promise.all(leavePromises)
                    let joinPromises = []
                    for (let conversation of conversations) {
                        if (conversation.playerCount>=cookie.playerId) {
                            //console.log(conversation.playerCount,cookie.playerId)
                            joinPromises.push(
                                XsrfRequest(
                                    "https://chat.roblox.com/v2/add-to-conversation",
                                    {
                                    method:"POST",
                                    headers:
                                    {
                                        "Content-Type":"application/json",
                                        Cookie:`.ROBLOSECURITY=${cookie.cookie}`,
                                    },
                                    body:JSON.stringify({
                                        "participantUserIds": [
                                            userId
                                        ],
                                        "conversationId": conversation.id
                                    })
                                    }
                                    ) 
                            )
                        }
                    }
                    let res = await Promise.all(joinPromises)
                    console.log("Reset conversations!")
                } else {
                    console.error("no user id? not authenticated??")
                }
            }
        }))
    }
}
setInterval(refreshUsers,60000)
refreshUsers(debugRejoinConversations)

http.createServer(function(req,res) {
    console.log(req.url)
    if (req.url=="/") {
        res.writeHead(200)
        res.end(fs.readFileSync('./base.html','utf8'))
        return
    } else if (req.url=="/main.js") {
        res.writeHead(200)
        res.end(fs.readFileSync('./main.js','utf8'))
    }
}).listen(80)