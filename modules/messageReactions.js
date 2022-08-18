const Augur = require("augurbot"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes.json"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  config = require('../config/config.json');
const hasLink = /http(s)?:\/\/(\w+(-\w+)*\.)+\w+/,
  affiliateLinks = {
  // amazon: {
  //  site: "Amazon",
  //  affiliate: "Amazon Affiliate",
  //  test: /amazon\.(com|co\.uk)\/(\w+(\-\w+)*\/)?(gp\/product|dp)\/(\w+)/i,
  //  tag: /tag=ldsgamers\-20/,
  //  link: (match) =>`https://www.${match[0]}?tag=ldsgamers-20`
  // },
    cdkeys: {
      site: "CDKeys.com",
      affiliate: "CDKeys Affiliate",
      test: /cdkeys\.com(\/\w+(-\w+)*)*/i,
      tag: /mw_aref=LDSGamers/i,
      link: match => `https://www.${match[0]}?mw_aref=LDSGamers`
    },
    humblebundle: {
      site: "Humble Bundle",
      affiliate: "Humble Bundle Partner",
      test: /humblebundle\.com(\/\w+(-\w+)*)*/i,
      tag: /partner=ldsgamers/i,
      link: (match) => `https://www.${match[0]}?partner=ldsgamers`
    }
  };
function processLinks(msg) {
  for (const x in affiliateLinks) {
    const site = affiliateLinks[x];
    const match = site.test.exec(msg.cleanContent);
    if (match && !site.tag.test(msg.cleanContent)) {msg.channel.send(`You can help LDSG by using our ${site.affiliate} link: <${site.link(match)}>`);}
  }
}
function buttermelonEdit(msg) {
  const roll = Math.random();
  if (roll < 0.3 && !msg.author.bot) {
    if (msg.content.toLowerCase().includes("bananas")) {
      if (roll < 0.1) msg.channel.send({ files: ["https://cdn.discordapp.com/attachments/154625360514777088/239045323522179073/buttermelons.jpg"] }).catch(u.noop);
      else msg.channel.send("*buttermelons").catch(u.noop);
    } else if (msg.content.toLowerCase().includes("banana")) {
      if (roll < 0.06) msg.channel.send({ files: ["https://cdn.discordapp.com/attachments/136577505418018826/238764601951387648/buttermelon.jpg"] }).catch(u.noop);
      else if (roll < 0.1) msg.channel.send({ files: ["https://cdn.discordapp.com/attachments/96335850576556032/374995339997872128/YigaButtermelon_web.png"] }).catch(u.noop);
      else msg.channel.send("*buttermelon").catch(u.noop);
    }
  }
}
async function sponsorReaction(msg) {
  if (!msg.author.bot && msg.guild && msg.guild.id == sf.ldsg) {
    for (const [sponsor, emoji] of emojis) {
      if (msg.mentions.members.has(sponsor)) await msg.react(emoji).catch(u.noop);
      // Filter out sponsors and test for trigger words
      else if (!await msg.client.users.fetch(sponsor).catch(u.noop) && Math.random() < 0.3 && msg.content.toLowerCase().includes(sponsor)) await msg.react(emoji).catch(u.noop);
    }
  }
}
let emojis = [];
const Module = new Augur.Module()
.setInit(async () => {
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const channels = await doc.sheetsByTitle["Sponsor Channels"].getRows();
    emojis = Array.from(channels.map(x => [x["Sponsor ID"], x["Sponsor Emoji"]]));
    emojis = emojis.concat([
      ["buttermelon", "305039588014161921"],
      ["noice", "633500960483704843"],
      ["carp", "🐟"]
    ]);
  } catch (e) { u.errorHandler(e, "Load Sponsor Reactions"); }
})
.addEvent("messageCreate", async (msg) => {
  buttermelonEdit(msg);
  if (!msg.author.bot && hasLink.test(msg.cleanContent)) processLinks(msg);
  await sponsorReaction(msg);
})
.addEvent("messageUpdate", (oldMsg, msg) => {
  if (oldMsg.partial || !(oldMsg.cleanContent.toLowerCase().includes("banana"))) {buttermelonEdit(msg);}
  if (!msg.author.bot && hasLink.test(msg.cleanContent) && (oldMsg.partial || hasLink.test(oldMsg.cleanContent))) processLinks(msg);
})
.addEvent("messageReactionAdd", (reaction, user) => {
  if (!user.bot && (reaction.message.channel.id == sf.channels.gifsandmemes) && (reaction.emoji.name == "♻️")) {
    reaction.remove().then(() => {
      reaction.message.react("⭐").catch(u.noop);
    }).catch(u.noop);
  }
});
module.exports = Module;
