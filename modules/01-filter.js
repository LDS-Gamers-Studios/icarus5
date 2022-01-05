const Augur = require("augurbot"),
  banned = require("../data/banned.json"),
  Discord = require("discord.js"),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes"),
  { MessageActionRow, MessageButton } = require("discord.js");

const bannedWords = new RegExp(banned.words.join("|"), "i"),
  bannedLinks = new RegExp(`\\b(${banned.links.join("|").replaceAll(".", "\\.")})`, "i"),
  hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/,
  pf = new profanityFilter(),
  scamLinks = new RegExp(`\\b(${banned.scam.join("|").replaceAll(".", "\\.")})`, "i");

const grownups = new Map(),
  processing = new Set();

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
      title: `${member} has me blocked. *sadface*`
    })
  ] });
}

/**
 * Filter some text, warn if appropriate.
 * @param {Discord.Message} msg The message the text is associated with.
 * @param {String} text The text to scan.
 */
function filter(msg, text) {
  // PROFANITY FILTER
  const noWhiteSpace = text.toLowerCase().replace(/[.,/#!$%^&*;:{}=\-_`~"'()?|]/g, "").replace(/\s\s+/g, " ");
  const filtered = pf.scan(noWhiteSpace);
  if ((filtered.length > 0) && filtered[0] && (noWhiteSpace.length > 0)) {
    warnCard(msg, filtered);
    return true;
  } else { return false; }
}

/**
 * Process discord message language
 * @param {Discord.Message} old Original message
 * @param {Discord.Message} msg Edited message
 */
function processMessageLanguage(old, msg) {
  if (!msg) msg = old;
  if (msg.guild?.id != sf.ldsg) return false; // Only filter LDSG
  if (grownups.has(msg.channel.id)) return false; // Don't filter "Grown Up" channel
  if (msg.author.id == msg.client.user.id) return false; // Don't filter yourself

  processDiscordInvites(msg);

  let match = null;
  let link = null;
  // LINK FILTER
  if (link = hasLink.exec(msg.cleanContent)) {
    if (match = bannedLinks.exec(msg.cleanContent)) {
      // Naughty Links
      warnCard(msg, match, true);
      return true;
    } else if (match = scamLinks.test(msg.cleanContent)) {
      // Scam Links
      u.clean(msg, 0);
      msg.reply({ content: "That link is generally believed to be a scam/phishing site. Please be careful!", failIfNotExists: false }).catch(u.noop);
      warnCard(msg, ["Suspected scam links (Auto-Removed)"].concat(match));
      return true;
    } else if ((match = bannedWords.exec(msg.cleanContent)) && (link[0].toLowerCase().includes("tenor") || link[0].toLowerCase().includes("giphy"))) {
      // Bad gif link
      u.clean(msg, 0);
      msg.reply({ content: "Looks like that link might have some harsh language. Please be careful!", failIfNotExists: false }).catch(u.noop);
      warnCard(msg, ["Link Language (Auto-Removed)"].concat(match));
      return true;
    } else if (!msg.webhookId && !msg.author.bot && !msg.member.roles.cache.has(sf.roles.trusted)) {
      // General untrusted link flag
      warnCard(msg, "Links prior to being trusted");
    }
  }

  // HARD LANGUAGE FILTER
  if (match = bannedWords.exec(msg.cleanContent)) {
    warnCard(msg, match, true);
    return true;
  }

  // SOFT LANGUAGE FILTER
  filter(msg, msg.cleanContent);

  for (const embed of msg.embeds) {
    const preview = [embed.author?.name ?? "", embed.title, embed.description].join("\n");
    let previewMatch;
    if (previewMatch = bannedWords.exec(preview)) {
      msg.reply({ content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
      warnCard(msg, ["Link preview language (Auto-Removed)"].concat(previewMatch));
      u.clean(msg, 0);
      break;
    }
    if (filter(msg, preview)) {
      msg.reply({ content: "It looks like that link might have some language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
      msg.suppressEmbeds().catch(u.noop);
      break;
    }
  }
}

/**
 * Process Discord invites
 * @param {Discord.Message} msg Original message
 */
function processDiscordInvites(msg) {
  const bot = msg.client;
  let foundInvites = msg.cleanContent.match(/(http(s)?:\/\/)?discord(\.gg(\/invite)?|app\.com\/invite|\.com\/invite)\/[\w-]+/ig);

  if (foundInvites) {
    foundInvites = foundInvites.map(inv => bot.fetchInvite(inv.trim()));

    Promise.all(foundInvites).then((invites) => {
      if (invites.length > 0) {
        const external = invites.reduce((e, i) => (i && i.guild && (i.guild.id != sf.ldsg) ? e.concat(`Guild: ${i.guild.name}`, `Channel: ${i.channel.name}`) : e), ["External Discord Server Invite"]);
        if (external.length > 1) {
          warnCard(msg, external);
          u.clean(msg, 0);
          msg.channel.send({ embeds: [
            u.embed({
              description: "It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages."
            })
          ] });
        }
      }
    }).catch(e => {
      if (e && e.message == "Unknown Invite") {
        warnCard(msg, "Unknown Discord Server Invite");
        u.clean(msg, 0);
        msg.channel.send({ embeds: [
          u.embed({
            description: "It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages."
          })
        ] });
      } else { u.errorHandler(e, msg); }
    });
  }
}

/**
 * Generate and send a warning card in #mod-logs
 * @async
 * @function warnCard
 * @param {Discord.Message} msg The message for the warning.
 * @param {String|[String]} filtered The reason for the flag.
 * @param {Boolean} [call=false] Whether to ping the mods.
 */
async function warnCard(msg, filtered, call) {
  try {
    const infractionSummary = await Module.db.infraction.getSummary(msg.author);
    const embed = u.embed({ color: 0xff0000, author: msg.member, timestamp: (msg.editedAt ?? msg.createdAt) })
    .setDescription((msg.editedAt ? "[Edited]\n" : "") + msg.cleanContent)
    .setURL(msg.url);

    if (Array.isArray(filtered)) filtered = filtered.join(", ");
    if (filtered) embed.addField("Match", filtered);

    embed.addField("Channel", msg.channel?.toString(), true)
    .addField("Jump to Post", `[Original Message](${msg.url})`, true);

    // Minecraft Filter
    if (msg.channel.id == sf.channels.minecraftchat) {
      msg.client.channels.cache.get(sf.channels.minecraftmods).send({ embeds: [embed] });
    }

    embed.addField(`Infraction Summary (${infractionSummary.time} Days)`, `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}`);
    if (msg.author.bot) embed.setFooter("The user is a bot and the flag likely originated elsewhere. No action will be processed.");

    let content;

    if (call) {
      u.clean(msg, 0);
      const ldsg = msg.client.guilds.cache.get(sf.ldsg);
      content = [ldsg.roles.cache.get(sf.roles.mod).toString()];
      if (msg.author.bot) {
        content.push("The message has been deleted. The member was *not* muted, on account of being a bot.");
      } else {
        if (!msg.member.roles.cache.has(sf.roles.muted)) {
          await msg.member.roles.add(ldsg.roles.cache.get(sf.roles.muted));
          if (msg.member.voice.channel) {
            msg.member.voice.disconnect("Auto-mute");
          }
          ldsg.channels.cache.get(sf.channels.muted).send({
            content: `${msg.member}, you have been auto-muted in ${msg.guild.name}. Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct`,
            allowedMentions: { users: [msg.member.id] }
          });
        }
        content.push("The mute role has been applied and message deleted.");
      }
      content = content.join("\n");
    }

    const card = await msg.client.channels.cache.get(sf.channels.modlogs).send({
      content,
      embeds: [embed],
      components: (msg.author.bot ? undefined : modActions),
      allowedMentions: { roles: [sf.roles.mod] }
    });

    if (!msg.author.bot) {
      const infraction = {
        discordId: msg.author.id,
        channel: msg.channel.id,
        message: msg.id,
        flag: card.id,
        description: msg.cleanContent,
        mod: msg.client.user.id,
        value: 0
      };
      await Module.db.infraction.save(infraction);
    }

  } catch (error) { u.errorHandler(error, "Mod Card Reaction"); }
}

/**
 * Process the warning card
 * @async
 * @function processCardAction
 * @param {Discord.ButtonInteraction} interaction The interaction of a mod selecting the button.
 */
async function processCardAction(interaction) {
  try {
    const flag = interaction.message;
    // Prevent double-processing
    if (processing.has(flag.id)) {
      await interaction.reply({ content: "Someone is already processing this flag!", ephemeral: true });
      return;
    }
    processing.add(flag.id);

    const mod = interaction.member,
      embed = u.embed(flag.embeds[0]),
      infraction = await Module.db.infraction.getByFlag(flag);

    // NEED TO ADD RETRACTIONS

    if (interaction.customId == "modCardInfo") {
      // POST FULL INFO
      await interaction.deferReply();

      const member = await interaction.guild.members.fetch(infraction.discordId);

      let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
      if (roleString.length > 1024) roleString = roleString.substr(0, roleString.indexOf(", ", 1000) + " ...");

      const userDoc = await Module.db.user.fetchUser(member);

      const infractionSummary = await Module.db.infraction.getSummary(member.id);
      let infractionDescription = [`**${u.escapeText(member.displayName)}** has had **${infractionSummary.count}** infraction(s) in the last **${infractionSummary.time}** days, totaling **${infractionSummary.points}** points.`];
      for (const record of infractionSummary.detail) {
        const recordMod = await interaction.guild.members.fetch(record.mod);
        infractionDescription.push(`${record.timestamp.toLocaleDateString()} (${record.value} pts, modded by ${u.escapeText(recordMod?.displayName ?? "Some Unknown Mod")}): ${record.description}`);
      }

      infractionDescription = infractionDescription.join("\n");
      if (infractionDescription.length > 4050) infractionDescription = infractionDescription.substr(0, infractionDescription.indexOf("\n", 4000)) + "\n...";

      const infoEmbed = u.embed({ author: member })
      .setThumbnail(member.user.displayAvatarURL({ dynamic: true }))
      .setDescription(infractionDescription)
      .addField("ID", member.id, true)
      .addField("Activity", `Posts: ${parseInt(userDoc.posts, 10).toLocaleString()}`, true)
      .addField("Roles", roleString)
      .addField("Joined", member.joinedAt.toUTCString(), true)
      .addField("Account Created", member.user.createdAt.toUTCString(), true);

      interaction.editReply({ embeds: [infoEmbed] });
    } else if (interaction.customId == "modCardClear") {
      // IGNORE FLAG

      await Module.db.infraction.remove(flag);
      embed.setColor(0x00FF00)
      .addField("Resolved", `${u.escapeText(mod.displayName)} cleared the flag.`);
      embed.fields = embed.fields.filter(f => !f.name.startsWith("Jump"));

      await interaction.update({ embeds: [embed], components: [] });
    } else if (interaction.customId == "modCardLink") {
      // LINK TO #MODDISCUSSION
      const md = await interaction.client.channels.cache.get(sf.channels.moddiscussion);
      await interaction.reply({ content: `Sending the flag over to ${md}...`, ephemeral: true });

      embed.setFooter(`Linked by ${u.escapeText(mod.displayName)}`);
      md.send({ embeds: [embed] }).catch(u.noop);
    } else {
      await interaction.deferUpdate();
      embed.setColor(0x0000FF);
      infraction.mod = mod.id;
      const member = interaction.guild.members.cache.get(infraction.discordId);

      switch (interaction.customId) {
      case "modCardVerbal":
        infraction.value = 0;
        embed.setColor(0x00FFFF).addField("Resolved", `${u.escapeText(mod.displayName)} issued a verbal warning.`);
        break;
      case "modCardMinor":
        infraction.value = 1;
        embed.addField("Resolved", `${u.escapeText(mod.displayName)} issued a 1 point warning.`);
        break;
      case "modCardMajor":
        infraction.value = 5;
        embed.addField("Resolved", `${u.escapeText(mod.displayName)} issued a 5 point warning.`);
        break;
      case "modCardMute":
        infraction.value = 10;
        if (member && !member.roles.cache.has(sf.roles.muted)) {
          // Only mute if they weren't already muted.
          try {
            await member.roles.add([sf.roles.muted, sf.roles.untrusted]);
            if (member.voice.channel) await member.voice.disconnect("User mute").catch(u.noop);
            interaction.client.channels.cache.get(sf.channels.muted).send({
              content: `${member}, you have been muted in ${member.guild.name}. Please review our Code of Conduct. A member of the mod team will be available to discuss more details.\n\nhttp://ldsgamers.com/code-of-conduct`,
              allowedMentions: { users: [member.id] }
            }).catch(u.noop);
          } catch (error) { u.errorHandler(error, "Mute user via card"); }
        } else if (!member) {
          const roles = (await Module.db.user.fetchUser(infraction.discordId)).roles.concat(sf.roles.muted, sf.roles.untrusted);
          await Module.db.user.updateRoles({
            id: infraction.discordId,
            roles: {
              cache: new u.Collection(roles.map(r => ([r, r])))
            }
          });
        }
        embed.addField("Resolved", `${u.escapeText(mod.displayName)} muted the member.`);
        break;
      }
      await Module.db.infraction.update(infraction);
      const infractionSummary = await Module.db.infraction.getSummary(infraction.discordId);

      if (member) {
        const quote = u.embed({ author: member })
        .addField("Channel", `#${interaction.guild.channels.cache.get(infraction.channel).name}`)
        .setDescription(embed.description)
        .setTimestamp(flag.createdAt);

        const response = (
          (infraction.value == 0) ?
            `The LDSG Mods would like to speak with you about the following post. It may be that they're looking for some additional context or just want to handle things informally.\n\n**${mod.displayName}** will be reaching out to you shortly, if they haven't already.` :
            `We have received one or more complaints regarding content you posted. We have reviewed the content in question and have determined, in our sole discretion, that it is against our code of conduct (<https://ldsgamers.com/code-of-conduct>). This content was removed on your behalf. As a reminder, if we believe that you are frequently in breach of our code of conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n**${u.escapeText(mod.displayName)}** has issued this warning.`
        );

        member.send({ content: response, embeds: [quote] }).catch(() => blocked(member));
      }

      embed.fields = embed.fields.filter(f => !f.name || !f.name.startsWith("Jump"));
      embed.fields.find(f => f.name?.startsWith("Infraction")).value = `Infractions: ${infractionSummary.count}\nPoints: ${infractionSummary.points}`;

      await interaction.update({ embeds: [embed], components: [] }).catch(() => {
        interaction.message.edit({ embeds: [embed], components: [] }).catch((error) => u.errorHandler(error, interaction));
      });

      if (infraction.value > 0) {
        try {
          const msg = await interaction.guild.channels.cache.get(infraction.channel).messages.fetch(infraction.message);
          if (msg) u.clean(msg, 0);
        } catch (e) { u.noop(); }
      }
    }

    processing.delete(flag.id);
  } catch (error) { u.errorHandler(error, interaction); }
}

/********************
**  Filter Events  **
********************/
const Module = new Augur.Module()
.addEvent("messageCreate", processMessageLanguage)
.addEvent("messageUpdate", processMessageLanguage)
.addInteractionHandler({ customId: "modCardClear", process: processCardAction })
.addInteractionHandler({ customId: "modCardVerbal", process: processCardAction })
.addInteractionHandler({ customId: "modCardMinor", process: processCardAction })
.addInteractionHandler({ customId: "modCardMajor", process: processCardAction })
.addInteractionHandler({ customId: "modCardMute", process: processCardAction })
.addInteractionHandler({ customId: "modCardInfo", process: processCardAction })
.addInteractionHandler({ customId: "modCardLink", process: processCardAction });

module.exports = Module;
