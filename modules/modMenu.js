const Augur = require("augurbot"),
  p = require("../utils/perms"),
  sf = require("../config/snowflakes"),
  u = require("../utils/utils");

const menuOptions = require("../data/modMenuOptions");

const isMsg = 1 << 0;
const isMod = 1 << 1;
const isMgr = 1 << 2;

function permCheck(inter) {
  return (
    (inter.targetType === "MESSAGE") * isMsg |
    p.isMod(inter) * isMod |
    p.isManager(inter) * isMgr
  );
}

const processes = {
  flagUser: async function() {
    // Stuff goes here
  },
  userInfo: async function() {
    // Stuff goes here
  },
  userAvatar: async function() {
    // Stuff goes here
  },
  flagMessage: async function() {
    // Stuff goes here
  },
  pinMessage: async function() {
    // Stuff goes here
  },
  fullinfo: async function() {
    // Stuff goes here
  },
  summary: async function() {
    // Stuff goes here
  },
  noteUser: async function() {
    // Stuff goes here
  },
  renameUser: async function() {
    // Stuff goes here
  },
  trustUser: async function() {
    // Stuff goes here
  },
  trustPlusUser: async function() {
    // Stuff goes here
  },
  watchUser: async function() {
    // Stuff goes here
  },
  warnUser: async function() {
    // Stuff goes here
  },
  muteUser: async function() {
    // Stuff goes here
  },
  timeoutUser: async function() {
    // Stuff goes here
  },
  kickUser: async function() {
    // Stuff goes here
  },
  banUser: async function() {
    // Stuff goes here
  },
  warnMessage: async function() {
    // Stuff goes here
  },
  purgeChannel: async function() {
    // Stuff goes here
  },
  announceMessage: async function() {
    // Stuff goes here
  }
};

const allMenuItems = new u.Collection()
.set(0, ['flagUser', 'userInfo', 'userAvatar'])
.set(isMsg, ['flagMessage', 'pinMessage'])
.set(isMod, ['fullinfo', 'summary', 'noteUser', 'renameUser', 'trustUser', 'trustPlusUser', 'watchUser', 'warnUser',
  'muteUser', 'timeoutUser', 'kickUser', 'banUser'])
.set(isMod + isMsg, ['warnMessage', 'purgeChannel'])
.set(isMgr + isMsg, ['announceMessage']);

async function modMenu(inter) {
  const includeKey = permCheck(inter);
  const options = [];
  for (const [key, item] of allMenuItems) {
    if (includeKey & key == key) options.push(menuOptions[item]);
  }

  // Sort menu items (alphabetically?)
  // Present menu to user

  // const menuSelect = await inter.channel.awaitMessageComponent(filter, componentType, time);
  // const selection = menuSelect.values.first();

  // Issue confirm dialog? Or should this (where applicable) be in the process function?
  // const confirm = u.confirmInteraction(inter, "Do you want to do the thing?");
  // Call function based on selection
  // await processes[selection]()
}

const Module = new Augur.Module()
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modMessage, process: modMenu })
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modUser, process: modMenu });

module.exports = Module;
