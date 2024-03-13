const fetch = require("node-fetch")
const http = require('http')
const cookies = JSON.parse(process.env.cookies)

setInterval(async function() {
    for (let cookie of cookies) {
        fetch("https://www.roblox.com/home",{headers:{cookie:".ROBLOXSECURITY="+cookie}})
    }
},60000)