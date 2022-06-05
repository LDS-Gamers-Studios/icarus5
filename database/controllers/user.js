const Discord = require("discord.js"),
  moment = require("moment");

const User = require("../models/User.model");
const models = {
  /**
   * @typedef {string|Discord.User|Discord.GuildMember} discordId
   * @typedef updated
   * @property {user[]} users Users that were updated
   * @property {number} xp XP given to users
   *
   * @typedef user
   * @property {string} discordId
   * @property {number} currentXP
   * @property {number} totalXP
   * @property {number} posts
   * @property {number} stars
   * @property {number} preferences
   * @property {number} ghostBucks
   * @property {string} house
   * @property {boolean} excludeXP
   * @property {boolean} twitchFollow
   * @property {string[]} role
   */

  /**
   * Add XP to a set of users
   * @param {Set<String>} users Users to add XP
   * @returns {Promise<updated>}
   */
  addXp: async function(users) {
    users = Array.from(users.values());
    const response = { users: [], xp: 0 };
    if (users.length == 0) {
      return response;
    } else {
      const xp = Math.floor(Math.random() * 11) + 15;
      response.xp = xp;
      // Update XP for ranked users
      await User.updateMany(
        { discordId: { $in: users }, excludeXP: false },
        { $inc: { currentXP: xp, totalXP: xp } },
        { new: true, upsert: false }
      ).exec();
      // Update post count for all users
      await User.updateMany(
        { discordId: { $in: users } },
        { $inc: { posts: 1 } },
        { new: true, upsert: false }
      ).exec();
      const userDocs = await User.find(
        { discordId: { $in: users } }
      ).exec();
      response.users = userDocs;
      return response;
    }
  },
  /**
   * Fetch a user record from the database.
   * @param {discordId} discordId The user record to fetch.
   * @param {boolean} createIfNotFound Create the user if it isn't stored yet
   * @returns {Promise<user>}
   */
  fetchUser: async function(discordId, createIfNotFound = true) {
    discordId = discordId.id ?? discordId;
    let user = await User.findOne({ discordId }).exec();
    if (!user && createIfNotFound) {
      user = await models.newUser(discordId).exec();
    }
    return user;
  },
  /**
   * @typedef leaderboardOptions
   * @property {Discord.Collection|[]} members Collection or Array of snowflakes to include in the leaderboard
   * @property {number} limit limit the number of results
   * @property {discordId} member A user to include in the results, no matter their ranking.
   * @property {boolean} season Whether to fetch the current season (`true`, default) or lifetime (`false`) leaderboard.
   */
  /**
   * Get the top X of the leaderboard
   * @param {leaderboardOptions} options Options for the leaderboard fetch
   * @returns {Promise<user[]>}
   */
  getLeaderboard: async function(options = {}) {
    const members = (options.members instanceof Discord.Collection ? Array.from(options.members.keys()) : options.members);
    const member = options.member?.id || options.member;
    const season = options.season ?? true;
    const limit = options.limit ?? 10;

    // Get top X users first
    const params = { excludeXP: false };
    if (members) params.discordId = { $in: members };

    const query = User.find(params);
    if (season) query.sort({ currentXP: "desc" });
    else query.sort({ totalXP: "desc" });

    if (limit) query.limit(limit);

    const records = await query.exec();
    for (let i = 0; i < records.length; i++) {
      records[i].rank = i + 1;
    }

    // Get requested user
    const hasMember = records.some(r => r.discordId == member);
    if (member && !hasMember) {
      const record = await models.getRank(member, members).exec();
      if (!season) record.rank = record.lifetime;
      if (record) records.push(record);
    }

    return records;
  },
  /**
   * Get a user's rank
   * @param {discordId} member The member whose ranking you want to view.
   * @param {Discord.Collection|[]} members Collection or Array of snowflakes to include in the leaderboard
   * @returns {Promise<user>}
   */
  getRank: async function(member, members) {
    if (!member) return null;
    member = member?.id || member;
    members = (members instanceof Discord.Collection ? Array.from(members.keys()) : members);

    // Get requested user
    const record = await User.findOne({ discordId: member, excludeXP: false }).exec();
    if (!record) return null;

    let countParams = { excludeXP: false, currentXP: { $gt: record.currentXP } };
    if (members) countParams.discordId = { $in: members };
    const currentCount = await User.count(countParams);
    record.rank = currentCount + 1;

    countParams = { excludeXP: false, totalXP: { $gt: record.totalXP } };
    if (members) countParams.discordId = { $in: members };
    const lifetime = await User.count(countParams);
    record.lifetime = lifetime + 1;

    return record;
  },
  /**
   * Run a user database query
   * @param {object} query
   * @returns {Promise<user[]>}
   */
  getUsers: function(query) {
    return User.find(query).exec();
  },
  /**
   * Create a new user record
   * @param {discordId} discordId The guild member record to create
   * @returns {Promise<user>}
   */
  newUser: async function(discordId) {
    if (discordId.id) discordId = discordId.id;
    const exists = await User.findOne({ discordId }).exec();
    if (exists) {
      return exists;
    } else {
      const newMember = new User({
        discordId,
        currentXP: 0,
        totalXP: 0,
        posts: 0,
        stars: 0,
        preferences: 0,
        ghostBucks: 0,
        house: null,
        excludeXP: true,
        twitchFollow: false,
        roles: []
      });
      return newMember.save().exec();
    }
  },
  /**
   * Update a member's track XP preference
   * @param {discordId} discordId The guild member to update.
   * @param {Boolean} track Whether to track the member's XP.
   * @returns {Promise<user>}
   */
  trackXP: async function(discordId, track = true) {
    if (discordId.id) discordId = discordId.id;
    return await User.findOneAndUpdate(
      { discordId: discordId.id ?? discordId },
      { $set: { excludeXP: !track } },
      { new: true, upsert: false }
    ).exec();
  },
  /**
   * Update a member's roles in the database
   * @param {discordId} discordId The member to update
   * @returns {Promise<user>}
   */
  updateRoles: async function(discordId) {
    if (discordId.id) discordId = discordId.id;
    return await User.findOneAndUpdate(
      { discordId: discordId.id },
      { $set: { roles: Array.from(discordId.roles.cache.keys()) } },
      { new: true, upsert: false }
    ).exec();
  },
  /**
   * Updates a guild member's tenure in the server database.
   * @param {discordId} discordId The guild member to update.
   * @returns {Promise<User>}
   */
  updateTenure: async function(discordId) {
    if (discordId.id) discordId = discordId.id;
    return await User.findOneAndUpdate(
      { discordId: discordId.id },
      { $inc: { priorTenure: (moment().diff(moment(discordId.joinedAt), "days") || 0) } },
      { new: true, upsert: false }
    ).exec();
  }
};

module.exports = models;
