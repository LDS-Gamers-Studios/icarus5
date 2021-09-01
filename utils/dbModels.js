const config = require("../config/config.json"),
  moment = require("moment"),
  mongoose = require("mongoose");

const Bank = require("../models/Bank.model"),
  User = require("../models/User.model");

mongoose.connect(config.db.db, config.db.settings);

const models = {
  bank: {
    getBalance: async function(discordId, currency) {
      if (discordId.id) discordId = discordId.id;
      let record = await Bank.aggregate([
        { $match: { discordId, currency }},
        { $group: { _id: null, balance: {$sum: "$value"}}}
      ]).exec();
      if (record && (record.length > 0)) return {discordId, currency, balance: record[0].balance};
      else return {discordId, currency, balance: 0};
    },
    addCurrency: async function(data) {
      data.discordId = data.discordId.id ?? data.discordId;
      data.giver = data.giver.id ?? data.giver;
      let record = new Bank(data);
      return await record.save();
    }
  },
  user: {
    /**
     * Fetch a user record from the database.
     * @param {(string|Discord.User|Discord.GuildMember)} discordId The user record to fetch.
     * @returns {Promise<user>}
     */
    fetchUser: function(discordId) {
      discordId = discordId.id ?? discordId;
      return User.findOne({discordId}).exec();
    },
    /**
     * Updates a guild member's tenure in the server database.
     * @param {Discord.GuildMember} member The guild member to update.
     * @returns {Promise<user>}
     */
    updateTenure: function(member) {
      return User.findOneAndUpdate(
        {discordId: member.id},
        {$inc: { priorTenure: moment().diff(moment(member.joinedAt), "days") }},
        {new: true, upsert: false}
      ).exec();
    }
  }
};

module.exports = models;
