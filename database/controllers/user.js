const Discord = require("discord.js"),
  moment = require("moment");

const User = require("../models/User.model");

const models = {
  /**
     * Add XP to a set of users
     * @function addXp
     * @param {Set<String>} users Users to add XP
     * @returns {Promise<User>}
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
     * @function fetchUser
     * @param {(string|Discord.User|Discord.GuildMember)} discordId The user record to fetch.
     * @returns {Promise<User>}
     */
  fetchUser: async function(discordId, createIfNotFound = true) {
    discordId = discordId.id ?? discordId;
    let user = await User.findOne({ discordId }).exec();
    if (!user && createIfNotFound) {
      user = await models.newUser(discordId);
    }
    return user;
  },
  /**
     * Get the top X of the leaderboard
     * @function getLeaderboard
     * @param {Object} leaderboardOptions Options for the leaderboard fetch
     * @param {Discord.Collection|Array} leaderboardOptions.members Collection or Array of snowflakes to include in the leaderboard
     * @param {Number} leaderboardOptions.limit
     * @param {(string|Discord.User|Discord.GuildMember)} leaderboardOptions.member A user to include in the results, no matter their ranking.
     * @param {Boolean} leaderboardOptions.season Whether to fetch the current season (`true`, default) or lifetime (`false`) leaderboard.
     * @returns {Promise<Array(User)>}
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
      const record = await models.getRank(member, members);
      if (!season) record.rank = record.lifetime;
      if (record) records.push(record);
    }

    return records;
  },
  /**
     * Get a user's rank
     * @function getRank
     * @param {(string|Discord.User|Discord.GuildMember)} member The member whose ranking you want to view.
     * @param {Discord.Collection|Array} members Collection or Array of snowflakes to include in the leaderboard
     * @returns {Promise<User>}
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
     * @function getUsers
     * @param {object} query
     * @returns {Promise<users>}
     */
  getUsers: function(query) {
    return User.find(query).exec();
  },
  /**
     * Create a new user record
     * @function newUser
     * @param {string|Discord.GuildMember|Discord.User} discordId The guild member record to create
     * @returns {Promise<User>}
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
      return newMember.save();
    }
  },
  /**
     * Update a member's track XP preference
     * @function trackXp
     * @param {Discord.GuildMember} member The guild member to update.
     * @param {Boolean} track Whether to track the member's XP.
     * @returns {Promise<User>}
     */
  trackXP: function(member, track = true) {
    return User.findOneAndUpdate(
      { discordId: member.id ?? member },
      { $set: { excludeXP: !track } },
      { new: true, upsert: false }
    ).exec();
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
     * @returns {Promise<User>}
     */
  updateTenure: function(member) {
    return User.findOneAndUpdate(
      { discordId: member.id },
      { $inc: { priorTenure: (moment().diff(moment(member.joinedAt), "days") || 0) } },
      { new: true, upsert: false }
    ).exec();
  }
};

module.exports = models;
