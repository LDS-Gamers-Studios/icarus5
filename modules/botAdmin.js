// This file is a place for all the publicly visible bot diagnostic commands usable primarily only by the head bot dev.

const Augur = require("augurbot"),
  u = require("../utils/utils");

const Module = new Augur.Module()
.addCommand({ name: "gotobed",
  description: "The gotobed command shuts down the bot. This is good for a quick test for things !reload doesn't cover.", // It is reccomended to be used in conjunction with forever.js so the bot automatically restarts
  category: "Bot Admin",
  hidden: true,
  aliases: ["q", "restart"],
  process: async function(msg) {
    try {
      await msg.react("🛏");
      await msg.client.destroy();
      process.exit();
    } catch (e) { u.errorHandler(e, msg); }
  },
  permissions: (msg) => Module.config.adminId.includes(msg.author.id)
})
.addCommand({ name: "ping",
  category: "Bot Admin",
  description: "Gets the current total ping time for the bot.",
  hidden: true,
  permissions: (msg) => (msg.author.id === Module.config.ownerId) || msg.member?.roles.cache.some(r => [Module.config.roles.mod, Module.config.roles.management, Module.config.roles.team].includes(r.id)),
  process: async (msg) => {
    const sent = await msg.reply({ content: 'Pinging...', allowedMentions: { repliedUser: false } });
    sent.edit({ content: `Pong! Took ${sent.createdTimestamp - (msg.editedTimestamp ? msg.editedTimestamp : msg.createdTimestamp)}ms`, allowedMentions: { repliedUser: false } });
  }
})
.addCommand({ name: "pull",
  category: "Bot Admin",
  description: "Pull bot updates from git",
  hidden: true,
  process: (msg) => {
    const spawn = require("child_process").spawn;

    u.clean(msg);

    const cmd = spawn("git", ["pull"], { cwd: process.cwd() });
    const stdout = [];
    const stderr = [];

    cmd.stdout.on("data", data => {
      stdout.push(data);
    });

    cmd.stderr.on("data", data => {
      stderr.push(data);
    });

    cmd.on("close", code => {
      if (code == 0) {
        msg.channel.send(stdout.join("\n") + "\n\nCompleted with code: " + code).then(u.clean);
      } else {
        msg.channel.send(`ERROR CODE ${code}:\n${stderr.join("\n")}`).then(u.clean);
      }
    });
  },
  permissions: (msg) => (Module.config.ownerId === (msg.author.id))
})
.addCommand({ name: "pulse",
  category: "Bot Admin",
  hidden: true,
  description: "The pulse command get basic information about the bot's current health and uptime for each shard (if applicable).",
  permissions: (msg) => (Module.config.ownerId === msg.author.id),
  process: async function(msg) {
    try {
      const client = msg.client;

      const embed = u.embed()
      .setAuthor(client.user.username + " Heartbeat", client.user.displayAvatarURL())
      .setTimestamp();

      if (client.shard) {
        let guilds = await client.shard.fetchClientValues('guilds.cache.size');
        guilds = guilds.reduce((prev, val) => prev + val, 0);
        let channels = client.shard.fetchClientValues('channels.cache.size');
        channels = channels.reduce((prev, val) => prev + val, 0);
        let mem = client.shard.broadcastEval("Math.round(process.memoryUsage().rss / 1024 / 1000)");
        mem = mem.reduce((t, c) => t + c);
        embed
        .addField("Shards", `Id: ${client.shard.id}\n(${client.shard.count} total)`, true)
        .addField("Total Bot Reach", `${guilds} Servers\n${channels} Channels`, true)
        .addField("Shard Uptime", `${Math.floor(client.uptime / (24 * 60 * 60 * 1000))} days, ${Math.floor(client.uptime / (60 * 60 * 1000)) % 24} hours, ${Math.floor(client.uptime / (60 * 1000)) % 60} minutes`, true)
        .addField("Shard Commands Used", `${client.commands.commandCount} (${(client.commands.commandCount / (client.uptime / (60 * 1000))).toFixed(2)}/min)`, true)
        .addField("Total Memory", `${mem}MB`, true);

        msg.channel.send({ embeds: [embed] });
      } else {
        const uptime = process.uptime();
        embed
        .addField("Uptime", `Discord: ${Math.floor(client.uptime / (24 * 60 * 60 * 1000))} days, ${Math.floor(client.uptime / (60 * 60 * 1000)) % 24} hours, ${Math.floor(client.uptime / (60 * 1000)) % 60} minutes\nProcess: ${Math.floor(uptime / (24 * 60 * 60))} days, ${Math.floor(uptime / (60 * 60)) % 24} hours, ${Math.floor(uptime / (60)) % 60} minutes`, true)
        .addField("Reach", `${client.guilds.cache.size} Servers\n${client.channels.cache.size} Channels\n${client.users.cache.size} Users`, true)
        .addField("Commands Used", `${client.commands.commandCount} (${(client.commands.commandCount / (client.uptime / (60 * 1000))).toFixed(2)}/min)`, true)
        .addField("Memory", `${Math.round(process.memoryUsage().rss / 1024 / 1000)}MB`, true);

        msg.channel.send({ embeds: [embed] });
      }
    } catch (e) { u.errorHandler(e, msg); }
  }
})
.addCommand({ name: "reload",
  category: "Bot Admin",
  hidden: true,
  syntax: "[file1.js] [file2.js]",
  description: "This command reloads one or more modules. Good for loading in small fixes.",
  info: "Use the command without a suffix to reload all command files.\n\nUse the command with the module name (including the `.js`) to reload a specific file.",
  parseParams: true,
  process: (msg, ...files) => {
    u.clean(msg);
    const fs = require("fs"),
      path = require("path");
    if (files.length === 0) files = fs.readdirSync(path.resolve(__dirname)).filter(file => file.endsWith(".js"));

    for (const file of files) {
      try {
        msg.client.moduleHandler.reload(path.resolve(__dirname, file));
      } catch (error) { msg.client.errorHandler(error, msg); }
    }
    msg.react("👌").catch(u.noop);
  },
  permissions: (msg) => Module.config.adminId.includes(msg.author.id)
})
// When the bot is fully online, fetch all the ldsg members, since it will only autofetch for small servers and we want them all.
.addEvent("ready", () => {
  Module.client.guilds.cache.get(Module.config.ldsg).members.fetch();
})
// Each time this module is loaded, update the module.config snowflakes.
.setInit(async (reload) => {
  try {
    if (!reload) {
      u.errorLog.send({ embeds: [ u.embed().setDescription("Bot is ready!") ] });
    }
    const snowflakes = require("../config/snowflakes.json");
    Module.config.channels = snowflakes.channels;
    Module.config.roles = snowflakes.roles;
  } catch (e) {
    u.errorHandler(e, "Error in botAdmin.setInit.");
  }
})
.setUnload(() => true);

module.exports = Module;
