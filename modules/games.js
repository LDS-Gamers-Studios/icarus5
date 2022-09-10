const Augur = require("augurbot"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  eliteAPI = require('../utils/EliteApi'),
  axios = require('axios'),
  discord = require('discord.js'),
  moment = require('moment'),
  perms = require('../utils/perms'),
  chessAPI = new (require('chess-web-api'))({ queue: true }),
  u = require("../utils/utils"),
  config = require('../config/config.json'),
  sf = require('../config/snowflakes.json');

/** @type {discord.Collection<string, {id: string, game: string}>} */
let gameDefaults = new u.Collection();

const Module = new Augur.Module();

/**
 * @param {discord.CommandInteraction} inter
 * @param {string} game
 */
function currentPlayers(inter, game) {
  const players = inter.guild.members.cache.map(m => {
    if (m.user.bot) return null;
    const presence = m.presence?.activities?.find(a => a.type == "PLAYING" && a.name.toLowerCase().startsWith(game.toLowerCase()));
    return presence ? `• ${m}` : null;
  }).filter(p => p != null).sort((a, b) => a.localeCompare(b));
  return u.embed().setTitle(`${inter.guild.name} members currently playing ${game}`).setDescription(players.length > 0 ? players.join('\n') : `I couldn't find any members playing ${game}`);
}

/** @param {discord.CommandInteraction} inter */
async function slashGetPlaying(inter) {
  const game = inter.options.getString("game") ?? gameDefaults.get(inter.channel.id)?.game;
  if (game) return inter.reply({ embeds: [currentPlayers(inter, game)], ephemeral: true });
  // List *all* games played
  const games = new u.Collection();
  for (const [, member] of inter.guild.members.cache) {
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
    .setTitle(`Currently played game${s} in ${inter.guild.name}`)
    .setDescription(`The top ${Math.min(gameList.length, 25)} game${s} currently being played in ${inter.guild.name}:`);
  if (gameList.length > 0) gameList.map((g, i) => i < 25 ? embed.addFields({ name: g.game, value: `${g.players}` }) : null);
  else embed.setDescription("Well, this is awkward ... Nobody is playing anything.");
  inter.reply({ embeds: [embed], ephemeral: true });
}

/** @param {discord.CommandInteraction} inter */
async function slashChess(inter) {
  const user = inter.options.getMember('user');
  let name = inter.options.getString('username');
  if (user) name = (await Module.db.ign.find(user.id, 'chess'))?.ign;
  else if (!name) name = (await Module.db.ign.find(inter.user.id, 'chess'))?.ign;
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
          return inter.reply({ embeds: [embed] });
        }
      }
      if (games.length == 0) embed.setDescription(`No active games found for ${name}`);
      if (games.length > 25) embed.setDescription(`${name}'s first 25 active games:`);
      else embed.setDescription(`${name}'s active games:`);
      inter.reply({ embeds: [embed] });
    } catch (error) {
      if (error.message == "Not Found" && error.statusCode == 404) {
        inter.reply({ content: `I couldn't find a profile for \`${name}\`.`, ephemeral: true });
      } else { u.errorHandler(error, inter); }
    }
  } else {
    inter.reply({ content: "I couldn't find a saved IGN for them.", ephemeral: true });
  }
}

async function eliteGetStatus() {
  const status = await eliteAPI.getEliteStatus();
  return { content: `The Elite: Dangerous servers are ${status.type == 'success' ? "online" : "offline"}`, ephemeral: true };
}

function eliteGetTime() {
  const d = new Date();
  const monthNames = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `The current date/time in Elite is ${monthNames[d.getUTCMonth()]} ${d.getUTCDate()}, ${(d.getUTCFullYear() + 1286)}, ${d.getUTCHours()}:${d.getUTCMinutes()}. (UTC + 1286 years)`;
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetSystem(system, embed) {
  if (!system) return { content: "I couldn't find a system with that name.", ephemeral: true };
  embed.setTitle(system.name)
    .setURL(`https://www.edsm.net/en/system/id/${system.id}/name`)
    .addField('Permit Required?', system.requirePermit ? "Yes" : "No", true);
  if (system.primaryStar)embed.addField("Star Scoopable", system.primaryStar.isScoopable ? "Yes" : "No", true);

  if (system.information) {
    embed.addField("Controlling Faction", system.information.faction, true)
      .addField("Government Type", system.information.allegiance + " - " + system.information.government, true);
  } else {
    embed.addField("Uninhabited System", "No faction information available.", true);
  }
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetStations(system, embed) {
  if (!system) return { content: "I couldn't find a system with that name.", ephemeral: true };
  if (system.stations.length <= 0) return { content: "I couldn't find any stations in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.stationsURL);

  const stationList = new Map();
  for (let i = 0; i < Math.min(system.stations.length, 25); i++) {
    const station = system.stations[i];
    // Filtering out fleet carriers. There can be over 100 of them (spam) and their names are user-determined (not always clean).
    if (!["Fleet Carrier", "Unknown"].includes(station.type)) {
      if (!stationList.has(station.type)) stationList.set(station.type, []);
      stationList.get(station.type).push(station);
    }
  }

  for (const [stationType, stations] of stationList) {
    embed.addField(stationType, "-----------------------------");
    for (const station of stations) {
      const stationURL = `https://www.edsm.net/en/system/stations/id/starSystem.id/name/${system.name}/details/idS/${station.id}/`;
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
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetFactions(system, embed) {
  if (!system) return { content: "I couldn't find a system with that name.", ephemeral: true };
  if (system.factions.length < 1) return { content: "I couldn't find any factions in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.factionsURL);

  for (const faction of system.factions) {
    const influence = Math.round(faction.influence * 10000) / 100;
    const url = encodeURI(`https://www.edsm.net/en/faction/id/${faction.id}/name/`);
    embed.addField(faction.name + (system.information && (faction.name === system.information.faction) ? " (Controlling)" : "") + " " + influence + "%",
      "State: " + faction.state + "\nGovernment: " + faction.allegiance + " - " + faction.government + "\n[Link](" + url + ")", true);
  }
  return { embeds: [embed] };
}

/**
 * @param {string} system
 * @param {discord.MessageEmbed} embed
 */
async function eliteGetBodies(system, embed) {
  if (!system) return { content: "I couldn't find a system with that name.", ephemeral: true };
  if (system.bodies.length < 1) return { content: "I couldn't find any bodies in that system.", ephemeral: true };
  embed.setTitle(system.name).setURL(system.bodiesURL);

  for (const body of system.bodies) {
    const scoopable = body.type === "Star" ? (body.isScoopable ? " (Scoopable)" : " (Not Scoopable)") : "";
    const distance = Math.round(body.distanceToArrival * 10) / 10;
    embed.addField(body.name, body.type + scoopable + "\n" + distance + " ls", true);
  }
  return { embeds: [embed] };
}

/** @param {discord.CommandInteraction} inter */
async function slashElite(inter) {
  const starSystem = inter.options.getString('system-name') ? await eliteAPI.getSystemInfo(inter.options.getString('system-name')) : null;
  const embed = u.embed().setThumbnail("https://i.imgur.com/Ud8MOzY.png").setAuthor({ name: "EDSM", iconURL: "https://i.imgur.com/4NsBfKl.png" });
  const info = inter.options.getString('info');
  let reply;
  if (!['status', 'time'].includes(info) && !inter.options.getString('system-name')) return inter.reply({ content: "You need to give me a system name to look up.", ephemeral: true });
  switch (info) {
  case "status": reply = await eliteGetStatus(); break;
  case "time": reply = eliteGetTime(); break;
  case "bodies": reply = await eliteGetBodies(starSystem, embed); break;
  case "factions": reply = await eliteGetFactions(starSystem, embed); break;
  case "stations": reply = await eliteGetStations(starSystem, embed); break;
  case "system": reply = await eliteGetSystem(starSystem, embed); break;
  }
  return inter.reply(reply);

}

/** @param {discord.CommandInteraction} inter */
async function slashMinecraftSkin(inter) {
  const user = inter.options.getMember('user') ?? inter.user;
  const name = inter.options.getString('username') || (await Module.db.ign.find(user?.id, 'minecraft'))?.ign;
  if (!name) return inter.reply({ content: `${user} has not saved an IGN for Minecraft`, ephemeral: true });
  try {
    const uuid = (await axios.get(`https://api.mojang.com/users/profiles/minecraft/${name}`))?.data;
    if (!uuid?.id) return inter.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
    const skinUrl = `https://visage.surgeplay.com/full/512/${uuid.id}`;
    inter.reply({ files: [{ attachment: skinUrl, name: `${name}.png` }] });
  } catch (error) {
    return inter.reply({ content: `I couldn't find the player \`${name}\`.`, ephemeral: true });
  }
}

/** @param {discord.CommandInteraction} inter */
async function slashDestiny(inter) {
  const setClan = async () => {
    if (!perms.isAdmin(inter) && !inter.member.roles.cache.hasAny([sf.roles.destinyclansadmin, sf.roles.destinyclansmanager])) return inter.reply({ content: `Only <@&${sf.roles.destinyclansadmin}> and above can use this command!`, ephemeral: true });
    const user = inter.options.getMember('user');
    const clan = inter.options.getString('clan');
    const remove = inter.options.getBoolean('remove') ?? false;
    if (!clan && !remove) return inter.reply({ content: `I need a clan to ${remove ? "remove them from" : "add them to!"}`, ephemeral: true });
    try {
      if (!remove) {
        const channel = inter.guild.channels.cache.get(sf.channels.destiny[clan]);
        const has = channel.permissionOverwrites.cache.has(user.id);
        if (!channel) return inter.reply({ content: "sorry, I couldn't fetch the right channel. Try again in a bit?", ephemeral: true });
        if (has) return inter.reply({ content: `${user} is already in that clan!`, ephemeral: true });
        await channel.permissionOverwrites.create(user, { "VIEW_CHANNEL": true });
        await channel.send(`Welcome to the clan, ${user}!`);
        return inter.reply({ content: `Added ${user} to the ${clan} clan!`, ephemeral: true });
      } else {
        const removed = [];
        if (clan) {
          const channel = inter.guild.channels.cache.get(sf.channels.destiny[clan]);
          const has = channel.permissionOverwrites.cache.has(user.id);
          if (!channel) return inter.reply({ content: "sorry, I couldn't fetch the right channel. Try again in a bit?", ephemeral: true });
          if (!has) return inter.reply({ content: `${user} isn't in that clan!`, ephemeral: true });
          await channel.permissionOverwrites.delete(user);
          removed.push(channel.toString());
        } else {
          for (const id in sf.channels.destiny) {
            const channel = inter.guild.channels.cache.get(sf.channels.destiny[id]);
            if (channel?.permissionOverwrites.cache.has(user.id)) {
              await channel.permissionOverwrites.delete(user);
              removed.push(channel.toString());
            }
          }
        }
        if (removed.length == 0) return inter.reply({ content: `${user} isn't in a clan!`, ephemeral: true });
        return inter.reply({ content: `Removed ${user} from the ${removed.join(', ')} clan(s).`, ephemeral: true });
      }
    } catch (error) {
      u.errorHandler(error, inter);
    }
  };
  const setValiant = async () => {
    if (!perms.isAdmin(inter) && !inter.member.roles.cache.hasAny([sf.roles.destinyclansmanager, sf.roles.destinyvaliantadmin])) return inter.reply({ content: `Only <@&${sf.roles.destinyvaliantadmin}> and above can use this command.`, ephemeral: true });
    const user = inter.options.getMember('user');
    const remove = inter.options.getBoolean('remove') ?? false;
    try {
      const has = user.roles.cache.has(sf.roles.destinyvaliant);
      if ((has && !remove) || (!has && remove)) return inter.reply({ content: `${user} ${remove ? "doesn't have the role yet." : "already has the role."}`, ephemeral: true });
      await user.roles[remove ? "remove" : "add"](sf.roles.destinyvaliant);
      return inter.reply({ content: `${user} was ${remove ? "removed from" : "added to"} the <@${sf.roles.destinyvaliant}> role`, ephemeral: true });
    } catch (error) {
      u.errorHandler(error, inter);
    }
  };
  switch (inter.options.getString('action')) {
  case "clan": return setClan();
  case "valiant": return setValiant();
  }
}

Module.addInteractionCommand({ name: "game",
  commandId: sf.commands.slashGame,
  process: async (inter) => {
    switch (inter.options.getSubcommand()) {
    case "chess": return slashChess(inter);
    case "destiny": return slashDestiny(inter);
    case "elite": return slashElite(inter);
    case "minecraft-skin": return slashMinecraftSkin(inter);
    case "playing": return slashGetPlaying(inter);
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
});

module.exports = Module;
