const Tag = require("../models/Tag.model");

module.exports = {
  /**
   * @typedef tag
   * @property {string} tag the tag name
   * @property {string} response the tag response
   * @property {string} attachment the tag file name
   * @property {string} guildId the guild the tag belongs to
   * @property {string} url the tag file url
   * @property {string} _id the ID of the DB entry
   */
  /**
   * Fetch all tags
   * @returns {Promise<tag[]>}
   */
  fetchAllTags: async function() {
    return await Tag.find({}).exec();
  },
  /**
   * Fetch all tags in a guild
   * @param {string} guildId
   * @returns {Promise<tag[]>}
   */
  fetchAllGuildTags: async function(guildId) {
    return await Tag.find({ guildId });
  },
  /**
   * Add a tag to the database
   * @param {tag} data tag data
   * @returns {Promise<tag>} the created tag
   */
  addTag: async function(data) {
    if (await Tag.exists({ tag: data.tag, guildId: data.guildId })) return null;
    return new Tag(data).save();
  },
  /**
   * Modify a tag
   * @param {tag} data tag data
   * @returns {Promise<tag>} the updated tag
   */
  modifyTag: async function(data) {
    if (!await Tag.exists({ tag: data.tag, guildId: data.guildId })) return null;
    return await Tag.findOneAndUpdate({ tag: data.tag, guildId: data.guildId }, data, { new: true }).exec();
  },
  /**
   * Delete a tag
   * @param {string} name the tag to delete
   * @param {string} guildId the guild that has the tag
   * @returns {Promise<tag>} the deleted tag
   */
  deleteTag: async function(tag, guildId) {
    if (!await Tag.exists({ tag, guildId })) return null;
    return await Tag.findOneAndDelete({ tag, guildId }).exec();
  }
};
