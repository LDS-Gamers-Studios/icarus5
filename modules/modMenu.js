const Augur = require("augurbot"),
  p = require("../utils/perms"),
  sf = require("../config/snowflakes"),
  u = require("../utils/utils"),
  c = require("../utils/modCommon"),
  Discord = require("discord.js");

const menuOptions = require("../data/modMenuOptions");

const isMsg = 1 << 0;
const isMod = 1 << 1;
const isMgr = 1 << 2;

function permCheck(inter) {
  return (
    (inter.targetType === "MESSAGE") * isMsg |
    p.isMod(inter) * isMod |
    p.isAdmin(inter) * isMgr
  );
}

function getTargetUser(target) {
  return target.member ?? target.author ?? target;
}

const processes = {
  flagUser: async function(interaction, target) {
    // Stuff goes here
  },
  userInfo: async function(interaction, target) {
    // Stuff goes here
  },
  userAvatar: async function(interaction, target) {
    // Stuff goes here
  },
  flagMessage: async function(interaction, target) {
    // Stuff goes here
  },
  pinMessage: async function(interaction, target) {
    target.pin();
    await interaction.editReply({ embeds: [
      u.embed().setTitle("Message pinned.")
    ] });
  },
  fullinfo: async function(interaction, target) {
    // Stuff goes here
  },
  summary: async function(interaction, target) {
    // Stuff goes here
  },
  noteUser: async function(interaction, target) {
    await interaction.editReply("Please check your DMs from me.");
    const dm = await u.awaitDM("What is the note would you like to add?", interaction.member);
    if (!dm) {
      await interaction.editReply({ embeds: [
        u.embed({ author: interaction.member }).setColor(0x0000ff)
        .setDescription(`Note cancelled`)
      ], content: null });
      return;
    }

    await c.note(interaction, getTargetUser(target), dm.content);
  },
  renameUser: async function(interaction, target) {
    // Stuff goes here
  },
  trustUser: async function(interaction, target) {
    // Stuff goes here
  },
  trustPlusUser: async function(interaction, target) {
    // Stuff goes here
  },
  watchUser: async function(interaction, target) {
    // Stuff goes here
  },
  warnUser: async function(interaction, target) {
    // Stuff goes here
  },
  muteUser: async function(interaction, target) {
    const reason = target.cleanContent ?? "Violating the Code of Conduct";
    await c.mute(interaction, getTargetUser(target), reason);
  },
  unmuteUser: async function(interaction, target) {
    await c.unmute(interaction, getTargetUser(target));
  },
  timeoutUser: async function(interaction, target) {
    // Stuff goes here
  },
  kickUser: async function(interaction, target) {
    await interaction.editReply("Please check your DMs from me.");
    const dm = await u.awaitDM("What is the reason for this kick?", interaction.member);
    if (!dm) {
      await interaction.editReply({ embeds: [
        u.embed({ author: interaction.member }).setColor(0x0000ff)
        .setDescription(`Kick cancelled`)
      ], content: null });
      return;
    }

    await c.kick(interaction, getTargetUser(target), dm.content);
  },
  banUser: async function(interaction, target) {
    await interaction.editReply("Please check your DMs from me.");
    const dm = await u.awaitDM("What is the reason for this ban?", interaction.member);
    if (!dm) {
      await interaction.editReply({ embeds: [
        u.embed({ author: interaction.member }).setColor(0x0000ff)
        .setDescription(`Ban cancelled`)
      ], content: null });
      return;
    }

    await c.ban(interaction, getTargetUser(target), dm.content, 1);
  },
  warnMessage: async function(interaction, target) {
    // Stuff goes here
  },
  purgeChannel: async function(interaction, target) {
    // Stuff goes here
  },
  announceMessage: async function(interaction, target) {
    const author = target.member;
    const embed = u.embed({ author })
      .setTimestamp(target.createdAt)
      .setDescription(target.content);
    if (target.attachments && (target.attachments.size > 0)) {
      embed.attachFiles([target.attachments.first().proxyURL]);
    }
    await interaction.client.channels.cache.get(sf.channels.announcements).send({ embeds: [embed] });
    await interaction.editReply({ content: "Message announced!", ephemeral: true });
  }
};

const allMenuItems = new u.Collection()
.set(0, ['flagUser', 'userInfo', 'userAvatar'])
.set(isMsg, ['flagMessage', 'pinMessage'])
.set(isMod, ['fullinfo', 'summary', 'noteUser', 'renameUser', 'trustUser', 'trustPlusUser', 'watchUser', 'warnUser',
  'muteUser', 'unmuteUser', 'timeoutUser', 'kickUser', 'banUser'])
.set(isMod + isMsg, ['warnMessage', 'purgeChannel'])
.set(isMgr + isMsg, ['announceMessage']);

/**
   * @param {Discord.ContextMenuInteraction} inter
   */
async function modMenu(inter) {
  await inter.deferReply({ ephemeral: true });
  const includeKey = permCheck(inter);
  const options = allMenuItems.filter((v, k) => (includeKey & k) == k)
    .reduce((a, v) => a.concat(v), [])
    .map((v) => menuOptions[v])
    .sort((a, b) => a.label.toLowerCase().localeCompare(b.label.toLowerCase()));

  // Present menu to user
  const selectId = u.customId();
  const row = new Discord.MessageActionRow()
    .addComponents(
      new Discord.MessageSelectMenu()
        .setCustomId(selectId)
        .setPlaceholder('Nothing Selected')
        .addOptions(options),
    );

  const target = inter.targetType === "MESSAGE" ? inter.options.getMessage("message") : inter.options.getMember("user");

  const e = u.embed({ author: getTargetUser(target) })
    .setColor("RED");
  let embeds = [ e ];
  if (inter.targetType === "MESSAGE") {
    e.setTitle("Select An Action On This Message");
    e.setDescription(target.content);
    embeds = embeds.concat(target.embeds);
  } else {
    e.setTitle("Select An Action On This User");
  }

  await inter.editReply({ embeds, components: [ row ] });

  let menuSelect;
  const filter = (comp) => comp.customId === selectId && comp.user.id === inter.member.id;
  menuSelect = await inter.channel.awaitMessageComponent({ filter, time: 60000 })
    .catch(() => menuSelect = null);

  if (!menuSelect) {
    embeds[0].setTitle("Action Timed Out").setColor("BLUE");
    await inter.editReply({ embeds, components: [ ] });
    return;
  }

  const selection = menuSelect.values[0];
  await menuSelect.deferReply({ ephemeral: true });
  embeds[0].setTitle("Action Selected")
    .setColor("GREEN")
    .setFooter(options.filter(o => o.value === selection)[0].label);
  await inter.editReply({ embeds, components: [ ] });
  await processes[selection](menuSelect, target);
}

const Module = new Augur.Module()
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modMessage, process: modMenu })
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modUser, process: modMenu });

module.exports = Module;
