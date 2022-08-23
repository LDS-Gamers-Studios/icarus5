const Augur = require("augurbot"),
  discord = require('discord.js'),
  sf = require('../config/snowflakes.json'),
  perms = require('../utils/perms'),
  u = require("../utils/utils");

let tags = new u.Collection();

/**
 * @param {string} tag The tag name to find
 * @param {string} guildId The guild the tag was saved in
 */
const findTag = (tag, guildId) => tag ? tags.find(t => t.tag.toLowerCase() == tag.toLowerCase() && t.guildId == guildId) : tags.filter(t => t.guildId == guildId);

/** @param {discord.Message} msg */
function runTag(msg) {
  const cmd = u.parse(msg);
  const tag = findTag(cmd?.command ?? { toLowerCase: u.noop }, msg.guild.id);
  const files = [];
  const target = msg.mentions?.members?.first();
  if (tag) {
    let response = tag.response;
    const regex = /<@random ?\[(.*?)\]>/gm;
    if (regex.test(response)) {
      const replace = (str) => u.rand(str.replace(regex, '$1').split('|'));
      response = response.replace(regex, replace);
    }
    response = response?.replace(/<@author>/ig, msg.author.toString())
      .replace(/<@channel>/ig, msg.channel.toString())
      .replace(/<@authorname>/ig, msg.member.displayName);
    if ((/(<@target>)|(<@targetname>)/ig).test(tag.response)) {
      if (!target) return msg.reply("You need to `@mention` a user with that command!").then(u.clean);
      response = response.replace(/<@target>/ig, target.toString())
        .replace(/<@targetname>/ig, target.displayName);
    }
    if (tag.attachment) {
      files.push({
        attachment: tag.url,
        name: tag.attachment
      });
    }
    const users = [target?.id].filter(usr => usr != msg.author.id);
    users.push(msg.author.id);
    msg.channel.send({ content: response, files, allowedMentions: { users } });
  }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "tag",
  commandId: sf.commands.slashTag,
  permissions: (int) => int.options.getSubcommand() == 'list' ? true : (perms.isMgr(int) || perms.isMgmt(int) || perms.isAdmin(int)),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
    case "create": return await createTag();
    case "modify": return await modifyTag();
    case "delete": return await deleteTag();
    case "help": return await placeholders();
    case "value": return await rawTag();
    case "list": return await listTags();
    }
    async function createTag() {
      const name = int.options.getString('name').toLowerCase();
      const response = int.options.getString('response');
      const attachment = int.options.getAttachment('attachment');
      if (findTag(name, int.guild.id)) return int.reply({ content: `"Looks like that tag already exists. Try </tag modify:${sf.commands.slashTag}> or </tag delete:${sf.commands.slashTag}> instead."`, ephemeral: true });
      if (!response && !attachment) return int.reply({ content: "I need either a response or a file.", ephemeral: true });
      const command = await Module.db.tags.addTag({
        tag: name,
        response,
        guildId: int.guild.id,
        attachment: attachment?.name ?? null,
        url: attachment?.url ?? null
      });
      if (!command) return int.reply({ content: "I wasn't able to save that. Please try again later or with a different name." });
      tags.set(command.tag, command);
      const embed = u.embed({ author: int.member })
        .setTitle("Tag created")
        .setDescription(`${int.member} added the tag "${name}"`);
      if (command.response) embed.addField("Response", command.response);
      if (command.url) embed.setImage(command.url);
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      int.reply({ embeds: [embed.setDescription('')], ephemeral: true });
    }
    async function modifyTag() {
      const name = int.options.getString('name').toLowerCase();
      const response = int.options.getString('response');
      const attachment = int.options.getAttachment('attachment');
      const currentTag = findTag(name, int.guild.id);
      if (!currentTag) return int.reply({ content: `"Looks like that tag doesn't exist. Use </tag list:${sf.commands.slashTag}> for a list of tags."`, ephemeral: true });
      if (!response && !attachment) return int.reply({ content: "I need either a response or a file.", ephemeral: true });
      const command = await Module.db.tags.modifyTag({
        tag: name,
        response,
        guildId: int.guild.id,
        attachment: attachment?.name ?? null,
        url: attachment?.url ?? null
      });
      if (!command) return int.reply({ content: "I wasn't able to save that. Please try again later or contact a dev to see what went wrong." });
      tags.set(command.tag, command);
      const embed = u.embed({ author: int.member })
        .setTitle("Tag modified")
        .setDescription(`${int.member} modified the tag "${name}"`);
      if (command.response != currentTag.response) {
        embed.addField("Old Response", currentTag.response ?? 'None');
        embed.addField("New Response", command.response ?? 'None');
      }
      if (command.url != currentTag.url) {
        embed.addField("Old File", `${currentTag.attachment ? `[${currentTag.attachment}](${command.url})` : 'None'}`);
        embed.addField("New File", `${command?.attachment ? `[${command.attachment}](${command.url})` : 'None'}`);
      }
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      int.reply({ embeds: [embed.setDescription("")], ephemeral: true });
    }
    async function deleteTag() {
      const name = int.options.getString('name').toLowerCase();
      if (!findTag(name, int.guild.id)) return int.reply({ content: `"Looks like that tag doesn't exist. Use </tag list:${sf.commands.slashTag}> for a list of tags."`, ephemeral: true });
      const command = await Module.db.tags.deleteTag(name, int.guild.id);
      const embed = u.embed({ author: int.member })
        .setTitle("Tag Deleted")
        .setDescription(`${int.member} removed the tag "${name}"`);
      if (command?.response) embed.addField("Response", command.response);
      if (command?.url) embed.setImage(command.url);
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      int.reply({ embeds: [embed.setDescription("")], ephemeral: true });
      tags.delete(name);
    }
    async function placeholders() {
      const placeholderDescriptions = [
        "`<@author>`: Pings the user",
        "`<@authorname>`: The user's nickname",
        "`<@target>`: Pings someone who is pinged by the user",
        "`<@targetname>`: The nickname of someone who is pinged by the user",
        "`<@channel>`: The channel the command is used in",
        "`<@random [item1|item2|item3...]>`: Randomly selects one of the items. Separate with `|`. (No, there can't be `<@random>`s inside of `<@random>`s)",
        "",
        "Example: <@target> took over <@channel>, but <@author> <@random is complicit|might have something to say about it>."
      ];
      const embed = u.embed().setTitle("Tag Placeholders").setDescription(`You can use these when creating or modifying tags for some user customization. The \`<@thing>\` gets replaced with the proper value when the command is run. \n\n${placeholderDescriptions.join('\n')}`);
      return int.reply({ embeds: [embed], ephemeral: true });
    }
    async function rawTag() {
      const name = int.options.getString('name').toLowerCase();
      const tag = findTag(name, int.guild.id);
      if (!tag) return int.reply({ content: `"Looks like that tag doesn't exist. Use </tag list:${sf.commands.slashTag}> for a list of tags."`, ephemeral: true });
      const embed = u.embed({ author: int.member })
        .setTitle(tag.tag)
        .setDescription(tag.response)
        .setImage(tag.url);
      return int.reply({ embeds: [embed], ephemeral: true });
    }
    async function listTags() {
      const list = Array.from(tags.values()).map(c => Module.config.prefix + c.tag).sort();
      const embed = u.embed()
        .setTitle("Custom tags in " + int.guild.name)
        .setThumbnail(int.guild.iconURL())
        .setDescription(list.join("\n"));
      int.reply({ embeds: [embed], ephemeral: true });
    }
  }
})
.addEvent("messageCreate", (msg) => { if (msg.guild && !msg.author.bot) return runTag(msg); })
.addEvent("messageUpdate", (oldMsg, msg) => { if (oldMsg.guild.id && !msg.author.bot) return runTag(msg); })
.setInit(async () => {
  try {
    const cmds = await Module.db.tags.fetchAllTags();
    tags = new u.Collection(cmds.map(c => [c.tag, c]));
  } catch (error) { u.errorHandler(error, "Load Custom Tags"); }
})
.addEvent('interactionCreate', async interaction => {
  if (interaction.type == "APPLICATION_COMMAND_AUTOCOMPLETE" && interaction.commandId == sf.commands.slashTag) {
    const focusedValue = interaction.options.getFocused()?.toLowerCase();
    const filtered = tags.filter(tag => tag.tag.toLowerCase().startsWith(focusedValue));
    await interaction.respond(filtered.map(choice => ({ name: choice.tag, value: choice.tag })));
  }
});

module.exports = Module;