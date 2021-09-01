const config = require("../config/config.json"),
  moment = require("moment"),
  mongoose = require("mongoose");

const User = require("../models/User.model");

mongoose.connect(config.db.db, config.db.settings);

const models = {
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
