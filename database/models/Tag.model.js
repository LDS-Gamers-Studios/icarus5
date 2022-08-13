const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const TagSchema = new Schema({
  tag: String,
  guildId: String,
  response: String,
  attachment: String,
  url: String
});

module.exports = mongoose.model("Tag", TagSchema);