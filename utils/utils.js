const Discord = require("discord.js"),
  config = require("../config/config.json");

const errorLog = new Discord.WebhookClient(config.error);

const utils = {
  /**
   * If a command is run in a channel that doesn't want spam, returns #bot-lobby so results can be posted there.
   * @param {Discord.Message} msg The Discord message to check for bot spam.
   */
  botSpam: function (msg) {
    if (msg.guild?.id === config.ldsg && // Not in server
      msg.channel.id !== config.channel.botspam && // In bot-lobby
      msg.channel.id !== config.channel.gai && // In Gai's channel
      msg.channel.parentID !== config.categories.moderation) { // In the moderation category

      msg.reply(`I've placed your results in <#${config.channels.botspam}> to keep things nice and tidy in here. Hurry before they get cold!`)
        .then(Utils.clean);
      return msg.guild.channels.cache.get(config.channels.botspam);
    } else {
      return msg.channel;
    }
  },
  /**
   * After the given amount of time, attempts to delete the message.
   * @param {Discord.Message} msg The message to delete.
   * @param {number} t The length of time to wait before deletion, in milliseconds.
   */
  clean: async function(msg, t = 20000) {
    await utils.wait(t);
    if (msg.deletable && !msg.deleted) {
      msg.delete().catch(utils.noop);
    }
    return Promise.resolve(msg);
  },
  /**
   * After the given amount of time, attempts to delete the interaction.
   * @param {Discord.Interaction} interaction The interaction to delete.
   * @param {number} t The length of time to wait before deletion, in milliseconds.
   */
  cleanInteraction: async function(interaction, t = 2000) {
    await utils.wait(t);
    interaction.deleteReply();
  },
  Collection: Discord.Collection,
  /**
   * Returns a MessageEmbed with basic values preset, such as color and timestamp.
   * @param {any} data The data object to pass to the MessageEmbed constructor. 
   *   You can override the color and timestamp here as well.
   */
  embed: function(data) {
    const embed = new Discord.MessageEmbed(data);
    if (!data?.color) embed.setColor(config.color);
    if (!data?.timestamp) embed.setTimestamp();
    return embed;
  },
  /**
   * Handles a command exception/error. Most likely called from a catch.
   * Reports the error and lets the user know.
   * @param {Error} error The error to report.
   * @param {Discord.Message} message
   */
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
  /**
   * This task is extremely complicated. 
   * You need to understand it perfectly to use it.
   * It took millenia to perfect, and will take millenia
   * more to understand, even for scholars.
   * 
   * It does literally nothing.
   * */
  noop: () => { },
  /**
   * Returns an object containing the command, suffix, and params of the message.
   * @param {Discord.Message} msg The message to get command info from.
   * @param {boolean} clean Whether to use the messages cleanContent or normal content. Defaults to false.
   */
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
  /**
   * Returns a promise that will fulfill after the given amount of time.
   * If awaited, will block for the given amount of time.
   * @param {number} t The time to wait, in milliseconds.
   */
  wait: function(t) {
    return new Promise((fulfill, reject) => {
      setTimeout(fulfill, t);
    });
  }
};

module.exports = utils;
