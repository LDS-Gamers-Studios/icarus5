const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const TagSchema = new Schema({
  tag: String,
  response: String,
  attachment: String,
  url: String
});

module.exports = mongoose.model("Tag", TagSchema);