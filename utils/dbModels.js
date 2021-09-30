const config = require("../config/config.json"),
  Discord = require("discord.js"),
  moment = require("moment"),
  mongoose = require("mongoose");

const Bank = require("../models/Bank.model"),
  Infraction = require("../models/Infraction.model"),
  User = require("../models/User.model");

mongoose.connect(config.db.db, config.db.settings);

const models = {
  bank: {
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
  },
  infraction: {
    /**
     * Get an infraction by its associated mod flag.
     * @function getByFlag
     * @param {String|Discord.Message} flag The mod flag for the infraction
     */
    getByFlag: function(flag) {
      if (flag.id) flag = flag.id;
      return Infraction.findOne({ flag }).exec();
    },
    /**
     * Get a summary of a user's infractions.
     * @async
     * @function getSummary
     * @param {String|Discord.User|Discord.Member} discordId The user whose summary you want to view.
     * @param {Number} [time=28] The time in days to review.
     */
    getSummary: async function(discordId, time = 28) {
      discordId = discordId.id ?? discordId;
      const since = moment().subtract(time, "days");
      const records = await Infraction.find({ discordId, timestamp: { $gte: since } }).exec();
      return {
        discordId,
        count: records.length,
        points: records.reduce((c, r) => c + r.value, 0),
        time,
        detail: records
      };
    },
    /**
     * Remove/delete an infraction
     * @function retract
     * @param {String|Discord.Message} flag The infraction flag
     */
    remove: function(flag) {
      if (flag.id) flag = flag.id;
      return Infraction.findOneAndDelete({ flag }).exec();
    },
    /**
     * Save an infraction
     * @function save
     * @param {Object} data Data to save
     * @param {String|Discord.User|Discord.GuildMember} data.discordId User's Discord Id
     * @param {String} data.channel The channel Id where the infraction took place
     * @param {String} data.message The message Id where the infraction took place
     * @param {String} data.flag The mod flag created for the infraction
     * @param {String} data.description The description of the infraction
     * @param {String|Discord.User|Discord.GuildMember} data.mod The mod's Discord Id
     * @param {String} data.value The point value of the infraction
     */
    save: function(data) {
      if (data.message instanceof Discord.Message) {
        data.discordId = data.discordId?.id ?? data.discordId ?? data.message.author.id;
        data.channel = data.channel?.id ?? data.channel ?? data.message.channel.id;
        data.description = data.description ?? data.message.cleanContent;
        data.message = data.message.id;
      }
      data.discordId = data.discordId.id ?? data.discordId;
      data.channel = data.channel.id ?? data.channel;
      data.mod = data.mod.id ?? data.mod;
      data.flag = data.flag.id ?? data.flag;

      return new Infraction(data).save();
    },
    /**
     * Update an infraction
     * @function update
     * @param {Infraction} infraction The infraction, post-update
     */
    update: function(infraction) {
      return Infraction.findByIdAndUpdate(infraction._id, infraction, { new: true }).exec();
    }
  },
  user: {
    /**
     * Fetch a user record from the database.
     *
     * @param {(string|Discord.User|Discord.GuildMember)} discordId The user record to fetch.
     * @returns {Promise<user>}
     */
    fetchUser: function(discordId) {
      discordId = discordId.id ?? discordId;
      return User.findOne({ discordId }).exec();
    },
    /**
     * Update a member's roles in the database
     * @function updateRoles
     * @param {Discord.GuildMember} member The member to update
     */
    updateRoles: function(member) {
      return User.findOneAndUpdate(
        { discordId: member.id },
        { $set: { roles: Array.from(member.roles.cache.keys()) } },
        { new: true, upsert: false }
      ).exec();
    },
    /**
     * Updates a guild member's tenure in the server database.
     *
     * @param {Discord.GuildMember} member The guild member to update.
     * @returns {Promise<user>}
     */
    updateTenure: function(member) {
      return User.findOneAndUpdate(
        { discordId: member.id },
        { $inc: { priorTenure: moment().diff(moment(member.joinedAt), "days") } },
        { new: true, upsert: false }
      ).exec();
    }
  }
};

module.exports = models;
