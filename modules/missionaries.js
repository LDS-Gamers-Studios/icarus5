const Augur = require("augurbot"),
  schedule = require('node-schedule'),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  imaps = require('@klenty/imap'),
  { simpleParser } = require('mailparser'),
  discord = require('discord.js'),
  u = require("../utils/utils"),
  perms = require('../utils/perms'),
  _ = require('lodash'),
  config = require('../config/config.json'),
  sf = require("../config/snowflakes.json");

const privacyValues = [
  "any extremely personal details",
  "their name",
  "their face",
  "their name + face",
  "any pictures",
  "their name and any pictures"
];
const buttons = new discord.MessageActionRow().addComponents([
  new discord.MessageButton().setCustomId(`missionConfirm`).setEmoji('✅').setStyle('SUCCESS').setLabel("Post"),
  new discord.MessageButton().setCustomId(`missionRedact`).setEmoji('🔧').setStyle('PRIMARY').setLabel("Redact + Manual Post"),
  new discord.MessageButton().setCustomId(`missionCancel`).setEmoji('❌').setStyle('DANGER').setLabel("Discard")
]);

/**
 * @typedef email
 * @prop {string} discordId
 * @prop {string[]} emails
 * @prop {number} privacy
 */

/** @type {discord.Collection<string, email>}*/
let emailArray = new u.Collection();


const Module = new Augur.Module()
.addInteractionCommand({ name: "Missionary",
  commandId: sf.commands.slashMissionary,
  permissions: (int) => perms.isMod(int),
  process: async (interaction) => {
    const doc = new GoogleSpreadsheet(config.google.sheets.config);
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const missionaries = await doc.sheetsByTitle["Missionaries"].getRows();
    async function addMissionary() {
      const user = interaction.options.getMember('missionary');
      const emails = interaction.options.data[0].options.filter(o => o.type == 'STRING' && o.name.startsWith('email') && o.value).map(o => o.value);
      const privacy = interaction.options.getString('privacy');
      try {
        const existing = missionaries.find(x => x["Discord ID"] == user.id);
        if (existing) {
          existing["Emails"] = emails.join(' ');
          existing["Privacy"] = privacy;
          existing.save();
        } else {
          await doc.sheetsByTitle["Missionaries"].addRow({
            "Discord ID": user.id,
            "Emails": emails.join(' '),
            "Privacy": privacy
          });
        }
        emailArray.set(user.id, { discordId: user.id, emails, privacy });
        if (!user.roles.cache.has(sf.roles.missionary)) await user.roles.add(sf.roles.missionary);
        interaction.reply({ content: `${user} was added as a missionary. Emails will be recieved from ${emails.join(', ')}.\nPrivacy set to remove ${privacyValues[privacy]}.`, ephemeral: true });
      } catch (e) { u.errorHandler(e, interaction); }
    }
    async function removeMissionary() {
      const user = interaction.options.getMember('missionary');
      const existing = missionaries.find(x => x["Discord ID"] == user.id);
      if (!existing) return interaction.reply({ content: "That user isn't in our missionary database." });
      try {
        await existing.delete();
        emailArray.delete(user.id);
        if (user.roles.cache.has(sf.roles.missionary)) await user.roles.remove(sf.roles.missionary);
        return interaction.reply({ content: `Removed ${user} from the missionary database.` });
      } catch (e) { u.errorHandler(e, interaction); }
    }
    async function list() {
      const embed = u.embed().setTitle("Current Missionaries");
      if (missionaries.length > 0) embed.setDescription(missionaries.map(m => `<@${m['Discord ID']}> - Privacy: remove ${privacyValues[m['Privacy']]}`).join('\n'));
      else embed.setDescription("There aren't any missionaries serving right now.");
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }

    switch (interaction.options.getSubcommand()) {
    case "add": return addMissionary();
    case "remove": return removeMissionary();
    case "list": return list();
    }
  }
});

const fetchOptions = {
  bodies: ['HEADER', 'TEXT', ''],
  markSeen: false,
  struct: true
};
async function getEmails(client) {
  const connection = await imaps.connect({ imap: config.email });
  await connection.openBox('INBOX');
  const results = await connection.search(['UNSEEN', '1:5'], fetchOptions);
  let i = 0;
  if (results.length < 1) return;
  do {
    const item = results[i];
    const all = _.find(item.parts, { "which": "" });
    const idHeader = `Imap-Id: ${item.attributes.uid}\r\n`;
    const mail = await simpleParser(idHeader + all.body);
    const from = emailArray.find(email => email.emails.includes(mail.from.value[0].address));
    if (from) {
      const { subject, text, attachments, date } = mail;
      const ldsg = client.guilds.cache.get(sf.ldsg);
      const author = ldsg.members.cache.get(from.discordId);
      if (author.roles.cache.has(sf.roles.missionary)) {
        const embed = u.embed().setTitle(subject).setDescription(text).setTimestamp(date)
          .setAuthor({ name: author.displayName, iconURL: author.displayAvatarURL() })
          .addField("Privacy", `${author} has requested that you remove **${privacyValues[from.privacy]}** from this email. If there's anything to remove, please click the appropriate button and post manually. You may want to blur the faces of their companion in any pictures.`);
        const channel = ldsg.channels.cache.get(sf.channels.modlogs);
        if (attachments.length > 0) {
          const attach = [];
          for (const [, x] of attachments) if (attach.map(a => a.size).reduce((a, b) => a + b) + x.size < 104857600) attach.push(x);
          await channel.send({ embeds: [embed], files: attach.map(a => ({ attachment: a.content, name: a.filename })), components: [buttons] });
        }
      }
    }
    i++;
  } while (i < results.length);
}
Module.addEvent('ready', async () => {
  const enabled = true;
  if (!enabled) return;
  const rule = new schedule.RecurrenceRule();
  rule.hour = 12;
  rule.minute = 0;
  schedule.scheduleJob(rule, async function() {
    await getEmails(Module.client);
  });
})
.setInit(async () => {
  if (config.google.sheets.config && config.google.creds) {
    const doc = new GoogleSpreadsheet(config.google.sheets.config);
    try {
      await doc.useServiceAccountAuth(config.google.creds);
      await doc.loadInfo();
      const missionaries = await doc.sheetsByTitle["Missionaries"].getRows();
      emailArray = new u.Collection(missionaries.map(x => [x["Discord ID"], { discordId: x['Discord ID'], emails: x['Emails'].split(' '), privacy: x['Privacy'] }]));
    } catch (e) { u.errorHandler(e, "Load Missionary Info"); }
  }
})
.addEvent('interactionCreate', async (int) => {
  if (int.isButton() && int.customId.startsWith('mission')) {
    /** @type {discord.Message} */
    const msg = await int.message.fetch();
    if (int.customId == 'missionCancel') {
      return msg.delete();
    } else if (int.customId == 'missionRedact') {
      return msg.edit({ components: [], content: `Being redacted and manually posted by ${int.member}` });
    } else if (int.customId == 'missionConfirm') {
      const embed = msg.embeds[0];
      const fields = embed.fields.filter(f => f.name != 'Privacy');
      embed.setFields(fields);
      const attachments = msg.attachments;
      const sendChannel = int.client.channels.cache.get(sf.channels.missionaryemails);
      if (attachments?.size > 0) return sendChannel.send({ embeds: [embed], files: attachments });
      sendChannel.send({ embeds: [embed] });
    }
  }
});

module.exports = Module;
