const Discord = require("discord.js");

const Bank = require("../models/Bank.model");

/**
 * @typedef {Object} CurrencyRecord
 * @property {String} discordId
 * @property {Date} timestamp
 * @property {String} description
 * @property {Number} value
 * @property {String} currency
 * @property {String} giver
 * @property {Boolean} hp
 */

module.exports = {
  /**
   * Gets a user's current balance for a given currency.
   *
   * @async
   * @function getBalance
   * @param {String|Discord.User|Discord.GuildMember} discordId The user whose balance you want to view.
   * @param {String} currency The currency to view ("em" or "gb").
   * @return {Promise<object>} Object with `discordId`, `currency`, and `balance` properties.
   */
  getBalance: async function(discordId, currency) {
    if (discordId.id) discordId = discordId.id;
    const record = await Bank.aggregate([
      { $match: { discordId, currency } },
      { $group: { _id: null, balance: { $sum: "$value" } } }
    ]).exec();
    return { discordId, currency, balance: (record[0]?.balance ?? 0) };
  },
  /**
     * Adds currency to a user's account.
     *
     * @function addCurrency
     * @param {Object} data The data object.
     * @param {String|Discord.User|Discord.GuildMember} data.discordId The user to give the currency.
     * @param {String|Discord.User|Discord.GuildMember} data.giver The user giving the currency.
     * @param {String} [data.currency="em"] The type of currency to give ("em" or "gb").
     * @param {Number} data.value The amount to give.
     * @param {Boolean} [data.hp=false] Whether the addition counts for house points.
     * @return {Promise<CurrencyRecord>} A record of the addition.
     */
  addCurrency: function(data) {
    data.discordId = data.discordId.id ?? data.discordId;
    data.giver = data.giver.id ?? data.giver;
    const record = new Bank(data);
    return record.save();
  }
};
