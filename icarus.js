const { AugurClient } = require("augurbot"),
  config = require("./config/config.json"),
  u = require("./utils/utils");

const client = new AugurClient(config, {
  clientOptions: {
    allowedMentions: {
      parsed: ["roles", "users"],
      repliedUser: true
    },
    partials: ["CHANNEL", "MESSAGE", "REACTION"]
  },
  commands: "./modules",
  errorHandler: u.errorHandler,
  parse: u.parse
});

client.login();

// LAST DITCH ERROR HANDLING
process.on("unhandledRejection", (error, p) => p.catch(e => u.errorHandler(e, "Unhandled Rejection")));
process.on("uncaughtException", (error) => u.errorHandler(error, "Uncaught Exception"));

module.exports = client;
