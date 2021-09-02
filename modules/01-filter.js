const Augur = require("augurbot"),
  banned = require("../data/banned.json"),
  profanityFilter = require("profanity-matcher"),
  u = require("../utils/utils");

const bannedWords = new RegExp(banned.words.join("|"), "i"),
  bannedLinks = new RegExp(`\\b(${banned.links.join("|").replaceAll(".", "\.")})`, "i"),
  hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/,
  pf = new profanityFilter(),
  scamLinks = new RegExp(`\\b(${banned.scam.join("|").replaceAll(".", "\.")})`, "i");

const grownups = new Map();

/**
 * Give the mods a heads up that someone isn't getting their DMs.
 * @param {GuildMember} member The guild member that's blocked.
 */
function blocked(member) {
  return member.client.channels.cache.get(Module.config.channels.modlogs).send({embeds: [
    u.embed({
      author: member,
      color: 0x00ffff,
      title: `${member} has me blocked. *sadface*`
    })
  ]});
}

/**
 * Filter some text, warn if appropriate.
 * @param {Discord.Message} msg The message the text is associated with.
 * @param {String} text The text to scan.
 */
function filter(msg, text) {
  // PROFANITY FILTER
  let noWhiteSpace = text.toLowerCase().replace(/[\.,\/#!$%\^&\*;:\{\}=\-_`~"'\(\)\?\|]/g,"").replace(/\s\s+/g, " ");
  let filtered = pf.scan(noWhiteSpace);
  if ((filtered.length > 0) && (noWhiteSpace.length > 0)) {
    warnCard(msg, filtered);
    return true;
  } else return false;
}

/**
 * Process discord message language
 * @param {Discord.Message} old Original message
 * @param {Discord.Message} msg Edited message
 */
function processMessageLanguage(old, msg) {
  if (!msg) msg = old;
  if (msg.guild?.id != Module.config.ldsg) return false;  // Only filter LDSG
  if (grownups.has(msg.channel.id)) return false;  // Don't filter "Grown Up" channel
  if (msg.author.id == msg.client.user.id) return false;  // Don't filter yourself

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
      msg.reply({content: "That link is generally believed to be a scam/phishing site. Please be careful!", failIfNotExists: false}).catch(u.noop);
      warnCard(msg, ["Suspected scam links (Auto-Removed)"].concat(match));
      return true;
    } else if ((match = bannedWords.exec(msg.cleanContent)) && (link[0].toLowerCase().includes("tenor") || link[0].toLowerCase().includes("giphy"))) {
      // Bad gif link
      u.clean(msg, 0);
      msg.reply({content: "Looks like that link might have some harsh language. Please be careful!", failIfNotExists: false}).catch(u.noop);
      warnCard(msg, ["Link Language (Auto-Removed)"].concat(match));
      return true;
    } else if (!msg.webhookId !msg.author.bot && !msg.member.roles.cache.has(Module.config.roles.trusted)) {
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

  for (let embed of msg.embeds) {
    let preview = [embed.author?.name ?? "", embed.title, embed.description].join("\n");
    let match;
    if (match = bannedWords.exec(preview)) {
      msg.reply({content: "It looks like that link might have some harsh language in the preview. Please be careful!", failIfNotExists: false}).catch(u.noop);
      warnCard(msg, ["Link preview language (Auto-Removed)"].concat(match));
      u.clean(msg, 0);
      break;
    }
    if (filter(msg, preview)) {
      msg.reply({content: "It looks like that link might have some language in the preview. Please be careful!", failIfNotExists: false}).catch(u.noop);
      msg.suppressEmbeds().catch(u.noop);
      break;
    }
  }
};

function processDiscordInvites(msg) {
  let bot = msg.client;
  let invites = msg.cleanContent.match(/(http(s)?:\/\/)?discord(\.gg(\/invite)?|app\.com\/invite|\.com\/invite)\/\w+/ig);

  if (invites) {
    let modLog = [];

    invites = invites.map(inv => bot.fetchInvite(inv.trim()));

    Promise.all(invites).then((invites) => {
      if (invites.length > 0) {
        let external = invites.reduce((e, i) => (i && i.guild && (i.guild.id != Module.config.ldsg) ? e.concat(`Guild: ${i.guild.name}`, `Channel: ${i.channel.name}`) : e), ["External Discord Server Invite"]);
        if (external.length > 1) {
          warnCard(msg, external);
          u.clean(msg, 0);
          msg.channel.send({embeds: [
            u.embed({
              description: "It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages."
            })
          ]});
        }
      }
    }).catch(e => {
      if (e && e.message == "Unknown Invite") {
        warnCard(msg, "Unknown Discord Server Invite");
        u.clean(msg, 0);
        msg.channel.send({embeds: [
          u.embed({
            description: "It is difficult to know what will be in another Discord server at any given time. *If* you feel that this server is appropriate to share, please only do so in direct messages."
          })
        ]});
      } else u.errorHandler(e, msg);
    });
  }
};

function processDiscordInvites() {};

async function warnCard() {};

async function processCardReaction(interaction) {};

/********************
**  Filter Events  **
********************/
const Module = new Augur.Module()
.addCommand({name: "grownups"})
.addEvent("messageCreate", processMessageLanguage)
.addEvent("messageUpdate", processMessageLanguage)
.addInteractionHandler({customId: "modCardInfo", process: processCardReaction})
.addInteractionHandler({customId: "modCardClear", process: processCardReaction})
.addInteractionHandler({customId: "modCardVerbal", process: processCardReaction})
.addInteractionHandler({customId: "modCardMinor", process: processCardReaction})
.addInteractionHandler({customId: "modCardMajor", process: processCardReaction})
.addInteractionHandler({customId: "modCardMute", process: processCardReaction})
.addInteractionHandler({customId: "modCardLink", process: processCardReaction});

module.exports = Module;
