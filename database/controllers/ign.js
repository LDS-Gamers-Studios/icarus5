const Discord = require("discord.js");

const Ign = require("../models/Ign.model");

module.exports = {
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
  /**
   * Delete an IGN
   * @param {discordId} discordId Which user's IGN to delete
   * @param {keyof system} system Which system IGN to delete
   * @returns {Promise<ign>}
   */
  delete: async function(discordId, system) {
    if (discordId.id) discordId = discordId.id;
    return await Ign.findOneAndRemove({ discordId, system }).exec();
  },
  /**
   * Find an IGN
   * @param {discordId} discordId Which user's IGN to find
   * @param {keyof system} system Which system IGN to find
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
   * @param {keyof system} system Whcih system list to fetch
   * @returns {Promise<ign[]>}
   */
  getList: function(system) {
    return Ign.find({ system }).exec();
  },
  /**
   * Save a user's IGN
   * @param {discordId} discordId Which user's IGN to save
   * @param {system} system Which system IGN to save
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

/**
 * @typedef system
 * @property {string} battlenet
 * @property {string} dragalia
 * @property {string} elite
 * @property {string} epic
 * @property {string} gog
 * @property {string} guildwars
 * @property {string} guildwars
 * @property {string} hirez
 * @property {string} lol
 * @property {string} minecraft
 * @property {string} nnid
 * @property {string} 3ds
 * @property {string} switch
 * @property {string} origin
 * @property {string} poke-go
 * @property {string} poke-tcgo
 * @property {string} ps
 * @property {string} pubg
 * @property {string} roblox
 * @property {string} rocketid
 * @property {string} runescape
 * @property {string} spaceengineers
 * @property {string} steam
 * @property {string} uplay
 * @property {string} warframe
 * @property {string} xb
 * @property {string} mixer
 * @property {string} twitch
 * @property {string} youtube
 * @property {string} credly
 * @property {string} fb
 * @property {string} playerme
 * @property {string} reddit
 * @property {string} skype
 * @property {string} twitter
 * @property {string} uproar
 * @property {string} birthday
 * @property {string} job
 * @property {string} location
 * @property {string} nick
 * @property {string} timezone
 * @property {string} stake
 */