const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const IgnSchema = new Schema({
  discordId: String,
  system: String,
  ign: String,
});

module.exports = mongoose.model("Ign", IgnSchema);
