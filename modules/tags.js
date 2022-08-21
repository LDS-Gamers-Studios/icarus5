const Augur = require("augurbot"),
  discord = require('discord.js'),
  sf = require('../config/snowflakes.json'),
  u = require("../utils/utils");

let tags = new u.Collection();
/** @param {discord.Message} msg */

const findTag = (cmd, guildId) => cmd ? tags.find(t => t.tag.toLowerCase() == cmd.toLowerCase() && t.guildId == guildId) : tags.filter(t => t.guildId == guildId);

function runTag(msg) {
  const cmd = u.parse(msg);
  const tag = findTag(cmd?.command ?? { toLowerCase: u.noop }, msg.guild.id);
  const files = [];
  const target = msg.mentions?.members?.first();
  if (tag) {
    let response = tag.response
      ?.replace(/<@author>/ig, msg.author.toString())
      .replace(/<@authorname>/ig, msg.member.displayName);
    if ((/(<@target>)|(<@targetname>)/i).test(response)) {
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
  } else if (cmd?.command == "help" && tags.size > 0 && !cmd.suffix) {
    const list = Array.from(tags.values()).map(c => Module.config.prefix + c.tag).sort();
    const embed = u.embed()
      .setTitle("Custom tags in " + msg.guild.name)
      .setThumbnail(msg.guild.iconURL())
      .setDescription(list.join("\n"));
    msg.author.send({ embeds: [embed] }).catch(u.noop);
  }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "tag",
  commandId: sf.commands.slashTag,
  process: async (int) => {
    switch (int.options.getSubcommand()) {
    case "create": return await createTag();
    case "modify": return await modifyTag();
    case "delete": return await deleteTag();
    case "help": return await placeholders();
    }
    async function createTag() {
      const name = int.options.getString('name').toLowerCase();
      const response = int.options.getString('response');
      const attachment = int.options.getAttachment('attachment');
      if (findTag(name, int.guild.id)) return int.reply({ content: "Looks like that tag already exists. Try `/tag modify` or `/tag delete` instead.", ephemeral: true });
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
      const embed = u.embed().setTitle("Tag created")
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
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
      if (!currentTag) return int.reply({ content: "Looks like that tag doesn't exist. Try `/tag create` instead. For a list of tags, do `/tag list`.", ephemeral: true });
      if (!response && !attachment) return int.reply({ content: "I need either a response or a file.", ephemeral: true });
      const command = await Module.db.tags.modifyTag({
        tag: name,
        response,
        guildId: int.guild.id,
        attachment: attachment?.name ?? null,
        url: attachment?.url ?? null
      });
      if (!command) return int.reply({ content: "I wasn't able to save that. Please try again later or with a different name." });
      tags.set(command.tag, command);
      const embed = u.embed()
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
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
      if (!findTag(name, int.guild.id)) return int.reply({ content: "Looks like that tag doesn't exist. For a list of tags, do `/tag list`.", ephemeral: true });
      const command = await Module.db.tags.deleteTag(name, int.guild.id);
      const embed = u.embed()
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
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
      ];
      const embed = u.embed().setTitle("Tag Placeholders").setDescription(`You can use these when creating or modifying tags for some user customization. The \`<@thing>\` gets replaced with the proper value when the command is run. \n\n${placeholderDescriptions.join('\n')}`);
      return int.reply({ embeds: [embed], ephemeral: true });
    }
  }
})
.addEvent("ready", async () => {
  try {
    const cmds = await Module.db.tags.fetchAllTags();
    tags = new u.Collection(cmds.map(c => [c.tag, c]));
    console.log(`Loaded ${cmds.length} custom tags${(Module.client.shard ? " on Shard " + Module.client.shard.id : "")}.`);
  } catch (error) { u.errorHandler(error, "Load Custom Tags"); }
})
.addEvent("messageCreate", (msg) => {
  if (msg.guild && !msg.author.bot) return runTag(msg);
})
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (oldMsg.guild.id && !msg.author.bot) return runTag(msg);
})
.setInit(data => { if (data) tags = data; })
.setUnload(() => tags)
.addEvent('interactionCreate', async interaction => {
  if (interaction.type == "APPLICATION_COMMAND_AUTOCOMPLETE" && interaction.commandId == sf.commands.slashTag) {
    const focusedValue = interaction.options.getFocused()?.toLowerCase();
    const filtered = tags.filter(tag => tag.tag.toLowerCase().startsWith(focusedValue));
    await interaction.respond(filtered.map(choice => ({ name: choice.tag, value: choice.tag })));
  }
});

module.exports = Module;