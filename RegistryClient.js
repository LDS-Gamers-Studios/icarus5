const config = require("./config/config.json");
const Discord = require("discord.js");

const client = new Discord.Client({
  intents: 0
});

const package = {client};

client.on("ready", () => {
  console.log(`Client for ${client.user.username} is ready!`);
  package.commandManager = client.application.commands;
})
.login(config.token);

module.exports = package;
