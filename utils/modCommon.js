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

  ban: async (interaction, target, reason, days) => {
    try {
      if (!modCommon.compareRoles(interaction.member, target)) {
        await interaction.editReply({
          content: `You have insufficient permissions to ban ${target}!`
        });
        return;
      } else if (!target.bannable) {
        await interaction.editReply({
          content: `I have insufficient permissions to ban ${target}!`
        });
        return;
      }

      const confirm = await u.confirmInteraction(interaction, `Ban ${target} for:\n${reason}?`, `Confirm Ban on ${u.escapeText(target.displayName)}`);
      if (confirm) {
        // Do the ban!

        // The actual ban part
        const targetRoles = target.roles.cache.clone();
        await target.send({ embeds: [
          u.embed()
          .setTitle("User Ban")
          .setDescription(`You have been banned in ${interaction.guild.name} for:\n${reason}`)
        ] }).catch(() => modCommon.blocked(target));
        await target.ban({ days, reason });

        // Edit interaction
        await interaction.editReply({
          embeds: [
            u.embed({ author: target })
            .setColor(0x00ff00)
            .setDescription(`${target.toString()} banned for:\n${reason}`)
          ],
          components: []
        });

        // Save infraction
        Module.db.infraction.save({
          discordId: target.id,
          description: `[User Ban]: ${reason}`,
          value: 30,
          mod: interaction.member.id
        });

        // Save roles
        targetRoles.set(sf.roles.untrusted, null).set(sf.roles.muted, null).delete(sf.roles.trusted);
        const fakeTarget = {
          id: target.id,
          roles: { cache: targetRoles }
        };
        Module.db.user.updateRoles(fakeTarget);

        // Log it
        interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
          u.embed({ author: target })
          .setTitle("User Ban")
          .setDescription(`**${interaction.member}** banned **${target}** for:\n${reason}`)
          .setColor(0x0000ff)
        ] });
      } else {
        // Never mind
        await interaction.editReply({
          embeds: [u.embed({ author: interaction.member }).setColor(0x0000ff).setDescription(`Ban ${confirm === false ? "cancelled" : "timed out"}`)],
          components: []
        });
      }
      u.cleanInteraction(interaction);
    } catch (error) { u.errorHandler(error, interaction); }
  }
};

module.exports = modCommon;