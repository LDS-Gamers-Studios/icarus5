const Augur = require("augurbot"),
  config = require('../config/config.json'),
  u = require("../utils/utils"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  sf = require("../config/snowflakes.json");

let sponsorChannels = new u.Collection();
const gSheets = config.google.sheets.config;
function isProSponsor(member) {
  return member.roles.cache.some(r => [sf.roles.legendarysponsor, sf.roles.prosponsor].includes(r.id)) ? member : null;
}

async function coolkids(int) {
  const channel = int.guild.channels.cache.get(sponsorChannels.get(int.user.id));
  const target = int.options.getUser("user", true);
  if (sponsorChannels.get(int.user.id) == '') return int.reply({ content: "Looks like you don't have a Pro Sponsor channel set up! Contact someone in Management to get started." });
  if (!sponsorChannels.get(int.user.id)) return int.reply({ content: "You need to be a Pro Sponsor or above to use this command!", ephemeral: true });
  if (!channel) return int.reply({ content: "I couldn't access your Pro Sponsor channel! Please talk to someone in Management about fixing this" });
  if (channel.permissionOverwrites.cache.get(target.id)) return int.reply({ content: `${target} is already in the channel!`, ephemeral: true });
  try {
    await channel.permissionOverwrites.create(target, { 'VIEW_CHANNEL': true }, "Pro Sponsor Invite");
    channel?.send(`Welcome, ${target}!`);
    int.reply({ content: `${target} was added to your Pro Sponsor channel!`, ephemeral: true });
  } catch (error) { u.errorHandler(error, int); }
}

async function sponsorchannel(int) {
  await int.deferReply({ ephemeral: true });
  if (!int.member.roles.cache.has(sf.roles.management, sf.roles.manager)) return int.editReply({ content: "Only Managers and Management can use this command", ephemeral: true });
  try {
    const sponsor = isProSponsor(int.options.getMember("user"));
    if (!sponsor) return int.editReply({ content: "That person isn't a pro sponsor or above!", ephemeral: true });
    if (sponsorChannels.get(sponsor.id)) return int.editReply({ content: `${sponsor} already has a channel at ${int.guild.channels.cache.get(sponsorChannels.get(sponsor.id))}!`, ephemeral: true });

    const channel = await int.guild.channels.create(`${sponsor.displayName}-hangout`, {
      type: 'GUILD_TEXT',
      parent: sf.channels.prosponsorparent,
      permissionOverwrites: [
        { id: int.client.user.id, allow: "VIEW_CHANNEL" },
        { id: sf.ldsg, deny: "VIEW_CHANNEL" },
        { id: sponsor.id, allow: ["VIEW_CHANNEL", "MANAGE_CHANNELS", "MANAGE_MESSAGES", "MANAGE_WEBHOOKS"] },
      ],
      reason: "Sponsor Perk"
    });

    sponsorChannels.set(sponsor.id, channel.id);
    if (gSheets) {
      try {
        const doc = new GoogleSpreadsheet(gSheets);
        await doc.useServiceAccountAuth(config.google.creds);
        await doc.loadInfo();
        const existing = (await doc.sheetsByTitle["Sponsor Channels"].getRows()).find(x => x["Sponsor ID"] == sponsor.id);
        if (existing) {
          existing["Channel ID"] = channel.id;
          existing.save();
        } else {
          await doc.sheetsByTitle["Sponsor Channels"].addRow({
            "Sponsor Name": sponsor.displayName,
            "Sponsor ID": sponsor.id,
            "Channel ID": channel.id
          });
        }
      } catch (e) { u.errorHandler(e, "Modify Sponsor Channels");}
    }

    await int.editReply({ content: `${sponsor}'s Pro Sponsor channal was created! ${gSheets ? "" : "(I wasn't able to save it to the google sheet)"}` });
    await channel.send(`${sponsor}, welcome to your private channel! Thank you for being a Pro Sponsor! Your contributions each month are very much appreciated! Please accept this channel as a token of our appreciation.\n\nYou should have some administrative abilities for this channel (including changing the name and description), as well as the ability to add people to the channel with \`/coolkid @user\`. If you would like to change default permissions for users in the channel, please contact a member of Management directly.`);
  } catch (e) {
    u.errorHandler(e, int);
  }
}

async function uncoolkids(int) {
  if (sponsorChannels.get(int.user.id) == '') return int.reply({ content: "Looks like you don't have a Pro Sponsor channel set up! Contact someone in Management to get started." });
  if (!sponsorChannels.get(int.user.id)) return int.reply({ content: "You need to be a Pro Sponsor or above to use this command!", ephemeral: true });
  if (!channel) return int.reply({ content: "I couldn't access your Pro Sponsor channel! Please talk to someone in Management about fixing this" });
  const channel = int.guild.channels.cache.get(sponsorChannels.get(int.member.id));
  const target = int.options.getUser("user");
  if (target.id == int.member.id) return int.reply({ content: "You can't remove yourself!", ephemeral: true });
  if (target.id == int.client.user.id) return int.reply({ content: "You can't get rid of me that easily!", ephemeral: true });
  if (!channel.permissionOverwrites.cache.get(target.id)) return int.reply({ content: `${target} isn't in this channel!`, ephemeral: true });
  try {
    await channel.permissionOverwrites.delete(target, "Pro Sponsor Boot");
    int.reply({ content: `${target} was removed from your Pro Sponsor channel`, ephemeral: true });
  } catch (error) { u.errorHandler(error, int); }
}
const Module = new Augur.Module()
.addInteractionCommand({ name: "sponsors",
  commandId: sf.commands.slashSponsors,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand()) {
    case "coolkids": return await coolkids(interaction);
    case "channel": return await sponsorchannel(interaction);
    case "uncoolkids": return await uncoolkids(interaction);
    }
  }
})
.setInit(async () => {
  if (!config.google.sheets.config) return;
  const doc = new GoogleSpreadsheet(gSheets);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const channels = await doc.sheetsByTitle["Sponsor Channels"].getRows();
    sponsorChannels = new u.Collection().set(channels.map(x => [x["Sponsor ID"], x["Channel ID"]]));
  } catch (e) { u.errorHandler(e, "Load Sponsor Channels"); }
});

module.exports = Module;