const fetch = require("node-fetch")
const http = require('http')
const cookies = JSON.parse(process.env.cookies)

setInterval(async function() {
    console.debug("Refreshing online users..")
    for (let cookie of cookies) {
        fetch("https://www.roblox.com/home",{headers:{Cookie:".ROBLOXSECURITY="+cookie},credentials:"include"})
    }
},60000)