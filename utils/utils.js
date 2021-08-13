const Discord = require("discord.js"),
  config = require("../config/config.json");

const errorLog = new Discord.WebhookClient(config.error);

const utils = {
  botSpam: function(msg) {
    if ((msg.guild?.id == config.ldsg) && (msg.channel.id != config.channels.botspam) && (msg.channel.parentID != "363020585988653057") && (msg.channel.id != "209046676781006849")) {
      msg.reply(`I've placed your results in <#${config.channels.botspam}> to keep things nice and tidy in here. Hurry before they get cold!`)
        .then(Utils.clean);
      return msg.guild.channels.cache.get(config.channels.botspam);
    } else return msg.channel;
  },
  clean: async function(msg, t = 20000) {
    await utils.wait(t);
    if (msg.deletable && !msg.deleted) {
      msg.delete().catch(utils.noop);
    }
    return Promise.resolve(msg);
  },
  cleanInteraction: async function(interaction, t = 2000) {
    await utils.wait(t);
    interaction.deleteReply();
  },
  Collection: Discord.Collection,
  embed: function(data) {
    const embed = new Discord.MessageEmbed(data);
    if (!data?.color) embed.setColor(config.color);
    if (!data?.timestamp) embed.setTimestamp();
    return embed;
  },
  errorHandler: function(error, message = null) {
    if (!error || (error.name == "AbortError")) return;

    console.error(Date());

    let embed = utils.embed().setTitle(error.name);

    if ((message instanceof Discord.Message) || (message instanceof Discord.Interaction)) {
      let loc = (message.guild ? `${message.guild.name} > ${message.channel.name}` : "DM");
      console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

      message.channel.send("I've run into an error. I've let my devs know.")
        .then(utils.clean);
      embed.addField("User", message.author.username, true)
        .addField("Location", loc, true)
        .addField("Command", message.cleanContent || "`undefined`", true);
    } else if (message instanceof Discord.Interaction) {
      let loc = (message.guild ? `${message.guild.name} > ${message.channel.name}` : "DM");
      console.error(`Interaction by ${message.user.username} in ${loc}`);

      interaction.reply("I've run into an error. I've let my devs know.").then(async () => {
        await utils.wait(20000);
        interaction.deleteReply();
      });
      embed.addField("User", message.user.username, true)
        .addField("Location", loc, true)
        .addField("Interaction", interaction.commandId || interaction.customId || "`undefined`", true);
    } else if (typeof message === "string") {
      console.error(message);
      embed.addField("Message", message);
    }

    console.trace(error);

    let stack = (error.stack ? error.stack : error.toString());
    if (stack.length > 4096) stack = stack.slice(0, 4000);

    embed.setDescription(stack);
    errorLog.send({embeds: [embed]});
  },
  errorLog,
  noop: () => {},
  parse: (msg, clean = false) => {
    for (let prefix of [config.prefix, `<@${msg.client.user.id}>`, `<@!${msg.client.user.id}>`]) {
      let content = clean ? msg.cleanContent : msg.content;
      if (!content.startsWith(prefix)) continue;
      let trimmed = content.substr(prefix.length).trim();
      let [command, ...params] = trimmed.split(" ");
      if (command) {
        let suffix = params.join(" ");
        if (suffix.toLowerCase() == "help") {  // Allow `!command help` syntax
          let t = command.toLowerCase();
          command = "help";
          suffix = t;
          params = t.split(" ");
        }
        return {
          command: command.toLowerCase(),
          suffix,
          params
        };
      }
    }
    return null;
  },
  wait: function(t) {
    return new Promise((fulfill, reject) => {
      setTimeout(fulfill, t);
    });
  }
};

module.exports = utils;
