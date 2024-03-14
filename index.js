const fetch = require("node-fetch")
const http = require('http')
const cookies = JSON.parse(process.env.cookies)
const debugRejoinConversations=false
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
                opts.headers = opts.headers || []
                opts.headers["x-csrf-token"]=xsrf
                //Retry request with the new xsrf header
                fetch(url,opts).then(async(response)=>{
                    resolve(response)
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
                                body:JSON.stringify({
                                    "participantUserId": 150264850,
                                    "conversationId": 27615384184
                                })
                            }
                            }
                            )   
                        )
                    }
                    let res = await Promise.all(leavePromises)
                    for (let response of res) {
                        response.text().then(console.debug)
                    }
                } else {
                    console.error("no user id? not authenticated??")
                }
            }
        }))
    }
}
setInterval(refreshUsers,60000)
refreshUsers(forceReset)