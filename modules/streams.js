const Augur = require("augurbot"),
  u = require("../utils/utils"),
  mC = require("../utils/modCommon"),
  perms = require('../utils/perms'),
  discord = require('discord.js'),
  config = require("../config/config.json"),
  sf = require("../config/snowflakes.json"),
  fs = require("fs"),
  { ApiClient, HelixStream, HelixUser } = require("@twurple/api"),
  { ClientCredentialsAuthProvider } = require('@twurple/auth'),
  yaml = require("js-yaml"),
  gamesDBApi = require("../utils/thegamesdb.js"),
  Youtube = require("../utils/youtubeAPI");
let ytCycle = 0;
const gamesDB = new gamesDBApi(),
  yt = new Youtube(config.google.youtube);

const ldsgYT = 'UCr83QWCwQRUqhSCyQL_kx2Q';
const extraLife = (new Date().getMonth() == 10),
  extraLifeApi = require("../utils/extraLifeAPI").set({ teamId: 56862, participantId: 453772 }),
  applicationCount = 0;
/**
 * @typedef status
 * @property {string} url
 * @property {string} name
 * @property {string} title
 * @property {string|null} gameId
 * @property {"online"|"offline"} status
 * @property {Date} since
 */
const authProvider = new ClientCredentialsAuthProvider(config.twitch.clientId, config.twitch.clientSecret),
  twitch = new ApiClient({ authProvider }),
  games = new Map(),
  /** @type {discord.Collection<string, status>} */
  twitchStatus = new u.Collection(),
  /** @type {discord.Collection<string, status>} */
  youtubeStatus = new u.Collection(),
  bonusStreams = require("../data/streams.json");
function ytURL(id) {
  return `https://youtube.com/watch?v=${id}`;
}
function tURL(id) {
  return `https://www.twitch.tv/${id}`;
}
/** @param {string} gameId */
async function gameInfo(gameId, ytPlat = false) {
  if (games.has(gameId)) return games.get(gameId);
  let game = await twitch.games.getGameById(gameId).catch(u.noop);
  if (ytPlat) game = { id: gameId, name: gameId, boxArtUrl: null };
  if (game?.id) {
    games.set(game.id, game);
    const ratings = (await gamesDB.byGameName(game.name, { fields: "rating" }).catch(u.noop))
      ?.games?.filter(g => g.game_title.toLowerCase() == game.name.toLowerCase() && g.rating != "Not Rated");
    games.get(game.id).rating = ratings?.[0]?.rating;
    return games.get(game.id);
  }
}

async function extraLifeEmbed() {
  try {
    const streams = await fetchExtraLifeStreams();

    if (streams?.data?.length > 0) {
      const channels = streams.data.map(stream => {
        const game = games.get(stream.gameId)?.name;
        return {
          name: stream.userDisplayName,
          game,
          service: "Twitch",
          title: stream.title,
          url: tURL(stream.userDisplayName)
        };
      }).sort((a, b) => a.name.localeCompare(b.name));
      const addField = (i, embed) => {
        const channel = channels[i];
        embed.addField(channel.name + (channel.game ? ` playing ${channel.game}` : ""), `[${channel.title}](${channel.url})`);
      };
      const embed = u.embed().setColor(0x7fd836).setTitle("Live from the Extra Life Team!");
      return u.multiEmbed(addField, channels.length, embed);
    }
  } catch (error) { u.errorHandler(error, "Extra Life Stream Fetch"); }
}

async function fetchExtraLifeStreams(team) {
  try {
    if (!team) team = await fetchExtraLifeTeam().catch(u.noop);
    if (!team) return null;
    const userName = team.participants.filter(m => m.links.stream).map(member => member.links.stream.replace("https://player.twitch.tv/?channel=", ""))
        .filter(channel => !(channel.includes(" ") || channel.includes("/")));
    const streams = await twitch.streams.getStreams({ userName }).catch(u.noop);
    return streams;
  } catch (error) { u.errorHandler(error, "Fetch Extra Life Streams"); }
}

async function fetchExtraLifeTeam() {
  try {
    const team = await extraLifeApi.getTeamWithParticipants().catch(u.noop);
    const donations = await extraLifeApi.getTeamDonations().catch(u.noop);

    if (donations) {
      const file = require("../data/extraLifeDonors.json");
      const donors = new Set(file.donors);
      const donationIDs = new Set(file.donationIDs);
      let update = false;

      for (const donation of donations) {
        if (!donationIDs.has(donation.donationID)) {
          donationIDs.add(donation.donationID);
          update = true;

          if (donation.displayName && !donors.has(donation.displayName)) {
            donors.add(donation.displayName);
            Module.client.channels.cache.get(sf.channels.extralifediscussion).send({
              embed: u.embed().setColor(0x7fd836)
                .setTitle("New Extra Life Donor(s)!")
                .setThumbnail("https://assets.donordrive.com/extralife/images/$event550$/facebookImage.png")
                .setDescription(donation.displayName)
                .setTimestamp(new Date(donation.createdDateUTC))
            });
          }

          const embed = u.embed()
            .setAuthor({ name: `Donation From ${donation.displayName || "Anonymous Donor"}`, iconURL: donation.avatarImageURL })
            .setDescription(donation.message || "[ No Message ]")
            .addField("Amount", `$${donation.amount}`, true)
            .addField("Recipient", donation.recipientName, true)
            .addField("Incentive", donation.incentiveID || "[ None ]", true)
            .setColor(donation.participantID == extraLifeApi.participantId || donation.message?.toLowerCase().includes("#ldsg") ? 0x7fd836 : 0x26c2eb)
            .setTimestamp(new Date(donation.createdDateUTC));
          Module.client.channels.cache.get(sf.channels.extralifediscussion).send({ embeds: [embed] });
        }
      }
      if (update) {
        fs.writeFileSync("./data/extraLifeDonors.json", JSON.stringify({
          donors: [...donors],
          donationIDs: [...donationIDs]
        }));
      }
    }
    return team;
  } catch (error) { u.errorHandler(error, "Fetch Extra Life Team"); }
}
/**
 * @param {discord.GuildMember} member
 * @returns {boolean}
 */
function isPartnered(member) {
  const roles = [
    sf.roles.onyxsponsor,
    sf.roles.prosponsor,
    sf.roles.team
  ];
  if (extraLife) roles.push(sf.roles.extralifeteam);

  if (member.id == member.client.user.id) return true;
  return member.roles.cache.hasAny(roles);
}
/**
 * @param {"twitch"|"youtube"} srv
 * @param {HelixStream} stream
 */
function notificationEmbed(stream, srv = "twitch") {
  const embed = u.embed().setTimestamp();
  if (srv == "twitch") {
    const gameName = games.get(stream.gameId)?.name;
    embed.setColor('#6441A4')
      .setThumbnail(stream.getThumbnailUrl(480, 270) + "?t=" + Date.now())
      .setAuthor({ name: `${stream.userDisplayName} ${gameName ? `is playing ${gameName}` : ''}` })
      .setTitle(stream.title || "Now Live")
      .setURL(`https://www.twitch.tv/${encodeURIComponent(stream.userDisplayName)}`);
  } else if (srv == "youtube") {
    const content = stream.snippet;
    const gameName = games.get(stream.game)?.name;
    embed.setColor("#ff0000")
      .setThumbnail(content.thumbnails.default.url)
      .setTitle(content.title ?? "Now Live")
      .setAuthor({ name: `${content.channelTitle} is ${gameName ? `playing ${gameName}` : "Live!"}` })
      .setURL(ytURL(stream.id));
  }
  return embed;
}

function processApplications() {
  try {
    const applications = fs.readdirSync(config.streamApplications);

    applications.forEach(application => {
      if (application.endsWith(".yaml")) {
        const path = `${config.streamApplications}/${application}`;
        const app = yaml.load(fs.readFileSync(path, "utf8"));
        app.timestamp = new Date(fs.statSync(path).mtime);

        const embed = u.embed()
            .setTitle("New Approved Streamer Application")
            .setAuthor(app.name)
            .setColor('#325CBD')
            .setTimestamp(new Date(app.timestamp))
            .addField("Discord Username", app.name)
            .addField("Streaming Platforms", app.streamed_platforms.join("\n"))
            .addField("Streaming Games", app.streamed_games)
            .addField("Stream Links", app.streaming_platform_links)
            .addField("Discord Commitment", `${app.discord_commit}`)
            .addField("Code Commitment", `${app.agree_to_conduct}`);

        Module.client.channels.cache.get(sf.channels.teamStreamers).send({ embeds: [embed] })
          .then(() => fs.unlinkSync(path))
          .catch(e => u.errorHandler(e, "Delete Approved Streamer Application Error"));
      }
    });
  } catch (e) { u.errorHandler(e, "Streaming Application Check"); }
}

async function processTwitch(igns) {
  try {
    const ldsg = Module.client.guilds.cache.get(sf.ldsg),
      liveRole = ldsg.roles.cache.get(sf.roles.live),
      notificationChannel = ldsg.channels.cache.get(sf.channels.general);

    const perPage = 50;
    for (let i = 0; i < igns.length; i += perPage) {
      const streamers = igns.slice(i, i + perPage);
      const streams = await twitch.streams.getStreams({ userName: streamers.map(s => s.ign) }).catch(error => { u.errorHandler(error, "Twitch getStreams()"); });
      if (streams) {
        // Handle Live
        for (const stream of streams.data) {
          const status = twitchStatus.get(stream.userDisplayName.toLowerCase());
          if (status && (stream.gameId != status.gameId || stream.title != status.title)) {
            twitchStatus.set(stream.userDisplayName.toLowerCase(), {
              url: status.url,
              title: stream.title,
              gameId: stream.gameId,
              status: "online",
              name: status.name,
              since: status.since
            });
          }
          if (!status || ((status.status == "offline") && ((Date.now() - status.since) >= (30 * 60 * 1000)))) {
            const rating = (await gameInfo(stream.gameId))?.rating;
            if (stream.userDisplayName.toLowerCase() == "ldsgamers") {
              Module.client.user.setActivity(stream.title, {
                url: `https://www.twitch.tv/${encodeURIComponent(stream.userDisplayName)}`,
                type: "STREAMING"
              }).catch(u.noop);
            }
            twitchStatus.set(stream.userDisplayName.toLowerCase(), {
              url: `https://www.twitch.tv/${encodeURIComponent(stream.userDisplayName)}`,
              title: stream.title,
              status: "online",
              gameId: stream.gameId,
              name: stream.userDisplayName,
              since: Date.now()
            });
            const ign = streamers.find(streamer => streamer.ign.toLowerCase() == stream.userDisplayName.toLowerCase());
            const member = ldsg.members.cache.get(ign.discordId);
            if (member && isPartnered(member)) member.roles.add(liveRole).catch(u.noop);
            const embed = notificationEmbed(stream, "twitch");
            // if (stream.gameId && !rating) return;
            if ((rating != "M - Mature 17+") && extraLife && member?.roles.cache.has(sf.roles.extralife) && stream.title.toLowerCase().replace(/ /g, '').includes("extralife")) {
              notificationChannel.send(`${ldsg.roles.cache.get(sf.roles.extraliferaiders)}, **${member.displayName}** is live for Extra Life!`, { embeds: [embed] }).catch(u.noop);
            } else if (rating != "M - Mature 17+") {
              notificationChannel.send({ embeds: [embed] }).catch(u.noop);
            }
          }
        }

        // Handle Offline
        const offline = streamers.filter(streamer => !streams.data.find(stream => stream.userDisplayName.toLowerCase() == streamer.ign.toLowerCase()));
        for (const channel of offline) {
          if (channel.ign.toLowerCase() == "ldsgamers") Module.client.user.setActivity("Tiddlywinks").catch(error => u.errorHandler(error, "Clear Icarus streaming status"));
          const member = ldsg.members.cache.get(channel.discordId);
          if (liveRole.members.has(member?.id)) member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
          const status = twitchStatus.get(channel.ign.toLowerCase());
          if (status?.status == "online") {
            twitchStatus.set(channel.ign.toLowerCase(), {
              url: null,
              title: null,
              gameId: null,
              name: channel.ign,
              status: "offline",
              since: Date.now()
            });
          }
        }
      }
    }
  } catch (e) {
    u.errorHandler(e, "Process Twitch");
  }
}
async function processYoutube(igns) {
  try {
    const ldsg = Module.client.guilds.cache.get(sf.ldsg),
      liveRole = ldsg.roles.cache.get(sf.roles.live),
      notificationChannel = ldsg.channels.cache.get(sf.channels.general);
    const videos = await yt.getManyUserVids(igns.map(i => {return { id: i.discordId, yt: i.ign };}), 5);
    for (const [id, video] of videos) {
      const status = youtubeStatus.get(id);
      const L = yt.getLive(video.videos);
      if (L) L.game = await yt.getGame(L.id);
      if (L && status && (ytURL(L.id) != status.url || L.snippet.title != status.title || L.game != status.gameId)) {
        youtubeStatus.set(id, {
          url: ytURL(L.id),
          title: L.snippet.title,
          status: "online",
          gameId: L.game,
          name: status.name,
          since: status.since
        });
      }
      if (!status || ((status.status == "offline") && ((Date.now() - status.since) >= (30 * 60 * 1000)))) {
        if (L) {
          // Handle Online
          if (L.snippet.channelId == ldsgYT) {
            Module.client.user.setActivity(L.snippet.title, {
              url: ytURL(L.id),
              type: "STREAMING"
            }).catch(u.noop);
          }
          youtubeStatus.set(id, {
            url: ytURL(L.id),
            title: L.snippet.title,
            status: "online",
            gameId: L.game,
            name: L.snippet.channelTitle,
            since: Date.now()
          });
          const ign = igns.find(streamer => streamer.ign == L.snippet.channelId);
          const member = ldsg.members.cache.get(ign.discordId);
          if (member && isPartnered(member)) member.roles.add(liveRole).catch(u.noop);
          const embed = notificationEmbed(L, "youtube");
          if (extraLife && member?.roles.cache.has(sf.roles.extralife) && L.snippet.title.toLowerCase().replace(/ /g, '').includes("extralife")) {
            notificationChannel.send(`${ldsg.roles.cache.get(sf.roles.extraliferaiders)}, **${member.displayName}** is live for Extra Life!`, { embeds: [embed] }).catch(u.noop);
          } else {
            notificationChannel.send({ embeds: [embed] }).catch(u.noop);
          }
        } else if (status || !L) {
          // Handle offline
          const vid = video.videos[0];
          if (status) {
            if (vid.snippet.channelId == ldsgYT) Module.client.user.setActivity("Tiddlywinks").catch(error => u.errorHandler(error, "Clear Icarus streaming status (yt)"));
            const member = ldsg.members.cache.get(id);
            if (liveRole.members.has(member?.id)) member.roles.remove(liveRole).catch(error => u.errorHandler(error, `Remove Live role from ${member.displayName}`));
          }
          if (!status || status.status == 'online') {
            youtubeStatus.set(id, {
              url: null,
              title: null,
              name: status.name ?? vid.snippet.channelTitle,
              status: "offline",
              since: Date.now()
            });
          }
        }
      }
    }
  } catch (e) {
    u.errorHandler(e, "Process Youtube");
  }
}
/** @param {HelixStream | HelixUser} stream*/
function twitchEmbed(stream, online = true) {
  const name = stream.displayName || stream.userDisplayName;
  const embed = u.embed().setColor('#6441A4')
    .setTitle(`Twitch Stream: ${name}`)
    .setURL(`https://www.twitch.tv/${encodeURIComponent(stream.userDisplayName ?? stream.displayName)}`)
    .setAuthor({ name });

  if (online) {
    const gameName = games.get(stream.gameId)?.name || "Something";
    embed.setDescription(stream.title)
      .setTitle(stream.userDisplayName)
      .setThumbnail(stream.thumbnailUrl.replace("{width}", "480").replace("{height}", "270") + "?t=" + Date.now())
      .addField("Playing", gameName, true)
      .addField("Current Viewers", stream.viewers, true)
      .setTimestamp(stream.startDate);
  } else {
    embed.setDescription(`**Currently Offline**\n${stream.description}`)
      .setTitle(stream.displayName)
      .setThumbnail(stream.profilePictureUrl)
      .setTimestamp();
  }

  return embed;
}
/**
 * @param {Youtube.Video[] | Youtube.Video} stream
 * @param {boolean} online
 */
function youtubeEmbed(stream, online) {
  if (Array.isArray(stream)) stream = stream[0];
  const name = stream.snippet.channelTitle;
  const embed = u.embed().setColor('RED');

  if (online) {
    embed.setTitle(`YouTube Stream: ${stream.snippet.title ?? name}`)
      .setURL(ytURL(encodeURIComponent(stream.id.videoId)))
      .setAuthor({ name })
      .setTimestamp(new Date(stream.snippet.publishedAt));
  } else {
    const top3 = stream.slice(0, 3);
    embed.setTitle(`${name}'s Recent Videos`);
    if (top3.length > 0) embed.addFields(top3.map(t => {return { name: new Date(t.snippet.publishedAt).toTimeString(), value: `[${t.snippet.title}](${ytURL(t.id.videoId)})` }; }));
    else embed.setDescription("Looks like they don't have any videos!");
  }
  return embed;
}

/** @param {discord.CommandInteraction} int*/
async function approve(int) {
  try {
    if (!perms.isTeam(int)) return int.reply({ content: "This command is only for Team!" });
    await int.deferReply({ ephemeral: true });
    const member = int.options.getMember('user');
    if (member.roles.cache.has(sf.roles.trusted)) {
      if (member.roles.cache.has(sf.roles.approvedstreamers)) return int.editReply("That user is already an Approved Streamer!");
      const streamer = await member.roles.add(sf.roles.approvedstreamers);
      await streamer.send("Congratulations! You've been added to the Approved Streamers list in LDSG! " +
      "This allows notifications to show up in #general and grants access to stream to voice channels. " +
      "In order to show notifications in #general, please make sure your correct Twitch or Mixer name is saved in the database " +
      "with `!addIGN twitch/youtube YourName`.\n\nWhile streaming, please remember the Streaming Guidelines ( https://goo.gl/Pm3mwS ) " +
      "and LDSG Code of Conduct ( http://ldsgamers.com/code-of-conduct ). " +
      "Also, please be aware that LDSG may make changes to the Approved Streamers list from time to time at its discretion.").catch(mC.blocked(streamer, 'Made Approved Streamer'));
      await int.editReply("I applied the role to " + streamer.displayName + "!");
      await int.guild.channels.cache.get(sf.channels.modlogs).send(`ℹ️ ${int.member.displayName} has made ${streamer.displayName} an Approved Streamer.`);
    } else {
      await int.editReply(`${member.displayName} needs to be trusted first!`);
    }
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {discord.CommandInteraction} int*/
async function extralifeGoal(int) {
  try {
    if (!extraLife) int.reply({ content: "Extra Life doesn't start until October!", ephemeral: true });
    await int.deferReply({ ephemeral: true });
    const team = await fetchExtraLifeTeam();
    if (!team) return int.editReply("the Extra Life API seems to be down. Please try again in a bit.");
    for (const member of team.participants) {
      if (member.links.stream) member.twitch = member.links.stream.replace("https://player.twitch.tv/?channel=", "");
      member.streamIsLive = false;
    }
    const streams = await fetchExtraLifeStreams(team).catch(u.noop);
    if (streams) {
      for (const stream of streams.data) {
        const member = team.participants.find(m => m.twitch && m.twitch.toLowerCase() == stream.userDisplayName.toLowerCase());
        if (member) {
          member.streamIsLive = true;
          member.stream = stream;
        }
      }
    }
    team.participants.sort((a, b) => {
      if (a.streamIsLive != b.streamIsLive) return (b.streamIsLive - a.streamIsLive);
      else if (a.sumDonations != b.sumDonations) return (b.sumDonations - a.sumDonations);
      else return a.displayName.localeCompare(b.displayName);
    });
    let total = 0;
    const addField = (i, embed) => {
      const member = team.participants[i];
      embed.addField(member.displayName, `$${member.sumDonations} / $${member.fundraisingGoal} (${Math.round(100 * member.sumDonations / member.fundraisingGoal)}%)\n[[Donate]](${member.links.donate})${(member.streamIsLive ? `\n**STREAM NOW LIVE**\n[${member.stream.title}](https://www.twitch.tv/${member.twitch})` : "")}`, true);
      total += member.sumDonations;
    };
    const embed = u.embed().setColor(0x7fd836);
    const embeds = u.multiEmbed(addField, team.participants.length, embed);
    embeds[0].setTitle("LDSG Extra Life Team")
    .setThumbnail("https://assets.donordrive.com/extralife/images/fbLogo.jpg?v=202009241356")
    .setURL(`https://www.extra-life.org/index.cfm?fuseaction=donorDrive.team&teamID=56862#teamTabs`)
    .setDescription(`LDSG is raising money for Extra Life! We are currently at $${total} of our team's $${team.fundraisingGoal} goal for ${new Date().getFullYear()}. That's ${Math.round(100 * total / team.fundraisingGoal)}% there!\n\nYou can help by donating to one of the Extra Life Team below.`);
    int.edit({ embeds });
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {discord.CommandInteraction} int*/
async function extralifeLive(int) {
  try {
    if (!extraLife) return int.reply({ content: "Extra Life doesn't start until October!", ephemeral: true });
    const embeds = await extraLifeEmbed();
    if (embeds) int.reply({ embeds, ephemeral: true });
    else int.reply({ content: "I couldn't find any live LDSG Extra Life Team streams!", ephemeral: true });
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {discord.CommandInteraction} int*/
async function multi(int) {
  const userPrompts = ["user1", "user2", "3", "4", "5", "6", "7", "8"];
  const users = [];
  for (const user of userPrompts) {
    const get = int.options.getUser(user)?.id;
    if (get) users.push(get);
  }
  let igns = (await Module.db.ign.find(users, "twitch"));
  const failed = [];
  for (const user of users) {
    if (!igns.find(i => i.discordId == user)) failed.push(user);
  }
  igns = igns.map(ign => ign.ign);
  const embed = u.embed().setColor('#6441A4')
  .setTitle(`View the Multistre.am here:`)
  .setDescription(`https://multistre.am/${igns.join('/').replace(/ /g, "")}`);
  if (failed.length > 0) embed.setDescription(`I wasn't able to find Twitch IGNs for the following user(s):\n${failed.map(f => `<@${f}>`).join(', ')}\n${embed.description}`);
  int.reply({ embeds: [embed], allowedMentions: { parse: [] } });
}

/** @param {discord.CommandInteraction} int*/
async function info(int) {
  const name = "ldsgamers";
  try {
    const stream = await twitch.streams.getStreamByUserName(name).catch(u.noop);
    if (stream) {
      await gameInfo(stream.gameId);
      int.reply({ embeds: [twitchEmbed(stream)], ephemeral: true });
    } else { // Offline
      const streamer = await twitch.users.getUserByName(name).catch(u.noop);
      int.reply({ embeds: [twitchEmbed(streamer, false)], ephemeral: true });
    }
  } catch (e) {
    u.errorHandler(e, int);
  }
}

/** @param {discord.CommandInteraction} int*/
async function live(int) {
  try {
    const tEmbed = u.embed().setColor('#6441A4');
    const yEmbed = u.embed().setColor('RED');

    const tChannels = [];
    const yChannels = [];
    let i = 0;
    const twitchFetched = twitchStatus.toJSON();
    if (twitchFetched.length > 0) {
      do {
        const stream = twitchFetched[i];
        if (stream) {
          const game = (await gameInfo(stream.gameId))?.name ?? "Something";
          tChannels.push({
            name: stream.name,
            game,
            title: stream.title,
            url: stream.url
          });
        }
        i++;
      } while (i < twitchFetched.size);
    }
    for (const [id, stream] of youtubeStatus) {
      id;
      yChannels.push({
        name: stream.name,
        title: stream.title,
        game: stream.gameId,
        url: stream.url
      });
    }

    tChannels.sort((a, b) => a.name.localeCompare(b.name));
    yChannels.sort((a, b) => a.name.localeCompare(b.name));
    const addFieldTwitch = (i2, embed2) => {
      const channel = tChannels[i2];
      embed2.addField(`${channel.name} playing ${channel.game}`, `[${channel.title}](${channel.url})`, true);
      return embed2;
    };
    const addFieldYoutube = (i2, embed2) => {
      const channel = yChannels[i2];
      embed2.addField(`${channel.name} ${channel.game ? `playing ${channel.game}` : ""}`, `[${channel.title}](${channel.url})`, true);
      return embed2;
    };
    let embeds = [];
    if (tChannels.length > 0) {
      const tEmbeds = u.multiEmbed(addFieldTwitch, tChannels.length, tEmbed);
      tEmbeds[0].setTitle(`Currently Streaming on Twitch in ${int.guild.name}`);
      embeds = embeds.concat(tEmbeds);
    }
    if (yChannels.length > 0) {
      const yEmbeds = u.multiEmbed(addFieldYoutube, yChannels.length, yEmbed);
      yEmbeds[0].setTitle(`Currently Streaming on Youtube in ${int.guild.name}`);
      embeds = embeds.concat(yEmbeds);
    }
    if (embeds.length == 0) return int.reply({ content: "Looks like there aren't any live streams going on right now.", ephemeral: true });
    else int.reply({ embeds });
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {discord.CommandInteraction} int*/
async function twitchCMD(int) {
  try {
    let name;
    const user = int.options.getUser('user', false) ?? int.user;
    const suffix = int.options.getString('channel', false);

    if (user && !suffix) {
      const ign = await Module.db.ign.find(user.id, 'twitch').catch(u.noop);
      if (ign) name = encodeURIComponent(ign.ign);
      else return int.reply({ content: user + " has not set a Twitch name with `!addign twitch`.", ephemeral: true });
    } else if (suffix?.includes(" ")) {
      return int.reply({ content: `\`${suffix}\` doesn't appear to be a valid Twitch username!`, ephemeral: true });
    } else {
      name = encodeURIComponent(suffix);
    }
    if (!name) return int.reply({ content: "You need to provide a user or channel name in order to use this command.", ephemeral: true });

    const stream = await twitch.streams.getStreamByUserName(name).catch(u.noop);
    if (stream) {
      await gameInfo(stream.gameId);
      int.reply({ embeds: [twitchEmbed(stream)] });
    } else { // Offline
      const streamer = await twitch.users.getUserByName(name).catch(u.noop);
      if (streamer) int.reply({ embeds: [twitchEmbed(streamer, false)] });
      else int.reply({ content: `I couldn't find the channel \`${name}\`. :shrug:`, ephemeral: true });
    }
  } catch (e) {
    u.errorHandler(e, int);
  }
}

/** @param {discord.CommandInteraction} int*/
async function unapprove(int) {
  try {
    if (!perms.isTeam(int)) return int.reply({ content: "This command is only for Team!" });
    const member = int.options.getMember('user');
    if (!member.roles.cache.has(sf.roles.approvedstreamers, sf.roles.trustedplus)) return int.reply({ content: `${member} isn't an Approved or Community streamer.`, ephemeral: true });
    await member.roles.remove([sf.roles.approvedstreamers, sf.roles.trustedplus]);
    member.send("You've been removed from the Approved and/or Community Streamers list in LDSG.").catch(mC.blocked(member, "Removed From Approved/Community Streamer"));
    int.guild.channels.cache.get(sf.channels.modlogs).send(`ℹ️ ${int.member.displayName} has removed ${member.displayName} from Approved/Community Streamers.`);
    int.reply({ content: `${member} was removed from the Approved and/or Community Streamers list`, ephemeral: true });
  } catch (error) { u.errorHandler(error, int); }
}

/** @param {discord.CommandInteraction} int*/
async function follow(int) {
  try {
    if (!perms.isMgmt(int)) return int.reply({ content: "This command is only for Management!" });
    const suffix = int.options.getString('channel');
    const platform = int.options.getString('platform');
    if (int.options.getBoolean('list') == true) {
      if (bonusStreams[platform].length == 0) return int.reply({ content: "Looks like there aren't any followed streamers right now!", ephemeral: true });
      if (platform == 'twitch') {
        let channelInfo = await twitch.users.getUsersByNames(bonusStreams[platform].sort((a, b) => a.localeCompare(b))).catch(u.noop);
        channelInfo = channelInfo.sort((a, b) => a.id.localeCompare(b.id));
        const embed = u.embed().setColor('#6441A4')
        .setTitle("Streams from non-LDSG members")
        .setDescription(channelInfo.map(channel => `[${channel.displayName}](https://www.twitch.tv/${channel.displayName})`).join('\n') || "There aren't any followed Twitch streamers right now.");
        return int.reply({ embeds: [embed], ephemeral: true });
      } else {
        let channelInfo = await yt.getChannels(bonusStreams[platform]);
        channelInfo = channelInfo.sort((a, b) => a.snippet.title.localeCompare(b.snippet.title));
        const embed = u.embed().setColor('RED')
        .setTitle("Streams from non-LDSG members")
        .setDescription(channelInfo.map(channel => `[${channel.snippet.title}](https://www.youtube.com/channel/${channel.id})`).join('\n') || "There aren't any followed YouTube streamers right now.");
        return int.reply({ embeds: [embed], ephemeral: true });
      }
    }
    const embed = u.embed().setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
      .setTitle("Channel added to the Followed Channels list");
    if (!suffix) return int.reply({ content: "You need to provide a channel to watch!", ephemeral: true });
    if (["twitch"].includes(platform)) {
      // FOLLOW TWITCH
      const validUser = (await twitch.search.searchChannels(suffix, { limit: 1 }).catch(u.noop))?.data[0];
      if (!validUser) return int.reply({ content: "I wasn't able to find that channel.", ephemeral: true });
      const url = `https://twitch.tv/${validUser.displayName}`;
      const react = await u.confirmInteraction(int, `[${validUser.displayName}](${url})`, "Is this the right channel?");
      if (react) {
        if (bonusStreams[platform].includes(validUser.name)) return int.editReply({ content: "That channel is already being followed!", embeds: [], components: [] });
        bonusStreams[platform] = bonusStreams[platform].concat(validUser.name);
        fs.writeFileSync("./data/streams.json", JSON.stringify(bonusStreams, null, "\t"));
        int.editReply({ content: `\`${suffix}\` was added to the Followed Channels list`, embeds: [] });
        embed.setDescription(`[${validUser.displayName}](${url}) (Twitch) was added to the Followed Channels list.`);
        int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      }
    } else if (platform == 'youtube') {
      // FOLLOW YT
      if (bonusStreams[platform].includes(suffix)) return int.reply({ content: "That channel is already being followed!", embeds: [], components: [] });
      const validUser = (await yt.getChannels(suffix))[0];
      if (!validUser) return int.reply({ content: `I wasn't able to find that channel. Make sure you're using their channel ID, not their name.\n(example: \`${ldsgYT}\` instead of \`LDS Gamers\`)`, ephemeral: true });
      const url = `https://youtube.com/channel/${validUser.id}`;
      const react = await u.confirmInteraction(int, `[${validUser.snippet.title}](${url})`, "Is this the right channel?");
      if (react) {
        if (bonusStreams[platform].includes(validUser.id)) return int.editReply({ content: "That channel isn already being followed!", embeds: [], components: [] });
        bonusStreams[platform] = bonusStreams[platform].concat(validUser.id);
        fs.writeFileSync("./data/streams.json", JSON.stringify(bonusStreams, null, "\t"));
        int.editReply({ content: `\`${validUser.snippet.title}\` was added to the Followed Channels list`, embeds: [] });
        embed.setDescription(`[${validUser.snippet.title}](${url}) (YT) was added to the Followed Channels list.`);
        int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      }

    }
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {discord.CommandInteraction} int*/
async function unfollow(int) {
  try {
    if (!perms.isMgmt(int)) return int.reply({ content: "This command is only for Management!" });
    const suffix = int.options.getString('channel');
    const platform = int.options.getString("platform");
    const embed = u.embed().setAuthor({ name: int.member.displayName, iconURL: int.member.displayAvatarURL() })
      .setTitle("Channel removed from the Followed Channels list");
    if (platform == 'twitch') {
      // TWTICH UNFOLLOW
      const validUser = (await twitch.search.searchChannels(suffix, { limit: 1 }).catch(u.noop))?.data[0];
      if (!validUser) return int.reply({ content: "I wasn't able to find that channel.", ephemeral: true });
      const url = `https://twitch.tv/${validUser.displayName}`;
      const react = await u.confirmInteraction(int, `[${validUser.displayName}](${url})`, "Is this the right channel?");
      if (react) {
        if (!bonusStreams[platform].includes(validUser.name)) return int.editReply({ content: "That channel isn't being followed!", embeds: [], components: [] });
        bonusStreams[platform] = bonusStreams[platform].filter(s => s != validUser.name);
        fs.writeFileSync("./data/streams.json", JSON.stringify(bonusStreams, null, "\t"));
        int.editReply({ content: `\`${suffix}\` was removed from the stream notifications list`, embeds: [] });
        embed.setDescription(`[${validUser.displayName}](${url}) (Twitch) was removed from the Followed Channels list.`);
        int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      }
    } else if (platform == 'youtube') {
      // YT UNFOLLOW
      const validUser = bonusStreams[platform].find(s => s == suffix);
      if (!validUser) return int.reply({ content: `I wasn't able to find that channel on the list. Make sure you're using their channel ID, not their name.\n(example: \`${ldsgYT}\` instead of \`LDS Gamers\`)`, ephemeral: true });
      const url = `https://youtube.com/channel/${validUser}`;
      const fetchedChannel = youtubeStatus.get(suffix);
      const react = await u.confirmInteraction(int, `[${fetchedChannel?.name ?? "Channel"}](${url})`, "Is this the right channel?");
      if (react) {
        bonusStreams[platform] = bonusStreams[platform].filter(s => s != validUser);
        fs.writeFileSync("./data/streams.json", JSON.stringify(bonusStreams, null, "\t"));
        int.editReply({ content: `\`${fetchedChannel?.name ?? "The channel"}\` was removed from the Followed Channels list`, embeds: [], components: [] });
        embed.setDescription(`[${fetchedChannel?.name ?? "This Channel"}](${url}) (YT) was removed from the Followed Channels list.`);
        int.guild.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
      }
    }
  } catch (e) { u.errorHandler(e, int); }
}

/** @param {discord.CommandInteraction} int*/
async function youtube(int) {
  try {
    const user = int.options.getUser('user', false) ?? int.user;
    const ign = await Module.db.ign.find(user.id, 'youtube').catch(u.noop);
    if (!ign) return int.reply({ content: user + " has not set a YouTube ID with `!addign youtube`.", ephemeral: true });
    const id = encodeURIComponent(ign.ign);
    const stream = await yt.fetchChannelContent(id).catch(u.noop);
    if (stream) {
      const status = stream.find(s => s.snippet.liveBroadcastContent == 'live');
      if (status) int.reply({ embeds: [youtubeEmbed(status, true)] });
      else int.reply({ embeds: [youtubeEmbed(stream, false)] });
    } else {
      int.reply({ content: `I couldn't find that channel.`, ephemeral: true });
    }
  } catch (e) {
    u.errorHandler(e, int);
  }
}

const Module = new Augur.Module()
.addEvent("guildMemberUpdate", (oldMember, newMember) => {
  // Twitch Sub stuff
  const twitchSub = sf.roles.twitchsubscriber;
  const hexlogo = newMember.client.emojis.cache.get(sf.emoji.hexlogo);
  if (oldMember.roles.cache.has(twitchSub) && !newMember.roles.cache.has(twitchSub)) {
    newMember.send("It looks like your Twitch subscription to LDS Gamers has expired!" +
    "\n\nTwitch Prime subscriptions need to be resubbed on a monthly basis. If this was unintentional, " +
    "please consider resubbing at <https://www.twitch.tv/ldsgamers>. It helps keep the website and various game servers running. " +
    `Thanks for the support! ${hexlogo}`)
      .catch(mC.blocked(newMember, "Twitch Sub Expired"));
    newMember.guild.channels.cache.get(sf.channels.modlogs).send(`**${newMember.displayName}**'s Twitch Sub has expired!`);
  } else if (!oldMember.roles.cache.has(twitchSub) && newMember.roles.cache.has(twitchSub)) {
    newMember.send("Thanks for becoming an LDS Gamers Twitch Subscriber! People like you help keep the website and various game servers running. " +
    "If you subscribed with a Twitch Prime sub, those need to be renewed monthly. You'll get a notification if I notice it lapse. " +
    `Thanks for the support! ${hexlogo}`)
      .catch(mC.blocked(newMember, "Twitch Sub Added"));
    newMember.guild.channels.cache.get(sf.channels.modlogs).send(`**${newMember.displayName}** has become a Twitch Sub!`);
  }
})
.setInit((data) => {
  gamesDB._setKey(config.api.thegamesdb);
  yt._setKey(config.google.youtube);
  if (data) {
    for (const [key, status] of data.twitchStatus) {
      twitchStatus.set(key, status);
    }
    for (const [key, status] of data.youtubeStatus) {
      youtubeStatus.set(key, status);
    }
    ytCycle = data.ytCycle;
  }
})
.setUnload(() => ({ twitchStatus, applicationCount, youtubeStatus, ytCycle }))
.setClockwork(async () => {
  try {
    const interval = 5 * 60 * 1000;
    return setInterval(async () => {
      try {
        // Approved Streamers
        const streamers = Module.client.guilds.cache.get(sf.ldsg).roles.cache.get(sf.roles.approvedstreamers).members.map(member => member.id);
        let ignsTwitch = await Module.db.ign.find(streamers, "twitch");
        let ignsYoutube = await Module.db.ign.find(streamers, "youtube");
        ignsTwitch = ignsTwitch.concat(bonusStreams.twitch.map(c => ({ ign: c, discordId: c })));
        ignsYoutube = ignsYoutube.concat(bonusStreams.youtube.map(c => ({ ign: c, discordId: c })));

        processTwitch(ignsTwitch);

        // Only check every 15 minutes and during specific times to save on API quota
        if (new Date().getHours() > 9) {
          ytCycle++;
          if (ytCycle == 3) {
            ytCycle = 0;
            processYoutube(ignsYoutube);
          }
        } else {
          ytCycle = 0;
        }

        // Check for new Approved Streamers applications
        processApplications();

        // Extra Life check
        if (extraLife && new Date().getMinutes() < 5) {
          const embeds = await extraLifeEmbed();
          if (embeds?.length > 0) Module.client.channels.cache.get(sf.channels.general).send({ embeds });
        }
      } catch (e) { u.errorHandler(e, "Stream Check"); }
    }, interval);
  } catch (e) { u.errorHandler(e, "Streaming Clockwork"); }
})
.addInteractionCommand({ name: "streams",
  commandId: sf.commands.slashStreams,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand()) {
    // MGMT/TEAM STUFF
    case "approve": return approve(interaction);
    case "unapprove": return unapprove(interaction);
    case "follow": return follow(interaction);
    case "unfollow": return unfollow(interaction);

    // EXTRA LIFE STUFF
    case "extralife-goal": return extralifeGoal(interaction);
    case "extralife-live": return extralifeLive(interaction);

    // GENERAL
    case "multi": return multi(interaction);
    case "info": return info(interaction);
    case "live": return live(interaction);
    case "twitch": return twitchCMD(interaction);
    case "youtube": return youtube(interaction);
    }
  }
});
module.exports = Module;