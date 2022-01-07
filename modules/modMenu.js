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
    inter.isMessageContextMenu() * isMsg |
    p.isMod(inter) * isMod |
    p.isManager(inter) * isMgr
  );
}

async function flagUser() {
  // Stuff goes here
}

const allMenuItems = u.Collection()
.set('flagUser', { key: 0, data: menuOptions.flagUser, process: flagUser });

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
