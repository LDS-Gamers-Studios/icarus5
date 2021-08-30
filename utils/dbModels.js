const config = require("../config/config.json"),
  mongoose = require("mongoose");

mongoose.connect(config.db.db, config.db.settings);

const models = {

};

module.exports = models;
