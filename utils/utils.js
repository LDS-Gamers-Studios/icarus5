const Discord = require("discord.js"),
  config = require("../config/config.json");

const errorLog = new Discord.WebhookClient(config.error);
const { nanoid } = require("nanoid");

/**
 * @typedef {Object} ParsedInteraction
 * @property {String} command - The command issued, represented as a string.
 * @property {Array} data - Associated data for the command, such as command options or values selected.
 */

/**
 * Converts an interaction into a more universal format for error messages.
 * @param {Discord.Interaction} inter The interaction to be parsed.
 * @returns {ParsedInteraction} The interaction after it has been broken down.
 */
function parseInteraction(inter) {
  if (inter.isCommand()) {
    const commandParts = [`/${inter.commandName}`];
    let optionData = inter.options.data;
    if (optionData.length == 0) {
      return {
        command: commandParts.join(" "),
        data: optionData
      };
    }

    if (optionData[0].type == "SUB_COMMAND_GROUP") {
      commandParts.push(optionData[0].name);
      optionData = optionData[0].options;
      if (optionData.length == 0) {
        return {
          command: commandParts.join(" "),
          data: optionData
        };
      }
    }

    if (optionData[0].type == "SUB_COMMAND") {
      commandParts.push(optionData[0].name);
      optionData = optionData[0].options;
      return {
        command: commandParts.join(" "),
        data: optionData ?? []
      };
    }
  }

  if (inter.isContextMenu()) {
    return {
      command: `[Context Menu] ${inter.commandName}`,
      data: inter.options.data
    };
  }

  if (inter.isMessageComponent()) {
    const data = [{
      name: "Message",
      value: inter.message.guild ? `[Original Message](${inter.message.url})` : "(DM)"
    }];
    const command = inter.isButton() ? `[Button] ${(inter.component?.emoji?.name ?? "") + (inter.component?.label ?? "")}` : "[Select Menu]";

    if (inter.isSelectMenu()) {
      data.push({ name: "Selection", value: inter.values.join() });
    }

    return { command, data };
  }
}

const utils = {
  /**
   * If a command is run in a channel that doesn't want spam, returns #bot-lobby so results can be posted there.
   * @param {Discord.Message} msg The Discord message to check for bot spam.
   */
  botSpam: function(msg) {
    if (msg.guild?.id === config.ldsg && // Is in server
      msg.channel.id !== config.channels.botspam && // Isn't in bot-lobby
      msg.channel.id !== config.channels.bottesting && // Isn't in Bot Testing
      msg.channel.parentID !== config.channels.moderation) { // Isn't in the moderation category

      msg.reply(`I've placed your results in <#${config.channels.botspam}> to keep things nice and tidy in here. Hurry before they get cold!`)
        .then(utils.clean);
      return msg.guild.channels.cache.get(config.channels.botspam);
    } else {
      return msg.channel;
    }
  },
  /**
   * After the given amount of time, attempts to delete the message.
   * @param {Discord.Message|Discord.Interaction} msg The message to delete.
   * @param {number} t The length of time to wait before deletion, in milliseconds.
   */
  clean: async function(msg, t = 20000) {
    await utils.wait(t);
    if (msg instanceof Discord.CommandInteraction) {
      msg.deleteReply().catch(utils.noop);
    } else if ((msg instanceof Discord.Message) && msg.deletable) {
      msg.delete().catch(utils.noop);
    }
    return Promise.resolve(msg);
  },
  /**
   * After the given amount of time, attempts to delete the interaction.
   * @param {Discord.Interaction} interaction The interaction to delete.
   * @param {number} t The length of time to wait before deletion, in milliseconds.
   */
  cleanInteraction: async function(interaction, t = 20000) {
    if (interaction.ephemeral) { return; } // Can't delete ephemeral interactions.
    await utils.wait(t);
    interaction.deleteReply();
  },
  /**
   * Shortcut to Discord.Collection. See docs there for reference.
   */
  Collection: Discord.Collection,
  /**
   * Confirm Dialog
   * @function confirmInteraction
   * @param {Discord.Interaction} interaction The interaction to confirm
   * @param {String} prompt The prompt for the confirmation
   * @returns {Boolean}
   */
  confirmInteraction: async (interaction, prompt = "Are you sure?", title = "Confirmation Dialog") => {
    const reply = (interaction.deferred || interaction.replied) ? "editReply" : "reply";
    const embed = utils.embed({ author: interaction.member ?? interaction.user })
      .setColor(0xff0000)
      .setTitle(title)
      .setDescription(prompt);
    const confirmTrue = utils.customId(),
      confirmFalse = utils.customId();

    await interaction[reply]({
      embeds: [embed],
      components: [
        new Discord.MessageActionRow().addComponents(
          new Discord.MessageButton().setCustomId(confirmTrue).setEmoji("✅").setLabel("Confirm").setStyle("SUCCESS"),
          new Discord.MessageButton().setCustomId(confirmFalse).setEmoji("⛔").setLabel("Cancel").setStyle("DANGER")
        )
      ],
      ephemeral: true,
      content: null
    });

    const confirm = await interaction.channel.awaitMessageComponent({
      filter: (button) => button.user.id === interaction.member.id && (button.customId === confirmTrue || button.customId === confirmFalse),
      componentType: "BUTTON",
      time: 60000
    }).catch(() => ({ customId: "confirmTimeout" }));

    if (confirm.customId === confirmTrue) return true;
    else if (confirm.customId === confirmFalse) return false;
    else return null;
  },
  awaitDM: async (msg, user, timeout = 60) => {
    const message = await user.send({ embeds: [
      utils.embed()
      .setTitle("Awaiting Response")
      .setDescription(msg)
      .setFooter({ text: `Times out in ${timeout} seconds.` })
      .setColor("RED")
    ] });

    const collected = await message.channel.awaitMessages({
      filter: (m) => !m.content.startsWith("!") && !m.content.startsWith("/"), max: 1,
      time: timeout * 1000
    });

    const response = utils.embed()
      .setTitle("Awaited Response")
      .setColor("PURPLE");

    if (collected.size === 0) {
      await message.edit({ embeds: [
        response
        .setDescription(msg)
        .setFooter({ text: "Timed out. Please see original message." })
      ] });
      return null;
    } else {
      await message.edit({ embeds: [
        response
        .setDescription(`Got your response! Please see original message.\n\`\`\`\n${collected.first()}\n\`\`\``)
        .addField("Original Question", msg, false)
      ] });
      return collected.first();
    }
  },
  /**
   * Shortcut to nanoid. See docs there for reference.
   */
  customId: nanoid,
  /**
   * Shortcut to Discord.Util.escapeMarkdown. See docs there for reference.
   */
  escapeText: Discord.Util.escapeMarkdown,
  /**
   * Returns a MessageEmbed with basic values preset, such as color and timestamp.
   * @param {any} data The data object to pass to the MessageEmbed constructor.
   *   You can override the color and timestamp here as well.
   */
  embed: function(data = {}) {
    if (data?.author instanceof Discord.GuildMember) {
      data.author = {
        name: data.author.displayName,
        iconURL: data.author.user.displayAvatarURL()
      };
    } else if (data?.author instanceof Discord.User) {
      data.author = {
        name: data.author.username,
        iconURL: data.author.displayAvatarURL()
      };
    }
    const embed = new Discord.MessageEmbed(data);
    if (!data?.color) embed.setColor(config.color);
    if (!data?.timestamp) embed.setTimestamp();
    return embed;
  },
  /**
   * Handles a command exception/error. Most likely called from a catch.
   * Reports the error and lets the user know.
   * @param {Error} error The error to report.
   * @param {any} message Any Discord.Message, Discord.Interaction, or text string.
   */
  errorHandler: function(error, message = null) {
    if (!error || (error.name === "AbortError")) return;

    console.error(Date());

    const embed = utils.embed().setTitle(error?.name?.toString() ?? "Error");

    if (message instanceof Discord.Message) {
      const loc = (message.guild ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
      console.error(`${message.author.username} in ${loc}: ${message.cleanContent}`);

      message.channel.send("I've run into an error. I've let my devs know.")
        .then(utils.clean);
      embed.addField("User", message.author.username, true)
        .addField("Location", loc, true)
        .addField("Command", message.cleanContent || "`undefined`", true);
    } else if (message instanceof Discord.Interaction) {
      const loc = (message.guild ? `${message.guild?.name} > ${message.channel?.name}` : "DM");
      console.error(`Interaction by ${message.user.username} in ${loc}`);

      message[((message.deferred || message.replied) ? "editReply" : "reply")]({ content: "I've run into an error. I've let my devs know.", ephemeral: true }).catch(utils.noop);
      embed.addField("User", message.user?.username, true)
        .addField("Location", loc, true);

      const descriptionLines = [message.commandId || message.customId || "`undefined`"];
      const { command, data } = parseInteraction(message);
      descriptionLines.push(command);
      for (const datum of data) {
        descriptionLines.push(`${datum.name}: ${datum.value}`);
      }
      embed.addField("Interaction", descriptionLines.join("\n"));
    } else if (typeof message === "string") {
      console.error(message);
      embed.addField("Message", message);
    }

    console.trace(error);

    let stack = (error.stack ? error.stack : error.toString());
    if (stack.length > 4096) stack = stack.slice(0, 4000);

    embed.setDescription(stack);
    errorLog.send({ embeds: [embed] });
  },
  errorLog,
  /**
   * Fetch partial Discord objects
   * @param {*} obj The Discord object to fetch.
   */
  fetchPartial: (obj) => { return obj.fetch(); },
  /**
   * This task is extremely complicated.
   * You need to understand it perfectly to use it.
   * It took millenia to perfect, and will take millenia
   * more to understand, even for scholars.
   *
   * It does literally nothing.
   * */
  noop: () => {
    // No-op, do nothing
  },
  /**
   * Returns an object containing the command, suffix, and params of the message.
   * @param {Discord.Message} msg The message to get command info from.
   * @param {boolean} clean Whether to use the messages cleanContent or normal content. Defaults to false.
   */
  parse: (msg, clean = false) => {
    for (const prefix of [config.prefix, `<@${msg.client.user.id}>`, `<@!${msg.client.user.id}>`]) {
      const content = clean ? msg.cleanContent : msg.content;
      if (!content.startsWith(prefix)) continue;
      const trimmed = content.substr(prefix.length).trim();
      let [command, ...params] = trimmed.split(" ");
      if (command) {
        let suffix = params.join(" ");
        if (suffix.toLowerCase() === "help") { // Allow `!command help` syntax
          const t = command.toLowerCase();
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
   * Choose a random element from an array
   * @function rand
   * @param {Array} selections Items to choose from
   * @returns {*} A random element from the array
   */
  rand: function(selections) {
    return selections[Math.floor(Math.random() * selections.length)];
  },
  /**
   * Returns a promise that will fulfill after the given amount of time.
   * If awaited, will block for the given amount of time.
   * @param {number} t The time to wait, in milliseconds.
   */
  wait: function(t) {
    return new Promise((fulfill) => {
      setTimeout(fulfill, t);
    });
  }
};

module.exports = utils;
