const Discord = require("discord.js");
const Ign = require("../models/Ign.model");

/**
 * @typedef {string|Discord.User|Discord.GuildMember} discordId A user ID or instance of `Discord.User` or `Discord.GuildMember`
 *
 * @typedef ign
 * @property {number} _id
 * @property {number} __v
 * @property {string} discordId
 * @property {string} system
 * @property {string} ign
 */

module.exports = {
  /**
   * Delete an IGN
   * @param {discordId} discordId Which user's IGN to delete
   * @param {keyof system} system Which system IGN to delete (consult the Google Sheet for a list)
   * @returns {Promise<ign>}
   */
  delete: async function(discordId, system) {
    if (discordId.id) discordId = discordId.id;
    return await Ign.findOneAndRemove({ discordId, system }).exec();
  },

  /**
   * Find an IGN
   * @param {discordId} discordId Which user's IGN to find
   * @param {string} system Which system IGN to find (consult the Google Sheet for a list)
   * @returns {Promise<ign[]|ign>}
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
   * @param {string} system Whcih system list to fetch (consult the Google Sheet for a list)
   * @returns {Promise<ign[]>}
   */
  getList: async function(system) {
    return await Ign.find({ system }).exec();
  },

  /**
   * Save a user's IGN
   * @param {discordId} discordId Which user's IGN to save
   * @param {string} system Which system IGN to save (consult the Google Sheet for a list)
   * @param {string} ign The IGN to save
   * @returns {Promise<ign>}
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