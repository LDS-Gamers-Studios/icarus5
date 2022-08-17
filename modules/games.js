const Augur = require("augurbot"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  eliteAPI = require('../utils/EliteApi'),
  discord = require('discord.js'),
  moment = require('moment'),
  chessAPI = new (require('chess-web-api'))({ queue: true }),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  sf = require('../config/snowflakes.json');
/** @type {discord.Collection<string, {id: string, game: string}>} */

let gameDefaults = new u.Collection();

/** @param {discord.CommandInteraction} int @param {string} game*/
function currentPlayers(int, game) {
  const players = int.guild.members.cache.map(m => {
    if (m.user.bot) return null;
    const presence = m.presence?.activities?.find(a => a.type == "PLAYING" && a.name.toLowerCase().startsWith(game.toLowerCase()));
    return presence ? `• ${m}` : null;
  }).filter(p => p != null).sort((a, b) => a.localeCompare(b));
  return u.embed().setTitle(`${int.guild.name} members currently playing ${game}`).setDescription(players.length > 0 ? players.join('\n') : `I couldn't find any members playing ${game}`);
}
const Module = new Augur.Module();
async function updateFactionStatus() {
  const channelID = sf.channels.elitedangerous;
  const channel = Module.client.channels.cache.get(channelID);
  try {
    const starSystem = await eliteAPI.getSystemInfo("LDS 2314").catch(u.noop);
    if (starSystem) {
      const faction = starSystem.factions.find(f => f.name === "LDS Enterprises");
      const influence = Math.round(faction.influence * 10000) / 100;

      // Discord has a topic size limit of 250 characters, but this will never pass that.
      const topic = `[LDS 2314 / LDS Enterprises]  Influence: ${influence}% - State: ${faction.state} - LDS 2314 Controlling Faction: ${starSystem.information.faction}`;

      channel.setTopic(topic);
    }
  } catch (e) { u.errorHandler(e, "Elite Channel Update Error"); }
}
/** @param {discord.CommandInteraction} int */
async function getPlaying(int) {
  const game = int.options.getString("game") ?? gameDefaults.get(int.channel.id)?.game;
  if (game) return int.reply({ embeds: [currentPlayers(int, game)], ephemeral: true });
  // List *all* games played
  const games = new u.Collection();
  for (const [, member] of int.guild.members.cache) {
    if (member.user.bot) continue;
    const playing = member.presence?.activities?.find(a => a.type == "PLAYING");
    if (playing && !games.has(playing.name)) games.set(playing.name, { game: playing.name, players: 0 });
    if (playing) games.get(playing.name).players++;
  }

  const gameList = games.sort((a, b) => {
    if (b.players == a.players) return a.game.localeCompare(b.game);
    else return b.players - a.players;
  }).toJSON();
  const s = gameList.length > 0 ? 's' : '';
  const embed = u.embed().setTimestamp()
    .setTitle(`Currently played game${s} in ${int.guild.name}`)
    .setDescription(`The top ${Math.min(gameList.length, 25)} game${s} currently being played in ${int.guild.name}:`);
  if (gameList.length > 0) gameList.map((g, i) => i < 25 ? embed.addFields({ name: g.game, value: `${g.players}` }) : null);
  else embed.setDescription("Well, this is awkward ... I couldn't find any games with more than one member playing.");
  int.reply({ embeds: [embed], ephemeral: true });
}
/** @param {discord.CommandInteraction} int */
async function chess(int) {
  const user = int.options.getMember('user');
  let name = int.options.getString('username');
  if (user) name = (await Module.db.ign.find(user.id, 'chess'))?.ign;
  else if (!name) name = (await Module.db.ign.find(int.user.id, 'chess'))?.ign;
  if (name) {
    try {
      let result = await chessAPI.getPlayerCurrentDailyChess(encodeURIComponent(name));
      const games = result.body.games;
      const getPlayer = /https:\/\/api\.chess\.com\/pub\/player\/(.*)$/;
      const embed = u.embed().setTitle(`Current Chess.com Games for ${name}`)
        .setThumbnail("https://openclipart.org/image/800px/svg_to_png/275248/1_REY_Blanco_Pieza-Mural_.png");
      let i = 0;
      for (const game of games) {
        embed.addField(`♙${getPlayer.exec(game.white)[1]} v ♟${getPlayer.exec(game.black)[1]}`, `Current Turn: ${(game.turn == "white" ? "♙" : "♟")}${getPlayer.exec(game[game.turn])[1]}\nMove By: ${moment(game.move_by).format("ddd h:mmA Z")}\n[[link]](${game.url})`, true);
        if (++i == 25) break;
      }
      if (games.length == 0) {
        result = await chessAPI.getPlayerStats(encodeURIComponent(name));
        if (result) {
          const daily = result.body["chess_daily"];
          const tactics = result.body["tactics"];
          const puzzle = result.body["puzzle_rush"]?.best;
          const toTime = (time) => `<t:${time}:F>`;
          const overall = daily?.record ? `Overall:\nWins: ${daily.record.win}\nLosses: ${daily.record.loss}\nDraws: ${daily.record.draw}\nTime Per Move: ${daily.record['time_per_move']}\n\n` : "";
          const latest = daily?.last ? `Latest:\nRating: ${daily.last.rating}\nDate: ${toTime(daily.last.date)}\n\n` : "";
          const best = daily?.best ? `Best:\nRating: ${daily.best.rating}\nDate: ${toTime(daily.best.date)}\n[Link](${daily.best.game})` : "";
          embed.setTitle(`Chess.com Stats for ${name}`)
            .addField("Chess Daily", (overall || latest || best) ? `${overall}${latest}${best}` : "No available stats")
            .addField("Puzzle Rush", puzzle ? `Total Attempts: ${puzzle["total_attempts"]}\nHigh Score: ${puzzle.score}` : "No available stats")
            .addField("Tactics", tactics ? `Highest Rating: ${tactics.highest.rating}\nLowest Rating: ${tactics.lowest.rating}` : "No available stats");
          return int.reply({ embeds: [embed] });
        }
      }
      if (games.length == 0) embed.setDescription(`No active games found for ${name}`);
      if (games.length > 25) embed.setDescription(`${name}'s first 25 active games:`);
      else embed.setDescription(`${name}'s active games:`);
      int.reply({ embeds: [embed] });
    } catch (error) {
      if (error.message == "Not Found" && error.statusCode == 404) {
        int.reply({ content: `I couldn't find a profile for \`${name}\`.`, ephemeral: true });
      } else { u.errorHandler(error, int); }
    }
  } else {
    int.reply({ content: "I couldn't find a saved IGN for them.", ephemeral: true });
  }
}
/** @param {discord.CommandInteraction} int */
async function elite(int) {
  const starSystem = int.options.getString('system-name') ? await eliteAPI.getSystemInfo(int.options.getString('system-name')) : null;
  const embed = u.embed().setThumbnail("https://i.imgur.com/Ud8MOzY.png").setAuthor({ name: "EDSM", iconURL: "https://i.imgur.com/4NsBfKl.png" });
  const getStatus = async () => {
    const status = await eliteAPI.getEliteStatus();
    return int.reply({ content: `The Elite: Dangerous servers are ${status.type == 'success' ? "online" : "offline"}`, ephemeral: true });
  };
  const getTime = async () => {
    const d = new Date();
    const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    return int.reply(`The current date/time in Elite is ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${(d.getUTCFullYear() + 1286)}, ${d.getUTCHours()}:${d.getUTCMinutes()}. (UTC + 1286 years)`);
  };
  const getSystem = async () => {
    if (!starSystem) return int.reply({ content: "I couldn't find a system with that name.", ephemeral: true });
    embed.setTitle(starSystem.name)
      .setURL(`https://www.edsm.net/en/system/id/${starSystem.id}/name`)
      .addField('Permit Required?', starSystem.requirePermit ? "Yes" : "No", true);
    if (starSystem.primaryStar)embed.addField("Star Scoopable", starSystem.primaryStar.isScoopable ? "Yes" : "No", true);

    if (starSystem.information) {
      embed.addField("Controlling Faction", starSystem.information.faction, true)
        .addField("Government Type", starSystem.information.allegiance + " - " + starSystem.information.government, true);
    } else {
      embed.addField("Uninhabited System", "No faction information available.", true);
    }
    return int.reply({ embeds: [embed] });
  };
  const getStations = async () => {
    if (!starSystem) return int.reply({ content: "I couldn't find a system with that name.", ephemeral: true });
    if (starSystem.stations.length <= 0) return int.reply({ content: "I couldn't find any stations in that system.", ephemeral: true });
    embed.setTitle(starSystem.name).setURL(starSystem.stationsURL);

    const stationList = new Map();
    for (let i = 0; i < Math.min(starSystem.stations.length, 25); i++) {
      const station = starSystem.stations[i];
      // Filtering out fleet carriers. There can be over 100 of them (spam) and their names are user-determined (not always clean).
      if (!["Fleet Carrier", "Unknown"].includes(station.type)) {
        if (!stationList.has(station.type)) stationList.set(station.type, []);
        stationList.get(station.type).push(station);
      }
    }

    for (const [stationType, stations] of stationList) {
      embed.addField(stationType, "-----------------------------");
      for (const station of stations) {
        const stationURL = `https://www.edsm.net/en/system/stations/id/starSystem.id/name/${starSystem.name}/details/idS/${station.id}/`;
        let faction = "No Faction";
        const distance = Math.round(station.distanceToArrival * 10) / 10;
        if (station.controllingFaction) {
          faction = station.controllingFaction.name;
        }
        embed.addField(faction, "[" + station.name + "](" + encodeURI(stationURL) + ")\n" + distance + " ls", true);
      }
    }

    // Letting the user know there were more than 25
    if (stationList.size > 25) embed.setFooter({ text: "Some stations were filtered out because the limit was exceeded.", iconURL: "https://i.imgur.com/vYPj8iX.png" });
    int.reply({ embeds: [embed] });
  };
  const getFactions = () => {
    if (!starSystem) return int.reply({ content: "I couldn't find a system with that name.", ephemeral: true });
    if (starSystem.factions.length < 1) return int.reply({ content: "I couldn't find any factions in that system.", ephemeral: true });
    embed.setTitle(starSystem.name).setURL(starSystem.factionsURL);

    for (const faction of starSystem.factions) {
      const influence = Math.round(faction.influence * 10000) / 100;
      const url = encodeURI(`https://www.edsm.net/en/faction/id/${faction.id}/name/`);
      embed.addField(faction.name + (starSystem.information && (faction.name === starSystem.information.faction) ? " (Controlling)" : "") + " " + influence + "%",
        "State: " + faction.state + "\nGovernment: " + faction.allegiance + " - " + faction.government + "\n[Link](" + url + ")", true);
    }
    return int.reply({ embeds: [embed] });
  };
  const getBodies = () => {
    if (!starSystem) return int.reply({ content: "I couldn't find a system with that name.", ephemeral: true });
    if (starSystem.bodies.length < 1) return int.reply({ content: "I couldn't find any bodies in that system.", ephemeral: true });
    embed.setTitle(starSystem.name).setURL(starSystem.bodiesURL);

    for (const body of starSystem.bodies) {
      const scoopable = body.type === "Star" ? (body.isScoopable ? " (Scoopable)" : " (Not Scoopable)") : "";
      const distance = Math.round(body.distanceToArrival * 10) / 10;
      embed.addField(body.name, body.type + scoopable + "\n" + distance + " ls", true);
    }
    return int.reply({ embeds: [embed] });
  };
  const info = int.options.getString('info');
  switch (info) {
  case "status": return getStatus();
  case "time": return getTime();
  case "bodies": return getBodies();
  case "factions": return getFactions();
  case "stations": return getStations();
  case "system": return getSystem();
  }
}
/** @param {discord.CommandInteraction} int */
async function minecraftSkin(int) {
  const user = int.options.getMember('user');
  let name = int.options.getString('username');
  if (user) name ??= await Module.db.ign.find(user.id ?? int.user.id, 'minecraft')?.ign;
  if (user && !name) return int.reply({ content: `${user} has not set a Minecraft name in their IGN`, ephemeral: true });
  if (!name) return int.reply({ content: "I need a discord user or username to look up.", ephemeral: true });
  const uuid = await eliteAPI.axiosRequest({ hostname: `https://api.mojang.com/users/profiles/minecraft/${name}` });
  if (!uuid?.id) return int.reply({ content: "I couldn't find that player", ephemeral: true });
  const skinUrl = `https://visage.surgeplay.com/full/512/${uuid.id}`;
  int.reply({ files: [{ attachment: skinUrl, name: `${name}.png` }] });
}

Module.addInteractionCommand({ name: "game",
  commandId: sf.commands.slashGames,
  process: async (int) => {
    switch (int.options.getSubcommand()) {
    case "chess": return chess(int);
    case "elite": return elite(int);
    case "minecraft-skin": return minecraftSkin(int);
    case "playing": return getPlaying(int);
    }
  }
})
.setInit(async () => {
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const channels = await doc.sheetsByTitle["Game Channels"].getRows();
    gameDefaults = new u.Collection(channels.map(x => [x["Channel ID"], { id: x["Channel ID"], game: x["Game Name"] }]));
  } catch (e) { u.errorHandler(e, "Load Game Channel Info"); }
})
.setClockwork(() => {
  try {
    // Every 6 hours seems alright for channel description updates. The rate limit is actually once every 5 minutes, so we're more than clear.
    return setInterval(updateFactionStatus, 6 * 60 * 60 * 1000);
  } catch (e) { u.errorHandler(e, "Elite Dangerous Clockwork Error"); }
})
.addEvent("ready", updateFactionStatus);

module.exports = Module;