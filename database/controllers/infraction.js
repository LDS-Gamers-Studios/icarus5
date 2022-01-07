const Discord = require("discord.js"),
  moment = require("moment");

const Infraction = require("../models/Infraction.model");

module.exports = {

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
     * @function remove
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
    data.channel = data.channel?.id ?? data.channel;
    data.mod = data.mod.id ?? data.mod;
    data.flag = data.flag?.id ?? data.flag;

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
};
