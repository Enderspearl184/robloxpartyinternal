const fetch = require("node-fetch")
const http = require('http')
const cookies = JSON.parse(process.env.cookies)

setInterval(async function() {
    console.debug("Refreshing online users..")
    for (let cookie of cookies) {
        //use studio url as that counts as Online i think
        fetch("https://assetgame.roblox.com/Game/ClientPresence.ashx?version=old&PlaceID=10709056285&LocationType=Studio",{headers:{Cookie:".ROBLOXSECURITY="+cookie},credentials:"include"})
    }
},60000)