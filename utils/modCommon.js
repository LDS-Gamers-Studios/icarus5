const Discord = require("discord.js"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes.json"),
  { MessageActionRow, MessageButton } = require("discord.js");

const modActions = [
  new MessageActionRow().addComponents(
    new MessageButton().setCustomId("modCardClear").setEmoji("✅").setStyle("SUCCESS"),
    new MessageButton().setCustomId("modCardVerbal").setEmoji("🗣").setStyle("PRIMARY"),
    new MessageButton().setCustomId("modCardMinor").setEmoji("⚠").setStyle("DANGER"),
    new MessageButton().setCustomId("modCardMajor").setEmoji("⛔").setStyle("DANGER"),
    new MessageButton().setCustomId("modCardMute").setEmoji("🔇").setStyle("DANGER")
  ),
  new MessageActionRow().addComponents(
    new MessageButton().setCustomId("modCardInfo").setEmoji("👤").setLabel("User Info").setStyle("SECONDARY"),
    new MessageButton().setCustomId("modCardLink").setEmoji("🔗").setLabel("Link to Discuss").setStyle("SECONDARY")
  )
];

/**
  * Give the mods a heads up that someone isn't getting their DMs.
  * @param {Discord.GuildMember} member The guild member that's blocked.
  */
function blocked(member) {
  return member.client.channels.cache.get(sf.channels.modlogs).send({ embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      title: `${member.displayName} has me blocked. *sadface*`
    })
  ] });
}

function compareRoles(mod, target) {
  const modHigh = mod.roles.cache.filter(r => r.id != sf.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  const targetHigh = target.roles.cache.filter(r => r.id != sf.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  return (modHigh.comparePositionTo(targetHigh) > 0);
}

function nameGen() {
  const { names, colors, adjectives } = require("../data/nameParts.json");
  let result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names);
  while (result.length > 32) { result = u.rand(adjectives) + " " + u.rand(colors) + " " + u.rand(names); }
  return result;
}

const modCommon = {
  ban: async function(interaction, target, reason, days) {
    try {
      if (!compareRoles(interaction.member, target)) {
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
        interaction.client.db.infraction.save({
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
        interaction.client.db.user.updateRoles(fakeTarget);

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
  },

  /**
   * Generate and send a warning card in #mod-logs
   * @async
   * @function createFlag
   * @param {Discord.Message} flagInfo.msg The message for the warning.
   * @param {Discord.GuildMember} flagInfo.member The member for the warning.
   * @param {String|[String]} flagInfo.matches If automatic, the reason for the flag.
   * @param {Boolean} flagInfo.pingMods Whether to ping the mods.
   * @param {Discord.GuildMember} flagInfo.snitch The user bringing up the message.
   * @param {String} flagInfo.flagReason The reason the user is bringing it up.
   * @param {String} flagInfo.furtherInfo Where required, further information.
   */
  createFlag: async function(flagInfo) {
    const { msg } = flagInfo;
    let { member } = flagInfo;
    member = member ?? msg?.member ?? msg?.author;
    let { matches } = flagInfo;
    const { pingMods, snitch, flagReason, furtherInfo } = flagInfo;

    const client = msg.client ?? member?.client;

    const infractionSummary = await client.db.infraction.getSummary(member);
    const embed = u.embed({ color: 0xff0000, author: member });

    if (Array.isArray(matches)) matches = matches.join(", ");
    if (matches) embed.addField("Match", matches);

    if (msg) {
      embed.setTimestamp(msg.editedAt ?? msg.createdAt)
      .setDescription((msg.editedAt ? "[Edited]\n" : "") + msg.cleanContent)
      .addField("Channel", msg.channel?.toString(), true)
      .addField("Jump to Post", `[Original Message](${msg.url})`, true);
    }

    if (msg && msg.channel.parentId == sf.channels.minecraftcategory) {
      if (msg.webhookId) embed.addField("User", msg.author.username ?? (await msg.channel.fetchWebhooks()).get(msg.webhookId)?.name ?? "Unknown User");
      else embed.addField("User", (member.displayName ?? (await member.fetch()).displayName), true);
      client.channels.cache.get(sf.channels.minecraftmods).send({ embeds: [embed] });
    } else if (msg.webhookId) {
      if (msg.webhookId) embed.addField("User", msg.author.username);
    } else {
      embed.addField("User", member.toString(), true);
    }

    let content;
    if (snitch) {
      embed.addField("Flagged By", snitch.toString(), true)
      .addField("Reason", flagReason, true);
      if (furtherInfo) embed.addField("Further Information", furtherInfo, true);
    }

    embed.addField(`Infraction Summary (${infractionSummary.time} Days)`, `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}`);
    if (member.bot) embed.setFooter({ text: "The user is a bot and the flag likely originated elsewhere. No action will be processed." });

    if (pingMods) {
      u.clean(msg, 0);
      const ldsg = client.guilds.cache.get(sf.ldsg);
      content = [];
      if (!member.roles.cache.has(sf.roles.muted)) {
        content.push(ldsg.roles.cache.get(sf.roles.mod).toString());
      }
      if (member.bot) {
        content.push("The message has been deleted. The member was *not* muted, on account of being a bot.");
      } else {
        if (!member.roles?.cache.has(sf.roles.muted)) {
          await member.roles?.add(ldsg.roles.cache.get(sf.roles.muted));
          if (member.voice?.channel) {
            member.voice?.disconnect("Auto-mute");
          }
          ldsg.channels.cache.get(sf.channels.muted).send({
            content: `${member}, you have been auto-muted in ${msg.guild.name}. Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct`,
            allowedMentions: { users: [member.id] }
          });
        }
        content.push("The mute role has been applied and message deleted.");
      }
      content = content.join("\n");
    }

    const card = await client.channels.cache.get(sf.channels.modlogs).send({
      content,
      embeds: [embed],
      components: (member.bot || !msg ? undefined : modActions),
      allowedMentions: { roles: [sf.roles.mod] }
    });

    if (!member.bot && msg) {
      const infraction = {
        discordId: member.id,
        channel: msg?.channel.id,
        message: msg?.id,
        flag: card.id,
        description: msg?.cleanContent,
        mod: client.user.id,
        value: 0
      };
      await client.db.infraction.save(infraction);
    }
  },

  getSummaryEmbed: async function(member, time, guild) {
    const data = await member.client.db.infraction.getSummary(member.id, time);
    const response = [`**${member}** has had **${data.count}** infraction(s) in the last **${data.time}** day(s), totaling **${data.points}** points.`];
    if ((data.count > 0) && (data.detail.length > 0)) {
      data.detail = data.detail.reverse(); // Newest to oldest is what we want
      for (const record of data.detail) {
        const mod = guild.members.cache.get(record.mod) || `Unknown Mod (<@${record.mod}>)`;
        const pointsPart = record.value === 0 && mod.id !== member.client.user.id ? "Note" : `${record.value} pts`;
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

  kick: async function(interaction, target, reason) {
    try {
      if (!compareRoles(interaction.member, target)) {
        await interaction.editReply({
          content: `You have insufficient permissions to kick ${target}!`
        });
        return;
      } else if (!target.kickable) {
        await interaction.editReply({
          content: `I have insufficient permissions to kick ${target}!`
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
        interaction.client.db.infraction.save({
          discordId: target.id,
          description: `[User Kick]: ${reason}`,
          value: 30,
          mod: interaction.member.id
        });

        // Save roles
        targetRoles.set(sf.roles.untrusted, null).set(sf.roles.muted, null).delete(sf.roles.trusted);
        const fakeTarget = {
          id: target.id,
          roles: { cache: targetRoles }
        };
        interaction.client.db.user.updateRoles(fakeTarget);

        // Log it
        interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
          u.embed({ author: target })
          .setTitle("User Kick")
          .setDescription(`**${interaction.member}** kicked **${target}** for:\n${reason}`)
          .setColor(0x0000ff)
        ] });
      } else {
        // Never mind
        await interaction.editReply({
          embeds: [u.embed({ author: target }).setColor(0x0000ff).setDescription(`Kick ${confirm === false ? "cancelled" : "timed out"}`)],
          components: []
        });
      }
    } catch (error) { u.errorHandler(error, interaction); }
  },

  mute: async function(interaction, target, reason) {
    if (!target.manageable) {
      await interaction.editReply({
        content: `I have insufficient permissions to mute ${target}!`
      });
      return;
    }

    try {
      // Don't mute if muted
      if (target.roles.cache.has(sf.roles.muted)) {
        await interaction.editReply({
          content: `They are already muted.`,
        });
        return;
      }

      // muteState.set(target.id, target.voice.serverMute);

      // Impose Mute
      await target.roles.add(sf.roles.muted);
      if (target.voice.channel) {
        await target.voice.disconnect(reason);
        await target.voice.setMute(true, reason);
      }

      await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Mute")
        .setDescription(`**${interaction.member}** muted **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });

      await interaction.guild.channels.cache.get(sf.channels.muted).send(
        `${target}, you have been muted in ${interaction.guild.name}. `
      + 'Please review our Code of Conduct. '
      + 'A member of the mod team will be available to discuss more details.\n\n'
      + 'http://ldsgamers.com/code-of-conduct'
      );

      await interaction.editReply({
        content: `Muted ${target}.`,
      });
    } catch (error) { u.errorHandler(error, interaction); }
  },

  note: async function(interaction, target, note) {
    try {
      await interaction.client.db.infraction.save({
        discordId: target.id,
        value: 0,
        description: note,
        mod: interaction.user.id
      });
      const summary = await interaction.client.db.infraction.getSummary(target.id);

      await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setColor("#0000FF")
        .setDescription(note)
        .addField("Resolved", `${u.escapeText(interaction.user.username)} added a note.`)
        .addField(`Infraction Summary (${summary.time} Days)`, `Infractions: ${summary.count}\nPoints: ${summary.points}`)
        .setTimestamp()
      ] });

      await interaction.editReply({ content: `Note added for user ${target.toString()}.` });
    } catch (error) { u.errorHandler(error, interaction); }
  },

  rename: async function(interaction, target) {
    const newNick = interaction.options?.getString("name") || nameGen();
    const oldNick = target.displayName;

    if (!target.manageable) {
      await interaction.editReply(`I have insufficient permissions to rename ${target}!`);
      return;
    }
    await target.setNickname(newNick);

    const comment = `Set nickname to ${u.escapeText(newNick)} from ${u.escapeText(oldNick)}.`;

    await interaction.client.db.infraction.save({
      discordId: target.id,
      value: 0,
      description: comment,
      message: interaction.id,
      channel: interaction.channel.id,
      mod: interaction.member.id
    });
    const summary = await interaction.client.db.infraction.getSummary(target.id);

    interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({ author: target })
      .setColor("#0000FF")
      .setDescription(comment)
      .addField("Resolved", `${interaction.member} changed ${target}'s nickname from ${u.escapeText(oldNick)} to ${u.escapeText(newNick)}.`)
      .addField(`Infraction Summary (${summary.time} Days) `, `Infractions: ${summary.count}\nPoints: ${summary.points}`)
      .setTimestamp()
    ] });

    await interaction.editReply({ content: `${target}'s nickname changed from ${u.escapeText(oldNick)} to ${u.escapeText(newNick)}.` });
  },

  timeout: async function(interaction, target, reason) {
    // Log it
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
      u.embed({ author: interaction.member })
      .setTitle("User Timeout")
      .setDescription(`**${interaction.member}** timed out ${target}`)
      .addField('Reason', reason)
      .setColor(0x00ff00)
    ] });

    // Do it
    await target.timeout(10 * 60 * 1000, reason);
  },

  trust: async function(interaction, target) {
    if (target.roles.cache.has(sf.roles.trusted)) {
      interaction.editReply({ content: `${target} is already trusted.` });
      return;
    }

    target.send(
      `You have been marked as "Trusted" in ${interaction.guild.name} . `
      + "This means you are now permitted to post images and links in chat. "
      + "Please remember to follow the Code of Conduct when doing so.\n"
      + "<http://ldsgamers.com/code-of-conduct>\n\n"
      + "If you'd like to join one of our in-server Houses, you can visit <http://3houses.live> to get started!"
    ).catch(() => blocked(target));

    const embed = u.embed({ author: target })
    .setTitle("User Given Trusted")
    .setDescription(`${interaction.member} trusted ${target}.`);
    if (target.roles.cache.has(sf.roles.untrusted)) {
      await target.roles.remove(sf.roles.untrusted);
    }

    await target.roles.add(sf.roles.trusted);
    await interaction.editReply({ content: `${target} has been given the <@&${sf.roles.trusted}> role!` });
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
  },

  trustPlus: async function(interaction, target) {
    if (target.roles.cache.has(sf.roles.trustedplus)) {
      await interaction.editReply({ content: `${target} is already trusted+.` });
      return;
    }
    if (!target.roles.cache.has(sf.roles.trusted)) {
      await interaction.editReply({ content: `${target} needs <@&${sf.roles.trusted}> before they can be given <@&${sf.roles.trustedplus}>!` });
      return;
    }
    target.send(
      "Congratulations! "
      + "You've been added to the Trusted+ list in LDSG, allowing you to stream to voice channels!\n\n"
      + "While streaming, please remember the Streaming Guidelines ( https://goo.gl/Pm3mwS ) and LDSG Code of Conduct ( http://ldsgamers.com/code-of-conduct ). "
      + "Also, please be aware that LDSG may make changes to the Trusted+ list from time to time at its discretion."
    ).catch(u.noop);

    const embed = u.embed({ author: target })
    .setTitle("User Given Trusted+")
    .setDescription(`${interaction.member} gave ${target} the <@&${sf.roles.trustedplus}> role.`);

    await target.roles.add(sf.roles.trustedplus);
    await interaction.editReply({ content: `${target} has been given the <@&${sf.roles.trustedplus}> role!` });
    await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
  },

  unmute: async function(interaction, target) {
    try {
      // Don't unmute if not muted
      if (!target.roles.cache.has(sf.roles.muted)) {
        await interaction.editReply({
          content: `${target} isn't muted.`,
        });
        return;
      }

      // Remove Mute
      await target.roles.remove(sf.roles.muted);
      if (target.voice.channel /* && !muteState.get(target.id)*/) await target.voice.setMute(false, "Mute resolved");
      // muteState.delete(target.id);

      await interaction.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("Member Unmute")
        .setDescription(`**${interaction.member}** unmuted **${target}**`)
        .setColor(0x00ff00)
      ] });

      await interaction.editReply({
        content: `Unmuted ${target}.`,
      });
    } catch (error) { u.errorHandler(error, interaction); }
  }
};

module.exports = modCommon;
