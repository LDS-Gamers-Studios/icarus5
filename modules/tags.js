const Augur = require("augurbot"),
  discord = require('discord.js'),
  sf = require('../config/snowflakes.json'),
  u = require("../utils/utils");

let tags = new Map();
/** @param {discord.Message} msg */
function runTag(msg) {
  const cmd = u.parse(msg);
  const tag = tags.get(cmd?.command);
  const files = [];
  const target = msg.mentions?.users?.first();
  if (tag) {
    let response = tag.response
      .replace(/<@time>/ig, u.discordTimestamp())
      .replace(/<@author>/ig, msg.author.toString())
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
    case "placeholder": return await placeholders();
    case "list": return await list();
    }
    async function createTag() {
      const name = int.options.getString('name');
      const response = int.options.getString('response');
      const attachment = int.options.getAttachment('attachment');
      if (tags.get(name)) return int.reply({ content: "Looks like that tag already exists. Try `/tag modify` or `/tag delete` instead.", ephemeral: true });
      if (!response && !attachment) return int.reply({ content: "I need either a response or a file.", ephemeral: true });
      const command = await Module.db.tags.addTag({
        tag: name,
        response,
        attachment: attachment?.name ?? null,
        url: attachment?.url ?? null
      });
      if (!command) return int.reply({ content: "I wasn't able to save that. Please try again later or with a different name." });
      tags.set(name, command);
      int.reply({ content: `Tag \`${name}\` was successfully added`, ephemeral: true });
      const embed = u.embed()
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
        .setTitle("Tag created")
        .setDescription(`${int.member} added the tag "${name}"`);
      console.log(command);
      if (command?.response) embed.addField("Response", command.response);
      if (command?.url) embed.setImage(command.url);
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
    }
    async function modifyTag() {
      const name = int.options.getString('name');
      const response = int.options.getString('response');
      const attachment = int.options.getAttachment('attachment');
      if (!tags.get(name)) return int.reply({ content: "Looks like that tag doesn't exist. Try `/tag create` instead. For a list of tags, do `!help`.", ephemeral: true });
      if (!response && !attachment) return int.reply({ content: "I need either a response or a file.", ephemeral: true });
      const currentTag = tags.get(name);
      const command = await Module.db.tags.modifyTag({
        tag: name,
        response,
        attachment: attachment?.name ?? null,
        url: attachment?.url ?? null
      });
      if (!command) return int.reply({ content: "I wasn't able to save that. Please try again later or with a different name." });
      tags.set(name, command);
      int.reply({ content: `Tag \`${name} was successfully modified`, ephemeral: true });
      const embed = u.embed()
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
        .setTitle("Tag modified")
        .setDescription(`${int.member} modified the tag "${name}"`);
      if (command?.response != currentTag.response) {
        embed.addField("Old Response", currentTag.response ?? 'None');
        embed.addField("New Response", command.response ?? 'None');
      }
      if (command?.url != currentTag.url) {
        embed.addField("Old File", `${currentTag.attachment ? `[${currentTag.attachment}](${command.url})` : 'None'}`);
        embed.addField("New File", `${command?.attachment ? `[${command.attachment}](${command.url})` : 'None'}`);
      }
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
    }
    async function deleteTag() {
      const name = int.options.getString('name');
      if (!tags.get(name)) return int.reply({ content: "Looks like that tag doesn't exist. For a list of tags, do `!help`.", ephemeral: true });
      const command = await Module.db.tags.deleteTag(name);
      int.reply({ content: `Tag \`${name}\` was successfully removed`, ephemeral: true });
      const embed = u.embed()
        .setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
        .setTitle("Tag created")
        .setDescription(`${int.member} removed the tag "${name}"`);
      if (command?.response) embed.addField("Response", command.response);
      if (command?.url) embed.setImage(command.url);
      int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      tags.delete(name);
    }
    async function placeholders() {
      return;
    }
    async function list() {
      const tagList = Array.from(tags.values()).map(c => Module.config.prefix + c.tag).sort();
      const embed = u.embed()
        .setTitle("Custom tags in " + int.guild.name)
        .setThumbnail(int.guild.iconURL())
        .setDescription(tagList.join("\n"));
      int.user.send({ embeds: [embed] }).catch(u.noop);
    }
  }
})
.addEvent("ready", async () => {
  try {
    const cmds = await Module.db.tags.fetchTags();
    tags = new Map(cmds.map(c => [c.tag, c]));
    console.log(`Loaded ${cmds.length} custom commands${(Module.client.shard ? " on Shard " + Module.client.shard.id : "")}.`);
  } catch (error) { u.errorHandler(error, "Load Custom Tags"); }
})
.addEvent("messageCreate", (msg) => {
  if (msg.guild.id == sf.ldsg && !msg.author.bot) return runTag(msg);
})
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (oldMsg.guild.id == sf.ldsg && !msg.author.bot) return runTag(msg);
})
.setInit(data => { if (data) tags = data; })
.setUnload(() => tags);

module.exports = Module;