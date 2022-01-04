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

function nameGen() {
  const { names, colors, adjectives } = require("../data/nameParts.json");
  let result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names);
  while (result.length > 32) { result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names); }
  return result;
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
      interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
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
      interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
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

      await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Mute")
        .setDescription(`**${interaction.member}** muted **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.guild.channels.cache.get(Module.config.channels.muted).send(
        `${target}, you have been muted in ${interaction.guild.name}. `
        + 'Please review our Code of Conduct. '
        + 'A member of the mod team will be available to discuss more details.\n\n'
        + 'http://ldsgamers.com/code-of-conduct'
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

      await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
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

    await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
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

async function slashModOffice(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (!compareRoles(interaction.member, target)) {
      await interaction.editReply({
        content: `You have insufficient permissions to put ${target} in the office!`,
        ephemeral: true
      });
      return;
    } else if (!target.manageable) {
      await interaction.editReply({
        content: `I have insufficient permissions to put ${target} in the office!`,
        ephemeral: true
      });
      return;
    }

    if (apply) { // Send 'em
      await interaction.editReply({
        content: `Sending ${target} to the office...`,
        ephemeral: true
      });

      // Don't bother if it's already done
      if (target.roles.cache.has(Module.config.roles.ducttape)) return;

      // Impose "duct tape"
      await target.roles.add(Module.config.roles.ducttape);
      // if (target.voice.channel) await target.voice.disconnect(reason);
      // muteState.set(target.id, target.voice.serverMute);
      // await target.voice.setMute(true, reason);

      await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Sent to Office")
        .setDescription(`**${interaction.member}** sent **${target}** to the office for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.guild.channels.cache.get(Module.config.channels.office).send(
        `${target}, you have been sent to the office in ${interaction.guild.name}. `
        + 'This allows you and the mods to have a private space to discuss any issues without restricting access to the rest of the server. '
        + 'Please review our Code of Conduct. '
        + 'A member of the mod team will be available to discuss more details.\n\n'
        + 'http://ldsgamers.com/code-of-conduct'
      );
    } else { // Remove "duct tape"
      await interaction.editReply({
        content: `Unmuting ${target}...`,
        ephemeral: true
      });

      // Don't bother if it's already done
      if (!target.roles.cache.has(Module.config.roles.ducttape)) return;

      // Remove "duct tape""
      await target.roles.remove(Module.config.roles.ducttape);
      // if (muteState.get(target.id)) await target.voice.setMute(false, "Mute resolved");
      // muteState.delete(target.id);

      await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Released from Office")
        .setDescription(`**${interaction.member}** let **${target}** out of the office.`)
        .setColor(0x00ff00)
      ] });
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModPurge(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const number = interaction.options.getInteger("number");
  let num = number;
  const reason = interaction.options.getString("reason");

  const channel = interaction.channel;
  if (num > 0) {
    await interaction.editReply({ content: `Deleting ${number} messages.`, ephemeral: true });

    // Use bulkDelete() first
    while (num > 0) {
      const deleting = Math.min(num, 50);
      const deleted = await channel.bulkDelete(deleting, true);
      num -= deleted.size;
      if (deleted.size != deleting) { break; }
    }
    // Handle the remainder one by one
    while (num > 0) {
      const fetching = Math.min(num, 50);
      const msgsToDelete = await channel.messages.fetch({ limit: fetching, before: interaction.id }).catch(u.noop);
      if (!msgsToDelete) { break; }
      for (const [, msg] of msgsToDelete) { await msg.delete().catch(u.noop); }
      num -= msgsToDelete.size;
      if (msgsToDelete.size != fetching) { break; }
    }
    // Log it
    await interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Purge")
      .setDescription(`**${interaction.member}** purged ${number - num} messages in ${interaction.channel}`)
      .addField('Reason', reason)
      .setColor(0x00ff00)
    ] });

    await interaction.followUp({ content: `${number - num} messages deleted.`, ephemeral: true });
  } else {
    await interaction.editReply({ content: `You need to tell me how many to delete!`, ephemeral: true });
  }
}

async function slashModRename(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");
  const newNick = interaction.options.getString("name") || nameGen();

  const oldNick = target.displayName;

  await target.setNickname(newNick);

  const comment = `Set nickname to ${u.escapeText(newNick)} from ${u.escapeText(oldNick)}.`;

  await Module.db.infraction.save({
    discordId: target.id,
    value: 0,
    description: comment,
    message: interaction.id,
    channel: interaction.channel.id,
    mod: interaction.member.id
  });
  const summary = await Module.db.infraction.getSummary(target.id);

  interaction.guild.channels.cache.get(Module.config.channels.modLogs).send({ embeds: [
    u.embed({ author: target })
    .setColor("#0000FF")
    .setDescription(comment)
    .addField("Resolved", `${interaction.member} changed ${target}'s nickname from ${u.escapeText(oldNick)} to ${u.escapeText(newNick)}.`)
    .addField(`Infraction Summary (${summary.time} Days) `, `Infractions: ${summary.count}\nPoints: ${summary.points}`)
    .setTimestamp()
  ] });

  await interaction.editReply({ content: `${target}'s nickname changed from ${u.escapeText(oldNick)} to ${u.escapeText(newNick)}.` });
}

const molasses = new Map();

async function slashModSlowmode(interaction) {
  await interaction.deferReply();
  const duration = interaction.options.getInteger("duration") ?? 10;
  const timer = interaction.options.getInteger("timer") || 15;

  if (duration == 0) {
    interaction.channel.edit({ rateLimitPerUser: 0 }).catch(e => u.errorHandler(e, interaction));

    if (molasses.has(interaction.channel.id)) {
      clearTimeout(molasses.get(interaction.channel.id));
      molasses.delete(interaction.channel.id);
    }

    interaction.editReply("Slowmode deactivated.");
  } else {
    // Reset duration if already in slowmode
    const prev = molasses.get(interaction.channel.id);
    if (prev) clearTimeout(prev.timeout);

    const limit = prev ? prev.limit : interaction.channel.rateLimitPerUser;
    await interaction.channel.edit({ rateLimitPerUser: timer });

    molasses.set(interaction.channel.id, {
      timeout: setTimeout((channel, rateLimitPerUser) => {
        channel.edit({ rateLimitPerUser }).catch(error => u.errorHandler(error, "Reset rate limit after slowmode"));
        molasses.delete(channel.id);
      }, duration * 60000, interaction.channel, limit),
      limit
    });

    interaction.editReply(`${timer}-second slowmode activated for ${duration} minute${duration > 1 ? 's' : ''}.`);
    interaction.guild.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Slowmode")
      .setDescription(`${interaction.member} set a ${timer}-second slow mode for ${duration} minute${duration > 1 ? 's' : ''} in ${interaction.channel}.`)
      .setColor(0x00ff00)
    ] });
  }
}

async function slashModSummary(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const time = interaction.options.getInteger("history");

  const data = await Module.db.infraction.getSummary(member.id, time);
  const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
  if ((data.count > 0) && (data.detail.length > 0)) {
    for (const record of data.detail) {
      const mod = interaction.guild.members.cache.get(record.mod) || `Unknown Mod (<@${record.mod}>)`;
      response.push(`${record.timestamp.toLocaleDateString()} (${record.value} pts, modded by ${mod}): ${record.description}`);
    }
  }
  const modlogs = await interaction.guild.channels.cache.get(Module.config.channels.modlogs);
  await modlogs.send(response.join("\n"), { split: true });
  await interaction.deferReply({ content: `I've put the summary you requested in ${modlogs}.`, ephemeral: true });
}

async function slashModTrust(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const type = interaction.options.getString("type");
  const apply = interaction.options.getBoolean("apply") ?? true;

  const role = {
    'initial': Module.config.roles.trusted,
    'plus': Module.config.roles.trustedplus,
    'watch': Module.config.roles.untrusted
  }[type];
  const channel = {
    'initial': Module.config.channels.modlogs,
    'plus': Module.config.channels.modlogs,
    'watch': Module.config.channels.modlogsplus
  }[type];

  const embed = u.embed({ author: member });

  if (apply) {
    switch (type) {
    case 'initial':
      member.send(
        `You have been marked as "Trusted" in ${interaction.guild.name} . `
        + "This means you are now permitted to post images and links in chat. "
        + "Please remember to follow the Code of Conduct when doing so.\n"
        + "<http://ldsgamers.com/code-of-conduct>\n\n"
        + "If you'd like to join one of our in-server Houses, you can visit <http://3houses.live> to get started!"
      ).catch(() => blocked(member));
      embed.setTitle("User Given Trusted")
      .setDescription(`${interaction.member} trusted ${member}.`);
      if (member.roles.cache.has(Module.config.roles.untrusted)) {
        await member.roles.remove(Module.config.roles.untrusted);
      }
      break;
    case 'plus':
      if (!member.roles.cache.has(Module.config.roles.trusted)) {
        await interaction.editReply({ content: `${member} needs <@&${Module.config.roles.trusted}> before they can be given <@&${Module.config.roles.trustedplus}>!`, ephemeral: true });
        return;
      }
      member.send(
        "Congratulations! "
        + "You've been added to the Trusted+ list in LDSG, allowing you to stream to voice channels!\n\n"
        + "While streaming, please remember the Streaming Guidelines ( https://goo.gl/Pm3mwS ) and LDSG Code of Conduct ( http://ldsgamers.com/code-of-conduct ). "
        + "Also, please be aware that LDSG may make changes to the Trusted+ list from time to time at its discretion."
      ).catch(u.noop);
      embed.setTitle("User Given Trusted+")
      .setDescription(`${interaction.member} gave ${member} the <@&${role}> role.`);
      break;
    case 'watch':
      embed.setTitle("User Watch")
      .setDescription(`${member} (${member.displayName}) has been added to the watch list by ${interaction.member}. Use \`/mod trust watch @user false\` command to remove them.`);
      break;
    }

    await member.roles.add(role);
    interaction.editReply({ content: `${member} has been given the <@&${role}> role!`, ephemeral: true });
  } else {
    switch (type) {
    case 'initial':
      member.send(
        `You have been removed from "Trusted" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to post images. "
        + "Please remember to follow the Code of Conduct when posting images or links.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted Removed")
      .setDescription(`${interaction.member} untrusted ${member}.`);
      if (member.roles.cache.has(Module.config.roles.trustedplus)) {
        await member.roles.remove(Module.config.roles.trustedplus);
      }
      await member.roles.add(Module.config.roles.untrusted);
      break;
    case 'plus':
      member.send(
        `You have been removed from "Trusted+" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to stream video in the server. "
        + "Please remember to follow the Code of Conduct.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted+ Removed")
      .setDescription(`${interaction.member} removed the <@&${role}> role from ${member}.`);
      break;
    case 'watch':
      embed.setTitle("User Unwatched")
      .setDescription(`${member} (${member.displayName}) has been removed from the watch list by ${interaction.member}. Use \`/mod trust watch @user true\` command to re-add them.`);
      break;
    }

    await member.roles.remove(role);
    interaction.editReply({ content: `The <@&${role}> role has been removed from ${member}!`, ephemeral: true });
  }

  await interaction.guild.channels.cache.get(channel).send({ embeds: [embed] });
}

async function slashModWarn(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason");
  const value = interaction.options.getInteger("value") ?? 1;

  const response = "We have received one or more complaints regarding content you posted. "
    + "We have reviewed the content in question and have determined, in our sole discretion, that it is against our code of conduct (<http://ldsgamers.com/code-of-conduct>). "
    + "This content was removed on your behalf. "
    + "As a reminder, if we believe that you are frequently in breach of our code of conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n"
    + `**${u.escapeText(interaction.member.displayName)}** has issued you a warning for:\n`
    + reason;
  member.send(response).catch(() => blocked(member));

  const embed = u.embed()
    .setColor("#0000FF")
    .setAuthor(member.displayName, member.user.displayAvatarURL())
    .setDescription(reason)
    .addField("Resolved", `${u.escapeText(interaction.user.username)} issued a ${value} point warning.`)
    .setTimestamp();
  const flag = await interaction.guild.channels.cache.get(Module.config.channels.modLogs).send({ embeds: [embed] });

  await Module.db.infraction.save({
    discordId: member.id,
    value: value,
    description: reason,
    message: interaction.id,
    flag: flag.id,
    channel: interaction.channel.id,
    mod: interaction.author.id
  });

  const summary = await Module.db.infraction.getSummary(member.id);
  embed.addField(`Infraction Summary (${summary.time} Days) `, `Infractions: ${summary.count}\nPoints: ${summary.points}`);

  flag.edit({ embeds: [embed] });
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
      default:
        u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
});

module.exports = Module;
