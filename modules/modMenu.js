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

async function flagUser() {
  // Stuff goes here
}

async function userInfo() {
  // Stuff goes here
}

async function userAvatar() {
  // Stuff goes here
}

async function flagMessage() {
  // Stuff goes here
}

async function pinMessage() {
  // Stuff goes here
}

async function fullinfo() {
  // Stuff goes here
}

async function summary() {
  // Stuff goes here
}

async function noteUser() {
  // Stuff goes here
}

async function renameUser() {
  // Stuff goes here
}

async function trustUser() {
  // Stuff goes here
}

async function trustPlusUser() {
  // Stuff goes here
}

async function watchUser() {
  // Stuff goes here
}

async function warnUser() {
  // Stuff goes here
}

async function muteUser() {
  // Stuff goes here
}

async function timeoutUser() {
  // Stuff goes here
}

async function kickUser() {
  // Stuff goes here
}

async function banUser() {
  // Stuff goes here
}

async function warnMessage() {
  // Stuff goes here
}

async function purgeChannel() {
  // Stuff goes here
}

async function announceMessage() {
  // Stuff goes here
}


const allMenuItems = new u.Collection()
.set('flagUser', { key: 0, data: menuOptions.flagUser, process: flagUser })
.set('userInfo', { key: 0, data: menuOptions.userInfo, process: userInfo })
.set('userAvatar', { key: 0, data: menuOptions.userAvatar, process: userAvatar })
.set('flagMessage', { key: isMsg, data: menuOptions.flagMessage, process: flagMessage })
.set('pinMessage', { key: isMsg, data: menuOptions.pinMessage, process: pinMessage })
.set('fullinfo', { key: isMod, data: menuOptions.fullinfo, process: fullinfo })
.set('summary', { key: isMod, data: menuOptions.summary, process: summary })
.set('noteUser', { key: isMod, data: menuOptions.noteUser, process: noteUser })
.set('renameUser', { key: isMod, data: menuOptions.renameUser, process: renameUser })
.set('trustUser', { key: isMod, data: menuOptions.trustUser, process: trustUser })
.set('trustPlusUser', { key: isMod, data: menuOptions.trustPlusUser, process: trustPlusUser })
.set('watchUser', { key: isMod, data: menuOptions.watchUser, process: watchUser })
.set('warnUser', { key: isMod, data: menuOptions.warnUser, process: warnUser })
.set('muteUser', { key: isMod, data: menuOptions.muteUser, process: muteUser })
.set('timeoutUser', { key: isMod, data: menuOptions.timeoutUser, process: timeoutUser })
.set('kickUser', { key: isMod, data: menuOptions.kickUser, process: kickUser })
.set('banUser', { key: isMod, data: menuOptions.banUser, process: banUser })
.set('warnMessage', { key: isMod + isMsg, data: menuOptions.warnMessage, process: warnMessage })
.set('purgeChannel', { key: isMod + isMsg, data: menuOptions.purgeChannel, process: purgeChannel })
.set('announceMessage', { key: isMgr + isMsg, data: menuOptions.announceMessage, process: announceMessage });

async function modMenu(inter) {
  const includeKey = permCheck(inter);
  const options = [];
  for (const [, item] of allMenuItems) {
    if (includeKey & item.key == item.key) options.push(item.data);
  }

  // Sort menu items (alphabetically?)
  // Present menu to user

  // const menuSelect = await inter.channel.awaitMessageComponent(filter, componentType, time);
  // const selection = menuSelect.values.first();

  // Issue confirm dialog? Or should this (where applicable) be in the process function?
  // const confirm = u.confirmInteraction(inter, "Do you want to do the thing?");
  // Call function based on selection
  // await allMenuItems.get(selection).process()
}

const Module = new Augur.Module()
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modMessage, process: modMenu })
.addInteractionCommand({ name: "Moderation", commandId: sf.commands.modUser, process: modMenu });

module.exports = Module;
