const Discord = require("discord.js");

const Bank = require("../models/Bank.model");

/**
 * @typedef CurrencyRecord
 * @property {String} discordId
 * @property {Date} timestamp
 * @property {String} description
 * @property {Number} value
 * @property {String} currency
 * @property {String} giver
 * @property {Boolean} hp
 *
 * @typedef {string|Discord.User|Discord.GuildMember} discordId A user ID or instance of `Discord.User` or `Discord.GuildMember`
 */

module.exports = {
  /**
   * Gets a user's current balance for a given currency.
   *
   * @typedef balanceObject
   * @property {discordId} discordId
   * @property {"em"|"gb"} currency
   * @property {number} balance
   *
   * @param {discordId} discordId The user whose balance you want to view.
   * @param {"em"|"gb"} currency The currency to view.
   * @return {Promise<balanceObject>} Object with `discordId`, `currency`, and `balance` properties.
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
   * @typedef currencyData The data object.
   * @property {discordId} discordId The user to give the currency.
   * @property {discordId} giver The user giving the currency.
   * @property {"em"|"gb"} [currency="em"] The type of currency to give.
   * @property {Number} value The amount to give.
   * @property {Boolean} [hp=false] Whether the addition counts for house points.
   */
  /**
   * Adds currency to a user's account.
   * @param {currencyData} data The data to save
   * @return {Promise<CurrencyRecord>} A record of the addition.
   */
  addCurrency: async function(data) {
    data.discordId = data.discordId.id ?? data.discordId;
    data.giver = data.giver.id ?? data.giver;
    const record = new Bank(data);
    return await record?.save().exec();
  }
};
