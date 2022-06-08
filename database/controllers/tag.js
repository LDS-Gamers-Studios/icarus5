const Tag = require("../models/Tag.model");

module.exports = {
  /**
   * @typedef tag
   * @property {string} tag the tag name
   * @property {string} response the tag response
   * @property {string} attachment the tag file name
   * @property {string} url the tag file url
   * @property {string} _id the ID of the DB entry
   */
  /**
   * Fetch all tags
   * @returns {Promise<tag>}
   */
  fetchTags: async function() {
    return await Tag.find({}).exec();
  },
  /**
   * Add a tag to the database
   * @param {tag} data tag data
   * @returns {tag} the created tag
   */
  addTag: async function(data) {
    if (await Tag.exists({ tag: data.tag })) return null;
    return new Tag(data).save();
  },
  /**
   * Modify a tag
   * @param {tag} data tag data
   * @returns {tag} the updated tag
   */
  modifyTag: async function(data) {
    if (!await Tag.exists({ tag: data.tag })) return null;
    return await Tag.findOneAndUpdate({ tag: data.tag }, data, { new: true }).exec();
  },
  /**
   * Delete a tag
   * @param {string} name the tag to delete
   * @returns {tag} the deleted tag
   */
  deleteTag: async function(tag) {
    if (!await Tag.exists({ tag })) return null;
    return await Tag.findOneAndDelete({ tag }).exec();
  }
};
