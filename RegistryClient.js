const config = require("./config/config.json");
const Client = require("discord.js").Client;

const client = new Discord.Client();

client.on("ready", () => {
  console.log(`Application Command Manager for ${client.user.username} is ready!`);
})
.login(config.token);

module.exports = client.application.commands;
