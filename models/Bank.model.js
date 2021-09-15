const mongoose = require("mongoose"),
  Schema = mongoose.Schema;

const BankSchema = new Schema({
  discordId: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: String,
  value: Number,
  currency: {
    type: String,
    default: "em"
  },
  giver: String,
  hp: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Bank", BankSchema);
