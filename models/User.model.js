const mongoose = require('mongoose'),
  Schema = mongoose.Schema;

const UserSchema = new Schema({
  discordId: String,
  roles: [String],
  badges: [String],
  posts: {
    type: Number,
    default: 0
  },
  excludeXP: {
    type: Boolean,
    default: true
  },
  currentXP: {
    type: Number,
    default: 0
  },
  totalXP: {
    type: Number,
    default: 0
  },
  priorTenure: {
    type: Number,
    default: 0
  },
  twitchFollow: {
    type: Boolean,
    default: false
  }
});

module.exports = mongoose.model("User", UserSchema);
