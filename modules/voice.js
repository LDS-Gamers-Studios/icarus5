// This module deals with locking/unlocking voice channels, as well as swapping them out as needed.
// frost's note: Sounds and music are nice but maybe not right now.

const u = require("../utils/utils"),
  sf = require("../config/snowflakes.json"),
  config = require("../config/config.json"),
  Augur = require("augurbot"),
  { GoogleSpreadsheet } = require("google-spreadsheet");

let channelNames = new Array();

function isCommunityVoice(channel) {
  return (channel?.parentId == sf.channels.communityVoice) && (channel?.id != sf.channels.voiceAFK);
}

function getIDsFromMentionString(mentionString) {
  if (!mentionString) return new Array();
  const pingRegex = /<@!?(?<id>\d+)>/g; // Gets the IDs of users mentioned.
  let userIDs = mentionString.matchAll(pingRegex);
  userIDs = Array.from(userIDs).map(x => x.groups.id);
  return userIDs;
}

function random(iter) {
  return iter[Math.floor(Math.random() * iter.length)];
}

async function slashVoiceLock(interaction) {
  try {
    const member = interaction.member;
    const channel = member.voice.channel;
    if (isCommunityVoice(channel)) {
      // lock the channel
      const users = Array.from(channel.members.keys()).concat(getIDsFromMentionString(interaction.options.getString("users")));

      const overwrites = [
        { // bot - in case this is needed later.
          id: interaction.client.user.id,
          allow: "CONNECT"
        }, { // @everyone
          id: interaction.guild.id,
          deny: "CONNECT"
        }, { // Muted
          id: sf.roles.muted,
          deny: ["CONNECT", "SPEAK", "VIEW_CHANNEL"]
        }
      ].concat(users.map(id => ({
        id,
        allow: "CONNECT"
      })));

      await channel.permissionOverwrites.set(overwrites);
      interaction.reply({ content: "Channel successfully locked!", ephemeral: true });
      // The following is an alternative using embeds.
      // let embed = u.embed()
      //   .setAuthor({
      //     name: "Channel successfully locked!",
      //     iconURL: "https://upload.wikimedia.org/wikipedia/commons/thumb/4/40/Twemoji_1f512.svg/512px-Twemoji_1f512.svg.png"
      //   });
      // interaction.reply({ embeds: [embed] });

    } else if (channel) {
      interaction.reply({ content:"This channel cannot be locked!", ephemeral: true });
    } else {
      interaction.reply({ content:"You are not in a voice channel!", ephemeral: true });
    }
  } catch (e) { u.errorHandler(e, "Lock Voice Channel"); }
}

async function slashVoiceUnlock(interaction) {
  try {
    const channel = interaction.member.voice.channel;
    if (isCommunityVoice(channel)) {
      if (channel.permissionsFor(interaction.member).has("SPEAK")) {
        // Unlock the channel.
        const overwrites = [
          { // bot
            id: interaction.client.user.id,
            allow: "CONNECT"
          }, { // @everyone
            id: interaction.guild.id,
            allow: "CONNECT"
          }, { // Muted
            id: sf.roles.muted,
            deny: ["CONNECT", "SPEAK", "VIEW_CHANNEL"]
          }
        ];

        await channel.permissionOverwrites.set(overwrites);
        if (channel.name.includes("[STREAM]")) channel.setName(channel.name.replace("[STREAM]", "Room"), "Channel Unlock");
        interaction.reply({ content: "Channel successfully unlocked!", ephemeral: true });

      } else {
        interaction.reply({ content: "You don't have permission to unlock the channel right now.", ephemeral: true });
      }
    } else if (channel) {
      interaction.reply({ content: "You're not in a channel that's unlockable.", ephemeral: true });
    } else {
      interaction.reply({ content: "You're not in a voice channel!", ephemeral: true });
    }
  } catch (e) { u.errorHandler(e, "Unlock Voice Channel"); }
}

async function slashVoiceStreamlock(interaction) {
  try {
    const member = interaction.member;
    const channel = member.voice.channel;
    if (isCommunityVoice(channel)) {
      if (channel.permissionsFor(member).has("STREAM")) {
        // stream lock the channel
        const users = Array.from(channel.members.keys()).concat(getIDsFromMentionString(interaction.options.getString("users")));

        const overwrites = [
          { // bot
            id: interaction.client.user.id,
            allow: "CONNECT"
          }, { // @everyone
            id: interaction.guild.id,
            deny: ["SPEAK", "STREAM"]
          }, { // Muted
            id: sf.roles.muted,
            deny: ["CONNECT", "SPEAK", "VIEW_CHANNEL"]
          }
        ].concat(users.map(id => ({
          id,
          allow: ["CONNECT", "STREAM", "SPEAK"]
        })));

        await channel.permissionOverwrites.set(overwrites);
        if (channel.name.includes("Room")) await channel.setName(channel.name.replace("Room", "[STREAM]"), "Stream Lock");
        interaction.reply({ content: "Channel successfully stream locked!", ephemeral: true });
      } else {
        interaction.reply({ content: "You don't have permission to stream lock this channel.", ephemeral: true });
      }

    } else if (channel) {
      interaction.reply({ content: "This channel cannot be stream locked!", ephemeral: true });
    } else {
      interaction.reply({ content: "You are not in a voice channel!", ephemeral: true });
    }
  } catch (e) { u.errorHandler(e, "Lock Voice Channel"); }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "voice",
  guildId: sf.ldsg,
  commandID: sf.commands.voice,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
    case "lock":
      await slashVoiceLock(interaction);
      break;
    case "unlock":
      await slashVoiceUnlock(interaction);
      break;
    case "streamlock":
      await slashVoiceStreamlock(interaction);
      break;
    }
  }
})
.setInit(async () => {
  const doc = new GoogleSpreadsheet(config.google.sheets.config);
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    const channels = await doc.sheetsByTitle["Voice Channel Names"].getRows();
    channelNames = Array.from(channels.map(x => x.Channels));

  } catch (e) { u.errorHandler(e, "Load Voice Channel Names"); }
})
.addEvent("voiceStateUpdate", async (oldState, newState) => {
  const guild = oldState.guild;
  // If the change is in LDSG and involves moving users (we don't care otherwise)
  if ((guild.id == sf.ldsg) && (oldState.channelId != newState.channelId)) {
    // If the channel that was moved out of is empty, remove it.
    if (oldState.channel && (oldState.channel.members.size == 0) && isCommunityVoice(oldState.channel)) {
      await oldState.channel.delete().catch(e => u.errorHandler(e, `Could not delete empty voice channel: ${oldState.channel.name}`));
    }
    // If the channel that was moved into was empty, add another one.
    if (newState.channel && (newState.channel.members.size == 1) && isCommunityVoice(newState.channel)) {
      const bitrate = newState.channel.bitrate;
      const available = channelNames.filter(name => !guild.channels.cache.find(c => c.name.startsWith(name)));
      const name = ((random(available) || random(channelNames)) || "Room Error") + ` (${parseInt(bitrate / 1000, 10)} kbps)`;

      try {
        await guild.channels.create(name, {
          type: "GUILD_VOICE",
          bitrate,
          parent: sf.channels.communityVoice,
          permissionOverwrites: [
            {
              id: sf.roles.muted,
              deny: ["VIEW_CHANNEL", "CONNECT", "SEND_MESSAGES", "SPEAK"]
            },
            {
              id: sf.roles.ducttape,
              deny: ["VIEW_CHANNEL", "CONNECT", "SPEAK"]
            },
            {
              id: sf.roles.suspended, // "871566171206484008"
              deny: ["VIEW_CHANNEL", "CONNECT", "SPEAK"]
            }
          ]
        });
      } catch (e) { u.errorHandler(e, "Voice Channel Creation Error"); }
    }
  }
})
;

module.exports = Module;