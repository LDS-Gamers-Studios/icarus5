const Augur = require("augurbot"),
  config = require('../config/config.json'),
  p = require("../utils/perms"),
  u = require("../utils/utils"),
  { GoogleSpreadsheet } = require("google-spreadsheet"),
  sf = require("../config/snowflakes.json");

let sponsorChannels = new u.Collection();
const gSheets = config.google.sheets.config;
function isProSponsor(member) {
  return member.roles.cache.some(r => [sf.roles.legendarysponsor, sf.roles.prosponsor].includes(r.id)) ? member : null;
}

async function slashSponsorsCoolkid(int) {
  await int.deferReply({ ephemeral: true });

  const channelId = sponsorChannels.get(int.user.id);
  if (!isProSponsor(int.member)) return int.editReply({ content: "You need to be a Pro Sponsor or above to use this command!" });
  if (channelId == '') return int.editReply({ content: "Looks like you don't have a Pro Sponsor channel set up! Contact someone in Management to get started." });

  const channel = int.guild.channels.cache.get(channelId);
  const target = int.options.getUser("user", true);
  if (!channel) return int.editReply({ content: "I couldn't access your Pro Sponsor channel! Please talk to someone in Management about fixing this" });
  if (channel.permissionOverwrites.cache.get(target.id)) return int.editReply({ content: `${target} is already in the channel!` });

  try {
    await channel.permissionOverwrites.create(target, { 'VIEW_CHANNEL': true }, "Pro Sponsor Invite");
    channel?.send(`Welcome, ${target}!`);
    int.editReply({ content: `${target} was added to your Pro Sponsor channel!` });
  } catch (error) { u.errorHandler(error, int); }
}

async function slashSponsorsChannel(int) {
  await int.deferReply({ ephemeral: true });

  if (!p.isMgr(int.member) && !p.isMgmt(int.member)) return int.editReply({ content: "Only Managers and Management can use this command." });
  try {
    if (int.options.getUser('user').bot) return int.editReply({ content: "Bots can't have a Pro Sponsor channel!" });
    const sponsor = isProSponsor(int.options.getMember("user"));
    if (!sponsor) return int.editReply({ content: "That person isn't a Pro Sponsor or above!" });
    if (sponsorChannels.get(sponsor.id)) return int.editReply({ content: `${sponsor} already has a channel at ${int.guild.channels.cache.get(sponsorChannels.get(sponsor.id))}!` });

    const channel = await int.guild.channels.create(`${sponsor.displayName}-hangout`, {
      type: 'GUILD_TEXT',
      parent: sf.channels.prosponsorparent,
      permissionOverwrites: [
        { id: int.client.user.id, allow: "VIEW_CHANNEL" },
        { id: sf.roles.modoveride, allow: "VIEW_CHANNEL", deny: "SEND_MESSAGES" },
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

    await int.editReply({ content: `${sponsor}'s Pro Sponsor channel was created! ${gSheets ? "" : "I wasn't able to save it to the Google Sheet."}` });
    await channel.send(`${sponsor}, welcome to your private channel! Thank you for being a Pro Sponsor! Your contributions each month are very much appreciated! Please accept this channel as a token of our appreciation.\n\nYou should have some administrative abilities for this channel (including changing the name and description), as well as the ability to add people to the channel with \`/coolkid @user\`. If you would like to change default permissions for users in the channel, please contact a member of Management directly.`);
  } catch (e) {
    u.errorHandler(e, int);
  }
}

async function slashSponsorsUncoolkid(int) {
  await int.deferReply({ ephemeral: true });

  const channelId = sponsorChannels.get(int.user.id);
  if (!isProSponsor(int.member)) return int.editReply({ content: "You need to be a Pro Sponsor or above to use this command!" });
  if (channelId == '') return int.editReply({ content: "Looks like you don't have a Pro Sponsor channel set up! Contact someone in Management to get started." });

  const channel = int.guild.channels.cache.get(channelId);
  const target = int.options.getUser("user");
  if (!channel) return int.editReply({ content: "I couldn't access your Pro Sponsor channel! Please talk to someone in Management about fixing this." });
  if (target.id == int.member.id) return int.editReply({ content: "You can't remove yourself!" });
  if (target.id == int.client.user.id) return int.editReply({ content: "You can't get rid of me that easily!" });
  if (!channel.permissionOverwrites.cache.get(target.id)) return int.editReply({ content: `${target} isn't in this channel!` });

  try {
    await channel.permissionOverwrites.delete(target, "Pro Sponsor Boot");
    int.reply({ content: `${target} was removed from your Pro Sponsor channel` });
  } catch (error) { u.errorHandler(error, int); }
}
const Module = new Augur.Module()
.addInteractionCommand({ name: "sponsors",
  commandId: sf.commands.slashSponsors,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand()) {
    case "coolkid": return await slashSponsorsCoolkid(interaction);
    case "channel": return await slashSponsorsChannel(interaction);
    case "uncoolkid": return await slashSponsorsUncoolkid(interaction);
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
    sponsorChannels = new u.Collection(channels.map(x => [x["Sponsor ID"], x["Channel ID"]]));
  } catch (e) { u.errorHandler(e, "Load Sponsor Channels"); }
});

module.exports = Module;
