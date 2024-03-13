const fetch = require("node-fetch")
const http = require('http')
const cookies = JSON.parse(process.env.cookies)

async function refreshUsers() {
    console.debug("Refreshing online users..")
    for (let cookie of cookies) {
        //use studio url as that counts as Online i think
        fetch("https://assetgame.roblox.com/Game/ClientPresence.ashx?version=old&PlaceID=10709056285&LocationType=Studio",
        {headers:{"User-Agent":"RobloxStudio/WinInet RobloxApp/0.616.0.6160659 (GlobalDist; RobloxDirectDownload)",Cookie:".ROBLOXSECURITY="+cookie},credentials:"include"}
        )

        fetch("https://users.roblox.com/v1/users/authenticated",
        {headers:{"User-Agent":"RobloxStudio/WinInet RobloxApp/0.616.0.6160659 (GlobalDist; RobloxDirectDownload)",Cookie:".ROBLOXSECURITY="+cookie},credentials:"include"}
        ).then(res=>res.text().then(console.debug))
    }
}
setInterval(refreshUsers,60000)
refreshUsers()