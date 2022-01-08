const Augur = require("augurbot"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes.json");

const Module = new Augur.Module(); // Probably a better way to do this,
// this is purely for db access later

const modCommon = {
  /**
  * Give the mods a heads up that someone isn't getting their DMs.
  * @param {Discord.GuildMember} member The guild member that's blocked.
  */
  blocked: (member) => {
    return member.client.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({
        author: member,
        color: 0x00ffff,
        title: `${member} has me blocked. *sadface*`
      })
    ] });
  },

  compareRoles: (mod, target) => {
    const modHigh = mod.roles.cache.filter(r => r.id != sf.roles.live)
      .sort((a, b) => b.comparePositionTo(a)).first();
    const targetHigh = target.roles.cache.filter(r => r.id != sf.roles.live)
      .sort((a, b) => b.comparePositionTo(a)).first();
    return (modHigh.comparePositionTo(targetHigh) > 0);
  },

  nameGen: () => {
    const { names, colors, adjectives } = require("../data/nameParts.json");
    let result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names);
    while (result.length > 32) { result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names); }
    return result;
  },

  getSummaryEmbed: async (member, time, guild) => {
    const data = await Module.db.infraction.getSummary(member.id, time);
    const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
    if ((data.count > 0) && (data.detail.length > 0)) {
      data.detail = data.detail.reverse(); // Newest to oldest is what we want
      for (const record of data.detail) {
        const mod = guild.members.cache.get(record.mod) || `Unknown Mod (<@${record.mod}>)`;
        const pointsPart = record.value === 0 && mod.id !== Module.client.user.id ? "Note" : `${record.value} pts`;
        response.push(`\`${record.timestamp.toLocaleDateString()}\` (${pointsPart}, modded by ${mod}): ${record.description}`);
      }
    }
    let text = response.join("\n");
    text = text.length > 4090 ? text.substring(0, 4090) + "..." : text;
    return u.embed({ author: member })
      .setTitle("Infraction Summary")
      .setDescription(text)
      .setColor(0x00ff00);
  },

  ban: async (interaction) => {

  }
};

module.exports = modCommon;