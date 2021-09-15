const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const InfractionSchema = new Schema({
  discordId: String,
  channel: String,
  message: String,
  flag: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: String,
  value: {
    type: Number,
    default: 0
  },
  mod: String
});

module.exports = mongoose.model("Infraction", InfractionSchema);
