const fetch = require("node-fetch")
const http = require('http')
const fs = require('fs')
const querystring = require('node:querystring'); 
const crypto = require("node:crypto")
const sleep = ms => new Promise(r => setTimeout(r, ms))

//read from Render environment secret or from a .gitignore-ed file :)
const cookies = JSON.parse(process.env.cookies || fs.readFileSync('cookies.txt',"utf8"))
const UniverseId=5751895759
const conversationsCreateLimit=100
const minPlayerCount=2
const maxPlayerCount=cookies.length

/*
const conversations=[
    {id:27615296457,playerCount:2},
    {id:27615296457,playerCount:6},
    {id:27615313032,playerCount:3},
    {id:27615343718,playerCount:4},
    {id:27615350481,playerCount:5},
    {id:27615364149,playerCount:6},
    {id:27615368528,playerCount:7},
    {id:27615377279,playerCount:8},
    {id:27615380761,playerCount:9},
    {id:27615384184,playerCount:10},
]
*/
//conversations
/*
each will be
{id:CONVERSATIONID,usedInPlaces:[],locked:false}
usedInPlaces is the places that have been used, we then ignore it for two minutes so the jobid dies and it creates a new one
locked just means its being used rn to request a server and not to mess with the conversation until thats finished
*/
var conversations;
//wrapper function to perform a request that needs an xsrf token
function XsrfRequest(url,opts) {
    return new Promise(async(resolve,reject)=>{
        fetch(url,opts).then(async(response)=>{
            //if xsrf token is returned then retry with it
            //otherwise, just resolve with the Response
            let xsrf = response.headers.get("x-csrf-token")
            if (response.headers.get("x-csrf-token")) {
                opts.headers = opts.headers || {}
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

async function refreshUsers() {
    console.log("Refreshing online users..")
    for (let cookie of cookies) {
        //use studio url as that counts as Online i think
        fetch("https://assetgame.roblox.com/Game/ClientPresence.ashx?version=old&PlaceID=10709056285&LocationType=Studio",{headers:{"User-Agent":"RobloxStudio/WinInet",Cookie:`.ROBLOSECURITY=${cookie}`}})
    }
}
setInterval(refreshUsers,60000)

function resetConversations(convs) {
    let promises = []
    for (let cookie of cookies) {
        //rejoin all conversations debug
        promises.push(fetch("https://users.roblox.com/v1/users/authenticated",
        {headers:{Cookie:`.ROBLOSECURITY=${cookie}`}}
        ).then(res=>res.json().then(async(json)=>{
            //this gets your user id
            let userId = json.id
            if (userId) {
                //leave all conversations
                let leavePromises=[]
                for (let conversation of convs) {
                    leavePromises.push(
                        XsrfRequest(
                        "https://chat.roblox.com/v2/remove-from-conversation",
                        {
                        method:"POST",
                        headers:
                        {
                            "Content-Type":"application/json",
                            Cookie:`.ROBLOSECURITY=${cookie}`,
                        },
                        body:JSON.stringify({
                            "participantUserId": userId,
                            "conversationId": conversation
                        })
                        }
                        )   
                    )
                }
                await Promise.all(leavePromises)
                //console.log('reset for this cookie')
                return
            } else {
                console.error("no user id? not authenticated??")
                return
            }
        })))
    }
    return Promise.all(promises)
}

function setupConversation(conversation,slotsRequested) {
    let id = conversation.id
    let cookiestouse = cookies.sort(() => 0.5 - Math.random()).slice(0,slotsRequested)
    conversation.cookies=cookiestouse
    console.log(cookiestouse[0]==cookies[0])
    let promises = []
    for (let cookie of cookiestouse) {
        //rejoin all conversations debug
        promises.push(fetch("https://users.roblox.com/v1/users/authenticated",
        {headers:{Cookie:`.ROBLOSECURITY=${cookie}`}}
        ).then(res=>res.json().then(async(json)=>{
            //this gets your user id
            let userId = json.id
            if (userId) {
                await XsrfRequest(
                "https://chat.roblox.com/v2/add-to-conversation",
                {
                method:"POST",
                headers:
                {
                    "Content-Type":"application/json",
                    Cookie:`.ROBLOSECURITY=${cookie}`,
                },
                body:JSON.stringify({
                    "participantUserIds": [
                        userId
                    ],
                        "conversationId": id
                    })
                }
                )
                return
            } else {
                console.error("no user id? not authenticated??")
                return
            }
        })))
    }
    return Promise.all(promises)
}

http.createServer(async function(req,res) {
    let query = querystring.decode(req.url.split("?")[1])
    req.url = req.url.split("?")[0]
    console.log(req.url,query)
    //return the basic html and js files when requested
    if (req.url=="/") {
        res.writeHead(200)
        res.end(fs.readFileSync('./base.html','utf8'))
        return
    } else if (req.url=="/main.js") {
        res.writeHead(200)
        res.end(fs.readFileSync('./main.js','utf8'))
    } else if (req.url=="/requestServer") {
        //?placeId=245324245 is needed
        //also if the server is setting up, then the conversations might be in invalid states, dont mess with them
        if (isFinite(parseInt(query.placeId))) {
            if (!conversations) {
                res.writeHead(500)
                res.end(JSON.stringify({
                    success:false,
                    error:"we're still setting up! wait a little seconds before requesting another server."
                }))
                return
            } else {
                let game = await (await fetch(`https://games.roblox.com/v1/games/multiget-place-details?placeIds=${query.placeId}`,{headers:{cookie:`.ROBLOSECURITY=${cookies[0]}`}})).json()
                //console.log(game)
                game = game[0]
                if (game?.placeId!==game?.universeRootPlaceId) {
                    res.writeHead(400)
                    res.end(JSON.stringify({
                        success:false,
                        error:"You will not be able to join this place as it either does not have a Universe, it is not the root place of its Universe, or it just doesn't exist."
                    }))
                    return
                }
                let universe = await (await fetch(`https://games.roblox.com/v1/games?universeIds=${game.universeId}`,{headers:{cookie:`.ROBLOSECURITY=${cookies[0]}`}})).json()
                //console.log(universe)
                universe = universe?.data[0]
                let slotsRequested=universe.maxPlayers
                if (slotsRequested>maxPlayerCount || slotsRequested<minPlayerCount) {
                    //slotsRequested=maxPlayerCount
                    res.writeHead(400)
                    res.end(JSON.stringify({
                        success:false,
                        error:`You are trying to join a game with too many or too few max players! bounds: ${minPlayerCount}-${maxPlayerCount}`
                    }))
                    return
                }
                let conversation = conversations.find(conv=>(!conv.locked && !conv.usedInPlaces.has(query.placeId)))
                if (conversation) {
                    try {
                        //console.log(conversation)
                        conversation.locked=true
                        await setupConversation(conversation,slotsRequested)
                        //spin the gamejoin api until it works!!
                        
                        let lastStatus = 0
                        let jobId=""
                        let attempt = crypto.randomUUID()
                        while (lastStatus==0) {
                            try {
                                let res = await XsrfRequest("https://gamejoin.roblox.com/v1/join-play-together-game",
                                {
                                    method:"POST",
                                    headers:{
                                        "content-type":"application/json",
                                        "user-agent":"Roblox/WinInet",
                                        cookie:`.ROBLOSECURITY=${conversation.cookies[0]}`
                                    },
                                    body:JSON.stringify({
                                        "conversationId": conversation.id,
                                        "gameJoinAttemptId": attempt,
                                        "placeId": parseInt(query.placeId),
                                        "isPartyLeader":true
                                    })
                                })
                                if (res.status==200) {
                                    let json = await res.json()
                                    //console.log(json)
                                    lastStatus = json.status
                                    jobId=json.jobId
                                    if (!json.jobId) {
                                        await sleep(500)
                                    }
                                } else {
                                    await sleep(500)
                                }
                            } catch (err) {
                                warn(err)
                                break;
                            }
                        }

                        if (jobId) {
                            res.writeHead(200)
                            res.end(JSON.stringify({
                                success:true,
                                jobId:jobId
                            }))
                        } else {
                            res.writeHead(500)
                            res.end(JSON.stringify({
                                success:false,
                                error:"unable to get job id for some weird reason? what happened??"
                            }))
                        }
                    } catch (err) {console.warn(err)}
                    //unlock the conversation afterwards!
                    await resetConversations([conversation.id])
                    conversation.locked=false
                    conversation.usedInPlaces.add(query.placeId)
                    //server dies after 2 minutes
                    setTimeout(()=>{
                        console.log("removing place id lock on conversation.")
                        conversation.usedInPlaces.delete(query.placeId)
                    },120000)
                }
            }
        } else {
            res.writeHead(400)
            res.end(JSON.stringify({
                success:false,
                error:"missing placeId in query string!"
            }))
            return
        }
    }
}).listen(80)


/*

this function is MASSIVE as it prepares all the conversations to init this

pagination on this one also
https://develop.roblox.com/v1/universes/5751895759/places?sortOrder=Asc&limit=100&cursor=
create place:
https://www.roblox.com/ide/places/createV2?templatePlaceIdToUse=95206881&universeId=5751895759 POST REQ
returns {"Success":true,"PlaceId":16738183413}
update name:
https://develop.roblox.com/v1/places/16738183413 POST REQ
{ "name": "10_1" }

*/
async function setup() {
    //paginate the place ids
    let cursor=""
    const unpreparedConversations = []
    let places=[]
    do {
        try {
            let res = await (await fetch(`https://develop.roblox.com/v1/universes/${UniverseId}/places?sortOrder=Asc&limit=100&cursor=${cursor}`)).json()
            if (res.data) {
                cursor = res.nextPageCursor
                places = places.concat(res.data)
            } else {
                console.warn(res)
            }
        } catch (err) {
            console.error(err)
        }
    } while (cursor)
    //console.log(places)
    //if the place count isnt enough, make more of them!!
    console.log("making places")
    for (let i=1;i<=conversationsCreateLimit-places.length;i++) {
        let res = await XsrfRequest(`https://www.roblox.com/ide/places/createV2?templatePlaceIdToUse=95206881&universeId=${UniverseId}`,{method:"POST",headers:{cookie:`.ROBLOSECURITY=${cookies[0]}`}})
        //console.log(res.status)
        let json = await res.json()
        //console.log(json)
        if (res.status!==200) {
            i--
            await sleep(1000)
        } else {
            places.push({id:json.PlaceId})
        }
    }
    console.log("setting up conversations")
    let conversationPromises=[]
    let conversationsToReset=[]
    for (let place of places) {
        conversationPromises.push(new Promise(async(resolve,reject)=>{
        //use the first cookie to create these conversations, we reset them later so that nothing weird happens tho xd
            let lastStatus=0
            do {
                let res = (await XsrfRequest("https://chat.roblox.com/v2/start-cloud-edit-conversation",{method:"POST",headers:{"content-type":"application/json",cookie:`.ROBLOSECURITY=${cookies[0]}`},body:JSON.stringify({
                    "placeId": place.id
                })}))
                lastStatus=res.status
                if (res.status==200) {
                    let json = await res.json()
                    //console.log(json)
                    unpreparedConversations.push({id:json.conversation.id,usedInPlaces:new Set(),locked:false})
                    if (json.conversation.participants.length) {
                        conversationsToReset.push(json.conversation.id)
                    }
                } else {
                    await sleep(1000)
                }
            } while (lastStatus!==200)
            resolve()
        }))
    }
    await Promise.all(conversationPromises)


    console.log(conversationsToReset)

    console.log("resetting conversations")
    await resetConversations(conversationsToReset)
    console.log("Reset conversations!")
    //refreshUsers(debugRejoinConversations)
    
    //now we set the global conversation variable, as they are all prepared!!
    conversations = unpreparedConversations
    refreshUsers()
}
setup()