const Augur = require("augurbot"),
  Discord = require("discord.js"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes.json"),
  p = require("../utils/perms"),
  profanityFilter = require("profanity-matcher"),
  c = require("../utils/modCommon");


/**
 * Give the mods a heads up that someone isn't getting their DMs.
 * @param {Discord.GuildMember} member The guild member that's blocked.
 */
function blocked(member) {
  return member.client.channels.cache.get(sf.channels.modlogs).send({ embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      description: `${member} has me blocked. *sadface*`
    })
  ] });
}

async function getSummaryEmbed(member, time, guild) {
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
}

async function slashModBan(interaction) {
  await interaction.deferReply({ ephemeral: true });

  const target = interaction.options.getMember("user");
  const reason = interaction.options.getString("reason");
  const days = interaction.options.getInteger("clean") ?? 1;

  await c.ban(interaction, target, reason, days);
}

async function slashModFilter(interaction) {
  const pf = new profanityFilter();
  await interaction.deferReply({ ephemeral: true });
  const word = interaction.options.getString("word").toLowerCase().trim();
  const member = interaction.member;
  const modLogs = interaction.guild.channels.cache.get(sf.channels.modlogs);
  const filtered = pf.scan(word);
  const apply = interaction.options.getBoolean("apply") ?? true;
  if (!p.isMgmt(interaction) && !p.isMgr(interaction) && !p.isAdmin(interaction)) {
    interaction.editReply("This command is for Management, Discord Manager, and Bot Admins only.");
    return;
  }
  if (apply) {
    if (filtered != word && pf.add_word(word)) {
      const embed = u.embed({ author: member })
      .setTitle("Word added to the language filter.")
      .setDescription(`${member} added "${word}" to the language filter.`);
      await modLogs.send({ embeds: [embed] });
      await interaction.editReply(`"${word}" was added to the language filter.`);
    } else {
      await interaction.editReply(`"${word}" was already in the language filter.`);
    }
  } else if (pf.remove_word(word)) {
    const embed = u.embed({ author: member })
    .setTitle("Word removed from language filter.")
    .setDescription(`${member} removed "${word}" from the language filter.`);
    await modLogs.send({ embeds: [embed] });
    await interaction.editReply(`"${word}" has been removed from the language filter.`);
  } else {
    await interaction.editReply(`"${word}" was not found in the language filter.`);
  }
  Module.client.emit("filterUpdate");
}

async function slashModFullInfo(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user") ?? interaction.member;
  const time = interaction.options.getInteger("history") ?? 28;

  let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
  if (roleString.length > 1024) roleString = roleString.substr(0, roleString.indexOf(", ", 1000)) + " ...";

  const userDoc = await Module.db.user.fetchUser(member.id);

  const e = await getSummaryEmbed(member, time, interaction.guild);

  await interaction.editReply({ embeds: [
    e.addField("ID", member.id, true)
    .addField("Activity", `Posts: ${userDoc.posts}`, true)
    .addField("Roles", roleString)
    .addField("Joined", member.joinedAt.toUTCString(), true)
    .addField("Account Created", member.user.createdAt.toUTCString(), true)
  ] });
}

async function slashModKick(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason");

    await c.kick(interaction, target, reason);
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModMute(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "Violating the Code of Conduct";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (apply) { // Mute 'em
      await c.mute(interaction, target, reason);
    } else { // Remove mute
      await c.unmute(interaction, target);
    }
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModNote(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const note = interaction.options.getString("note");

    await c.note(interaction, target, note);
  } catch (error) { u.errorHandler(error, interaction); }
}

async function slashModOffice(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const target = interaction.options.getMember("user");
    const reason = interaction.options.getString("reason") || "No reason provided";
    const apply = interaction.options.getBoolean("apply") ?? true;

    if (!target.manageable) {
      await interaction.editReply({
        content: `I have insufficient permissions to put ${target} in the office!`
      });
      return;
    }

    if (apply) { // Send 'em
      // Don't bother if it's already done
      if (target.roles.cache.has(sf.roles.ducttape)) {
        await interaction.editReply({
          content: `They're already in the office.`
        });
        return;
      }

      // Impose "duct tape"
      await target.roles.add(sf.roles.ducttape);
      // if (target.voice.channel) await target.voice.disconnect(reason);
      // muteState.set(target.id, target.voice.serverMute);
      // await target.voice.setMute(true, reason);

      await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Sent to Office")
        .setDescription(`**${interaction.member}** sent **${target}** to the office for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.guild.channels.cache.get(sf.channels.office).send(
        `${target}, you have been sent to the office in ${interaction.guild.name}. `
        + 'This allows you and the mods to have a private space to discuss any issues without restricting access to the rest of the server. '
        + 'Please review our Code of Conduct. '
        + 'A member of the mod team will be available to discuss more details.\n\n'
        + 'http://ldsgamers.com/code-of-conduct'
      );

      await interaction.editReply({
        content: `Sent ${target} to the office.`
      });
    } else { // Remove "duct tape"
      // Don't bother if it's already done
      if (!target.roles.cache.has(sf.roles.ducttape)) {
        await interaction.editReply({
          content: `They aren't in the office.`,
        });
        return;
      }

      // Remove "duct tape""
      await target.roles.remove(sf.roles.ducttape);
      // if (muteState.get(target.id)) await target.voice.setMute(false, "Mute resolved");
      // muteState.delete(target.id);

      await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Released from Office")
        .setDescription(`**${interaction.member}** let **${target}** out of the office.`)
        .setColor(0x00ff00)
      ] });

      await interaction.editReply({
        content: `Removed ${target} from the office.`,
      });
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
    await interaction.editReply({ content: `Deleting ${num} messages...` });

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
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Purge")
      .setDescription(`**${interaction.member}** purged ${number - num} messages in ${interaction.channel}`)
      .addField('Reason', reason)
      .setColor(0x00ff00)
    ] });

    await interaction.followUp({ content: `${number - num} messages deleted.`, ephemeral: true });
  } else {
    await interaction.editReply({ content: `You need to tell me how many to delete!` });
  }
}

async function slashModRename(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const target = interaction.options.getMember("user");

  await c.rename(interaction, target);
}

const molasses = new Map();

async function slashModSlowmode(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const duration = interaction.options.getInteger("duration") ?? 10;
  const timer = interaction.options.getInteger("timer") || 15;
  const ch = interaction.options.getChannel("channel") || interaction.channel;

  if ([ "GUILD_VOICE", "GUILD_CATEGORY", "GUILD_STORE", "GUILD_STAGE_VOICE", "UNKNOWN" ].includes(ch.type)) {
    await interaction.editReply("You can't set slowmode in that channel.");
    return;
  }

  if (duration <= 0) {
    ch.edit({ rateLimitPerUser: 0 }).catch(e => u.errorHandler(e, interaction));
    const old = molasses.get(ch.id);
    if (old) {
      clearTimeout(old);
      molasses.delete(ch.id);
    }

    interaction.editReply("Slowmode deactivated.");
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({ author: { name: interaction.member } })
        .setTitle("Channel Slowmode")
        .setDescription(`${interaction.member} disabled slowmode in ${ch}`)
        .setColor(0x00ff00)
        .setFooter({ text: old ? "" : "It's possible that the bot ran into an error while automatically resetting" })
    ] });
  } else {
    // Reset duration if already in slowmode
    const prev = molasses.get(ch.id);
    if (prev) clearTimeout(prev.timeout);

    const limit = prev ? prev.limit : ch.rateLimitPerUser;
    await ch.edit({ rateLimitPerUser: timer });

    molasses.set(ch.id, {
      timeout: setTimeout((channel, rateLimitPerUser) => {
        channel.edit({ rateLimitPerUser }).catch(error => u.errorHandler(error, "Reset rate limit after slowmode"));
        molasses.delete(channel.id);
      }, duration * 60000, ch, limit),
      limit
    });

    await interaction.editReply(`${timer}-second slowmode activated for ${duration} minute${duration > 1 ? 's' : ''}.`);
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("Channel Slowmode")
      .setDescription(`${interaction.member} set a ${timer}-second slow mode for ${duration} minute${duration > 1 ? 's' : ''} in ${ch}.`)
      .setColor(0x00ff00)
    ] });
  }
}

async function slashModSummary(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const time = interaction.options.getInteger("history") ?? 28;
  const e = await getSummaryEmbed(member, time, interaction.guild);
  await interaction.editReply({ embeds: [ e ] });
}

async function slashModTrust(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const member = interaction.options.getMember("user");
  const type = interaction.options.getString("type");
  const apply = interaction.options.getBoolean("apply") ?? true;

  const role = {
    'initial': sf.roles.trusted,
    'plus': sf.roles.trustedplus,
    'watch': sf.roles.untrusted
  }[type];
  const channel = {
    'initial': sf.channels.modlogs,
    'plus': sf.channels.modlogs,
    'watch': sf.channels.modlogsplus
  }[type];

  const embed = u.embed({ author: member });

  if (apply) {
    switch (type) {
    case 'initial':
      await c.trust(interaction, member);
      return;
    case 'plus':
      await c.trustPlus(interaction, member);
      return;
    case 'watch':
      if (member.roles.cache.has(sf.roles.untrusted)) {
        await interaction.editReply({ content: `${member} is already watched.` });
        return;
      }
      embed.setTitle("User Watch")
      .setDescription(`${member} (${member.displayName}) has been added to the watch list by ${interaction.member}. Use \`/mod trust watch @user false\` command to remove them.`);
      break;
    }

    await member.roles.add(role);
    await interaction.editReply({ content: `${member} has been given the <@&${role}> role!` });
  } else {
    switch (type) {
    case 'initial':
      if (!member.roles.cache.has(sf.roles.trusted)) {
        await interaction.editReply({ content: `${member} isn't trusted already.` });
        return;
      }
      await member.send(
        `You have been removed from "Trusted" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to post images. "
        + "Please remember to follow the Code of Conduct when posting images or links.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted Removed")
      .setDescription(`${interaction.member} untrusted ${member}.`);
      if (member.roles.cache.has(sf.roles.trustedplus)) {
        await member.roles.remove(sf.roles.trustedplus);
      }
      await member.roles.add(sf.roles.untrusted);
      break;
    case 'plus':
      if (!member.roles.cache.has(sf.roles.trustedplus)) {
        interaction.editReply({ content: `${member} isn't trusted+ already.` });
        return;
      }
      await member.send(
        `You have been removed from "Trusted+" in ${interaction.guild.name}. `
        + "This means you no longer have the ability to stream video in the server. "
        + "Please remember to follow the Code of Conduct.\n"
        + "<http://ldsgamers.com/code-of-conduct>"
      ).catch(() => blocked(member));
      embed.setTitle("User Trusted+ Removed")
      .setDescription(`${interaction.member} removed the <@&${role}> role from ${member}.`);
      break;
    case 'watch':
      if (!member.roles.cache.has(sf.roles.untrusted)) {
        await interaction.editReply({ content: `${member} isn't watched already.` });
        return;
      }
      embed.setTitle("User Unwatched")
      .setDescription(`${member} (${member.displayName}) has been removed from the watch list by ${interaction.member}. Use \`/mod trust watch @user true\` command to re-add them.`);
      break;
    }

    await member.roles.remove(role);
    await interaction.editReply({ content: `The <@&${role}> role has been removed from ${member}!` });
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
  await member.send(response).catch(() => blocked(member));

  const embed = u.embed({ author: member })
    .setColor("#0000FF")
    .setDescription(reason)
    .addField("Resolved", `${u.escapeText(interaction.user.username)} issued a ${value} point warning.`)
    .setTimestamp();
  const flag = await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });

  await Module.db.infraction.save({
    discordId: member.id,
    value: value,
    description: reason,
    message: interaction.id,
    flag: flag.id,
    channel: interaction.channel.id,
    mod: interaction.member.id
  });

  const summary = await Module.db.infraction.getSummary(member.id);
  embed.addField(`Infraction Summary (${summary.time} Days) `, `Infractions: ${summary.count}\nPoints: ${summary.points}`);

  flag.edit({ embeds: [embed] });
  await interaction.editReply(`${member} has been warned **${value}** points for reason \`${reason}\``);
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "mod",
  guildId: sf.ldsg,
  commandId: sf.commands.slashMod,
  permissions: p.isMod,
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
      case "ban":
        await slashModBan(interaction);
        break;
      case "filter":
        await slashModFilter(interaction);
        break;
      case "fullinfo":
        await slashModFullInfo(interaction);
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
