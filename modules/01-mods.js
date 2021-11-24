const Augur = require("augurbot"),
  u = require("../utils/utils"),
  config = require("../config/config.json");

const muteState = new u.Collection();

/**
 * Give the mods a heads up that someone isn't getting their DMs.
 * @param {GuildMember} member The guild member that's blocked.
 */
function blocked(member) {
  return member.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      title: `${member} has me blocked. *sadface*`
    })
  ] });
}

function compareRoles(mod, target) {
  const modHigh = mod.roles.cache.filter(r => r.id != Module.config.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  const targetHigh = target.roles.cache.filter(r => r.id != Module.config.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  return (modHigh.comparePositionTo(targetHigh) > 0);
}

function isMod(interaction) {
  return interaction.member.roles.cache.some(r => ([Module.config.roles.management, Module.config.roles.mod].includes(r.id)));
}

async function slashModBan(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason");
    const days = interaction.options.getInteger("clean") ?? 1;

    if (!compareRoles(interaction.member, target)) {
      await interaction.editReply({
        content: `You have insufficient permissions to ban ${target}!`,
        ephemeral: true
      });
      return;
    } else if (!target.bannable) {
      await interaction.editReply({
        content: `I have insufficient permissions to ban ${target}!`,
        ephemeral: true
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
      ] }).catch(() => blocked(target));
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
      targetRoles.set(Module.config.roles.untrusted, null).set(Module.config.roles.muted, null).delete(Module.config.roles.trusted);
      const fakeTarget = {
        id: target.id,
        roles: { cache: targetRoles }
      };
      Module.db.user.updateRoles(fakeTarget);

      // Log it
      interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("User Ban")
        .setDescription(`**${interaction.member}** banned **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });
    } else {
      // Never mind
      await interaction.editReply({
        embeds: [u.embed({ author: interaction.member }).setColor(0x0000ff).setDescription(`Ban ${confirm === false ? "cancelled" : "timed out"}`)],
        components: [],
        ephemeral: true
      });
    }
    u.cleanInteraction(interaction);
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModKick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason");

    if (!compareRoles(interaction.member, target)) {
      await interaction.editReply({
        content: `You have insufficient permissions to kick ${target}!`,
        ephemeral: true
      });
      return;
    } else if (!target.kickable) {
      await interaction.editReply({
        content: `I have insufficient permissions to kick ${target}!`,
        ephemeral: true
      });
      return;
    }

    const confirm = await u.confirmInteraction(interaction, `Kick ${target} for:\n${reason}?`, `Confirm Kick on ${u.escapeText(target.displayName)}`);
    if (confirm) {
      // Do the kick!

      // The actual kick part
      const targetRoles = target.roles.cache.clone();
      await target.send({ embeds: [
        u.embed()
        .setTitle("User Kick")
        .setDescription(`You have been kicked in ${interaction.guild.name} for:\n${reason}`)
      ] }).catch(() => blocked(target));
      await target.kick({ reason });

      // Edit interaction
      await interaction.editReply({
        embeds: [
          u.embed({ author: target })
          .setColor(0x00ff00)
          .setDescription(`${target.toString()} kicked for:\n${reason}`)
        ],
        components: []
      });

      // Save infraction
      Module.db.infraction.save({
        discordId: target.id,
        description: `[User Kick]: ${reason}`,
        value: 30,
        mod: interaction.member.id
      });

      // Save roles
      targetRoles.set(Module.config.roles.untrusted, null).set(Module.config.roles.muted, null).delete(Module.config.roles.trusted);
      const fakeTarget = {
        id: target.id,
        roles: { cache: targetRoles }
      };
      Module.db.user.updateRoles(fakeTarget);

      // Log it
      interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("User Kick")
        .setDescription(`**${interaction.member}** kicked **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });
    } else {
      // Never mind
      await interaction.editReply({
        embeds: [u.embed({ author: target }).setColor(0x0000ff).setDescription(`Kick ${confirm === false ? "cancelled" : "timed out"}`)],
        components: [],
        ephemeral: true
      });
    }
    u.cleanInteraction(interaction);
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModMute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (!compareRoles(interaction.member, target)) {
      await interaction.editReply({
        content: `You have insufficient permissions to mute ${target}!`,
        ephemeral: true
      });
      return;
    } else if (!target.manageable) {
      await interaction.editReply({
        content: `I have insufficient permissions to mute ${target}!`,
        ephemeral: true
      });
      return;
    }

    if (apply) { // Mute 'em
      await interaction.editReply({
        content: `Muting ${target}...`,
        ephemeral: true
      });

      // Don't mute if muted
      if (target.roles.cache.has(Module.config.roles.muted)) return;

      // Impose Mute
      await target.roles.add(Module.config.roles.muted);
      if (target.voice.channel) await target.voice.disconnect(reason);
      muteState.set(target.id, target.voice.serverMute);
      await target.voice.setMute(true, reason);

      await interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Mute")
        .setDescription(`**${interaction.member}** muted **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.client.channels.cache.get(Module.config.channels.muted).send(
        `${target}, you have been muted in ${interaction.guild.name}. `
        + 'Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct'
      );
    } else { // Remove mute
      await interaction.editReply({
        content: `Unmuting ${target}...`,
        ephemeral: true
      });

      // Don't unmute if not muted
      if (!target.roles.cache.has(Module.config.roles.muted)) return;

      // Remove Mute
      await target.roles.remove(Module.config.roles.muted);
      if (muteState.get(target.id)) await target.voice.setMute(false, "Mute resolved");
      muteState.delete(target.id);

      await interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Unmute")
        .setDescription(`**${interaction.member}** unmuted **${target}**`)
        .setColor(0x00ff00)
      ] });
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModNote(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const note = interaction.options.getString("note");

    Module.db.infraction.save({
      discordId: target.id,
      value: 0,
      description: note,
      mod: interaction.user.id
    });
    const summary = await Module.db.infraction.getSummary(target.id);

    await interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
      u.embed({ author: target })
      .setColor("#0000FF")
      .setDescription(note)
      .addField("Resolved", `${u.escapeText(interaction.user.username)} added a note.`)
      .addField(`Infraction Summary (${summary.time} Days)`, `Infractions: ${summary.count}\nPoints: ${summary.points}`)
      .setTimestamp()
    ] });

    await interaction.editReply({ content: `Note added for user ${target.toString()}.`, ephemeral: true });
  } catch (error) { u.errorHandler(error, interaction); }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "mod",
  guildId: config.ldsg,
  commandId: undefined,
  permissions: isMod,
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
      case "ban":
        await slashModBan(interaction);
        break;
      case "kick":
        await slashModKick(interaction);
        break;
      case "mute":
        await slashModMute(interaction);
        break;
      case "note":
        await slashModNote(interaction);
        break;
      /*
      case "office":
        await slashModOffice(interaction);
        break;
      case "purge":
        await slashModPurge(interaction);
        break;
      case "rename":
        await slashModRename(interaction);
        break;
      case "slowmode":
        await slashModSlowmode(interaction);
        break;
      case "summary":
        await slashModSummary(interaction);
        break;
      case "trust":
        await slashModTrust(interaction);
        break;
      case "warn":
        await slashModWarn(interaction);
        break;
      */
      default:
        interaction.reply({
          content: "Well, this is embarrasing. I don't know how to handle that (yet).",
          ephemeral: true
        });
        // u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
});

module.exports = Module;
