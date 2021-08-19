var mongoose = require('mongoose'),
  Schema = mongoose.Schema;

var BankSchema = new Schema({
  discordId: String,
  timestamp: {
    type: Date,
    default: Date.now
  },
  description: String,
  value: Number,
  currency: String,
  giver: String,
  hp: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("Bank", BankSchema);
