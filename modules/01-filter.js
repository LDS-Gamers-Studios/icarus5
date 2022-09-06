const Augur = require("augurbot"),
  banned = require("../data/banned.json"),
  Discord = require("discord.js"),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes"),
  c = require("../utils/modCommon");

const bannedWords = new RegExp(banned.words.join("|"), "i"),
  bannedLinks = new RegExp(`\\b(${banned.links.join("|").replaceAll(".", "\\.")})`, "i"),
  hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/,
  scamLinks = new RegExp(`\\b(${banned.scam.join("|").replaceAll(".", "\\.")})`, "i");

let pf = new profanityFilter();

const grownups = new Map(),
  processing = new Set();

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
    c.createFlag({ msg, member: msg.member, matches: filtered });
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
      c.createFlag({ msg, member: msg.member, matches: match, pingMods: true });
      return true;
    } else if (match = scamLinks.test(msg.cleanContent)) {
      // Scam Links
      u.clean(msg, 0);
      msg.reply({ content: "That link is generally believed to be a scam/phishing site. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member,
        matches: ["Suspected scam links (Auto-Removed)"].concat(match) });
      return true;
    } else if ((match = bannedWords.exec(msg.cleanContent)) && (link[0].toLowerCase().includes("tenor") || link[0].toLowerCase().includes("giphy"))) {
      // Bad gif link
      u.clean(msg, 0);
      msg.reply({ content: "Looks like that link might have some harsh language. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member,
        matches: ["Link Language (Auto-Removed)"].concat(match) });
      return true;
    } else if (!msg.webhookId && !msg.author.bot && !msg.member.roles.cache.has(sf.roles.trusted)) {
      // General untrusted link flag
      c.createFlag({ msg, member: msg.member, matches: "Links prior to being trusted" });
    }
  }

  // HARD LANGUAGE FILTER
  if (match = bannedWords.exec(msg.cleanContent)) {
    c.createFlag({ msg, member: msg.member, matches: match, pingMods: true });
    return true;
  }

  // SOFT LANGUAGE FILTER
  filter(msg, msg.cleanContent);

  for (const embed of msg.embeds) {
    const preview = [embed.author?.name ?? "", embed.title, embed.description].join("\n");
    let previewMatch;
    if (previewMatch = bannedWords.exec(preview)) {
      msg.reply({ content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false }).catch(u.noop);
      c.createFlag({ msg, member: msg.member, matches: ["Link preview language (Auto-Removed)"].concat(previewMatch) });
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
  const matched = msg.cleanContent.match(/(http(s)?:\/\/)?discord(\.gg(\/invite)?|app\.com\/invite|\.com\/invite)\/[\w-]+/ig);

  if (matched) {
    const foundInvites = matched.map(inv => bot.fetchInvite(inv.trim()));

    Promise.all(foundInvites).then((invites) => {
      if (invites.length > 0) {
        const external = invites.reduce((e, i) => (i && i.guild && (i.guild.id != sf.ldsg) ? e.concat(`Guild: ${i.guild.name}`, `Channel: ${i.channel.name}`) : e), ["External Discord Server Invite"]);
        if (external.length > 1) {
          if (msg.webhookId) {
            for (const invite of matched) msg.content = msg.content.replace(invite, "[Discord Invite]");
            u.clean(msg, 0);
            const embeds = [u.embed({ author: msg.author }).setDescription(msg.content)].concat(msg.embeds);
            return msg.channel.send({ embeds: embeds, attachments: msg.attachments });
          }
          c.createFlag({ msg, member: msg.member, matches: external });
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
        if (msg.webhookId) {
          for (const invite of matched) msg.content = msg.content.replace(invite, "[Discord Invite]");
          u.clean(msg, 0);
          const embeds = [u.embed({ author: msg.author }).setDescription(msg.content)].concat(msg.embeds);
          return msg.channel.send({ embeds: embeds, attachments: msg.attachments });
        }
        c.createFlag({ msg, member: msg.member, matches: "Unknown Discord Server Invite" });
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

    if (mod.id == infraction.discordId) {
      await interaction.reply({ content: "You can't handle your own flag!", ephemeral: true });
      return processing.delete(flag.id);
    }


    // NEED TO ADD RETRACTIONS

    if (interaction.customId == "modCardInfo") {
      // POST FULL INFO
      await interaction.deferReply();

      const member = await interaction.guild.members.fetch(infraction.discordId);

      let roleString = member.roles.cache.sort((a, b) => b.comparePositionTo(a)).map(role => role.name).join(", ");
      if (roleString.length > 1024) roleString = roleString.substr(0, roleString.indexOf(", ", 1000) + " ...");

      const userDoc = await Module.db.user.fetchUser(member);

      const infractionSummary = await Module.db.infraction.getSummary(member.id);
      let infractionDescription = [`**${member.toString()}** has had **${infractionSummary.count}** infraction(s) in the last **${infractionSummary.time}** days, totaling **${infractionSummary.points}** points.`];
      for (const record of infractionSummary.detail) {
        const recordMod = await interaction.guild.members.fetch(record.mod);
        infractionDescription.push(`${record.timestamp.toLocaleDateString()} (${record.value} pts, modded by ${recordMod?.toString() ?? "Some Unknown Mod"}): ${record.description}`);
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
      .addField("Resolved", `${mod.toString()} cleared the flag.`);
      embed.fields = embed.fields.filter(f => !f.name.startsWith("Jump"));

      await interaction.update({ embeds: [embed], components: [] });
    } else if (interaction.customId == "modCardLink") {
      // LINK TO #MODDISCUSSION
      const md = await interaction.client.channels.cache.get(sf.channels.moddiscussion);
      await interaction.reply({ content: `Sending the flag over to ${md}...`, ephemeral: true });

      embed.setFooter({ text: `Linked by ${u.escapeText(mod.displayName)}` });
      md.send({ embeds: [embed] }).catch(u.noop);
    } else {
      await interaction.deferUpdate();
      embed.setColor(0x0000FF);
      infraction.mod = mod.id;
      const member = interaction.guild.members.cache.get(infraction.discordId);

      switch (interaction.customId) {
      case "modCardVerbal":
        infraction.value = 0;
        embed.setColor(0x00FFFF).addField("Resolved", `${mod.toString()} issued a verbal warning.`);
        break;
      case "modCardMinor":
        infraction.value = 1;
        embed.addField("Resolved", `${mod.toString()} issued a 1 point warning.`);
        break;
      case "modCardMajor":
        infraction.value = 5;
        embed.addField("Resolved", `${mod.toString()} issued a 5 point warning.`);
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
        embed.addField("Resolved", `${mod.toString()} muted the member.`);
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
            `The LDSG Mods would like to speak with you about the following post. It may be that they're looking for some additional context or just want to handle things informally.\n\n**${mod.toString()}** will be reaching out to you shortly, if they haven't already.` :
            `We have received one or more complaints regarding content you posted. We have reviewed the content in question and have determined, in our sole discretion, that it is against our code of conduct (<https://ldsgamers.com/code-of-conduct>). This content was removed on your behalf. As a reminder, if we believe that you are frequently in breach of our code of conduct or are otherwise acting inconsistently with the letter or spirit of the code, we may limit, suspend or terminate your access to the LDSG Discord server.\n\n**${mod.toString()}** has issued this warning.`
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
.addInteractionHandler({ customId: "modCardLink", process: processCardAction })
.addEvent("filterUpdate", () => pf = new profanityFilter());

module.exports = Module;
