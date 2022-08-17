const Discord = require("discord.js");

const Ign = require("../models/Ign.model");

module.exports = {
  /**
   * Delete an IGN
   * @function delete
   * @param {string|Discord.User|Discord.GuildMember} discordId Which user's IGN to delete
   * @param {string} system Which system IGN to delete
   * @returns {Promise<ign>}
   */
  delete: async function(discordId, system) {
    if (discordId.id) discordId = discordId.id;
    return await Ign.findOneAndRemove({ discordId, system }).exec();
  },
  /**
   * Find an IGN
   * @function find
   * @param {string|Discord.User|Discord.GuildMember} discordId Which user's IGN to find
   * @param {(string)} system Which system IGN to find
   * @returns {Promise<Array<ign>|ign>}
   */
  find: async function(discordId, system) {
    if (discordId.id) discordId = discordId.id;
    if (Array.isArray(system)) return await Ign.find({ discordId, system: { $in: system } }).exec();
    else if (Array.isArray(discordId)) return await Ign.find({ discordId: { $in: discordId }, system }).exec();
    else if (system) return await Ign.findOne({ discordId, system }).exec();
    else return await Ign.find({ discordId }).exec();
  },
  /**
   * Find a list of IGNs for a given system
   * @function getList
   * @param {string} system Whcih system list to fetch
   * @returns {Promise<Array<ign>>}
   */
  getList: async function(system) {
    return await Ign.find({ system }).exec();
  },
  /**
   * Save a user's IGN
   * @function save
   * @param {string|Discord.User|Discord.GuildMember} discordId Which user's IGN to save
   * @param {string} system Which system IGN to save
   * @param {string} ign The IGN to save
   * @returns {Promise{ign}}
   */
  save: async function(discordId, system, ign) {
    if (discordId.id) discordId = discordId.id;
    return await Ign.findOneAndUpdate(
      { discordId, system },
      { $set: { ign } },
      { upsert: true, new: true }
    ).exec();
  }
};
