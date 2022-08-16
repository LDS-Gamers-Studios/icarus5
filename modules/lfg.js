const Augur = require("augurbot"),
  { GoogleSpreadsheet } = require('google-spreadsheet'),
  discord = require('discord.js'),
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

const Module = new Augur.Module()
.addInteractionCommand({ name: "playing",
  commandId: sf.commands.slashPlaying,
  process: async (int) => {
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

    let gameList = games.filter(g => g.players > 1)
      .sort((a, b) => {
        if (b.players == a.players) return a.game.localeCompare(b.game);
        else return b.players - a.players;
      }).toJSON();
    const s = gameList.length > 0 ? 's' : '';
    const embed = u.embed().setTimestamp()
      .setTitle(`Currently played game${s} in ${int.guild.name}`)
      .setDescription(`The top ${Math.min(gameList.length, 25)} game${s} currently being played in ${int.guild.name} (with more than one player):`);
    if (gameList.length > 0) gameList = gameList.map((g, i) => i < 25 ? embed.addFields({ name: g.game, value: `${g.players}` }) : null);
    else embed.setDescription("Well, this is awkward ... I couldn't find any games with more than one member playing.");
    int.reply({ embeds: [embed], ephemeral: true });
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