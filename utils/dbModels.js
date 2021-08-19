const mongoose = require("mongoose"),
  config = require("../config/config.json"),
  Bank = require("../models/Bank.model");

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
      if (data.discordId.id) data.discordId = data.discordId.id;
      let record = new Bank(data);
      return await record.save();
    }
  }
};

module.exports = models;
