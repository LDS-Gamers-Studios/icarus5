const Augur = require("augurbot"),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  sf = require('../config/snowflakes.json'),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  perms = require('../utils/perms'),
  discord = require('discord.js');

/** @param {discord.CommandInteraction} int */
async function bracket(int) {
  const challonge = require("../utils/ChallongeAPI").init(config.api.challonge);
  const embed = u.embed().setTitle("Upcoming and Current LDSG Tournaments");
  await int.deferReply({ ephemeral: true });
  const responses = await Promise.all([
    challonge.getTournamentsIndex({ state: "pending", subdomain: "ldsg" }),
    challonge.getTournamentsIndex({ state: "in_progress", subdomain: "ldsg" })
  ]);

  const tournaments = responses.reduce((full, response) => full.concat(response), [])
    .sort((a, b) => (new Date(a.tournament.start_at)).valueOf() - (new Date(b.tournament.start_at).valueOf()));

  const displayTourneys = [];
  for (const tournament of tournaments) {
    let displayDate = (tournament.tournament.start_at ? new Date(tournament.tournament.start_at.substr(0, tournament.tournament.start_at.indexOf("T"))) : "Unscheduled");
    if (typeof displayDate != "string") displayDate = displayDate.toLocaleDateString("en-us");
    displayTourneys.push(`${displayDate}: [${tournament.tournament.name}](${tournament.tournament.full_challonge_url})`);
  }

  if (displayTourneys.length == 0) return int.editReply({ content: "Looks like there aren't any tourneys scheduled right now." });
  else embed.description = `\n\nCommunity Tournaments:\n${displayTourneys.join('\n')}`;
  int.editReply({ embeds: [embed] });
}
/** @param {discord.CommandInteraction} int */
async function champs(int) {
  const tName = int.options.getString('tourney-name');
  const user = (str) => int.options.getMember(str);
  const users = [user('1'), user('2'), user('3'), user('4'), user('5'), user('6')];
  const date = new Date(Date.now() + (3 * 7 * 24 * 60 * 60 * 1000)).valueOf().toString();
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  await doc.useServiceAccountAuth(config.google.creds);
  await doc.loadInfo();
  for (const member of users) {
    member.roles.add(sf.roles.champion);
    await doc.sheetsByTitle["Tourney Champions"].addRow({ "Tourney Name": tName, "User ID": member.id, "Take Role At": date });
  }
  const s = users.length > 1 ? 's' : '';
  int.guild.channels.cache.get(sf.channels.announcements).send(`Congratulations to our new tournament champion${s}, ${users.join(", ")}!\n\nTheir performance landed them the champion slot in the ${tName} tournament, and they'll hold on to the LDSG Tourney Champion role for a few weeks.`);
}
/** @param {discord.CommandInteraction} int */
async function participant(int) {
  const role = int.guild.roles.cache.get(sf.roles.tournamentparticipant);
  const clean = int.options.getBoolean('remove-all');
  const remove = int.options.getBoolean('remove');
  const user = int.options.getMember('user');
  let succeeded = 0;
  if (clean) {
    let i = 0;
    const members = role.members;
    while (i < members.size) {
      const member = members.at(i);
      try {
        await member.roles.remove(role.id);
        succeeded++;
      } catch (error) {null;}
      i++;
    }
    return int.reply({ content: `Removed ${succeeded}/${members.size} people from the ${role} role`, ephemeral: true });
  } else if (remove) {
    if (user.roles.cache.has(role.id)) {
      let content = `I removed the ${role} role from ${user}`;
      await user.roles.remove(role.id).catch(() => content = `I couldn't remove the ${role} role from ${user}`);
      return int.reply({ content, ephemeral: true });
    } else {
      return int.reply({ content: `${user} doesn't have the ${role} role`, ephemeral: true });
    }
  } else if (!user.roles.cache.has(role.id)) {
    let content = `I added the ${role} role to ${user}`;
    await user.roles.add(role.id).catch(() => content = `I couldn't add the ${role} role to ${user}`);
    return int.reply({ content, ephemeral: true });
  } else {
    return int.reply({ content: `${user} already has the ${role} role`, ephemeral: true });
  }
}
/** @param {discord.Client} client */
async function removeChampion(client) {
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  await doc.useServiceAccountAuth(config.google.creds);
  const fetched = await doc.sheetsByTitle["Tourney Champions"].getRows();
  const c = Array.from(fetched.map(x => ({ tourney: x["Tourney Name"], id: x["User ID"], takeTimestamp: x["Take Role At"] }))).filter(f => f.takeTimestamp < Date.now());
  for (const user of c) {
    const existing = fetched.find(x => x["User ID"] == user.id);
    await existing.delete().catch();
    const usr = client.guilds.cache.get(sf.ldsg).members.cache.get(user.id);
    if (usr.roles.cache.has(sf.roles.champion)) {
      await usr.roles.remove(sf.roles.champion).catch(() => {
        client.channels.cache.get(sf.channels.modlogs).send({ embeds: [
          u.embed().setTitle("Failed to remove Champion Role")
            .setDescription(`I couldn't remove the ${sf.roles.champion} role from ${usr}`)
            .setAuthor({ name: usr.displayName, iconURL: usr.displayAvatarURL() })
        ] });
      });
    }
  }
}
const Module = new Augur.Module()
.addInteractionCommand({ name: "tournament",
  commandId: sf.commands.slashTournament,
  permissions: (int) => int.options.getSubcommand() == 'list' ? true : perms.isTeam(int),
  process: async (int) => {
    switch (int.options.getSubcommand()) {
    case "list": return bracket(int);
    case "champion": return champs(int);
    case "participant": return participant(int);
    }
  }
})
.setClockwork(() => {
  setInterval(removeChampion, 24 * 60 * 60 * 1000, Module.client);
}, 1000);

module.exports = Module;