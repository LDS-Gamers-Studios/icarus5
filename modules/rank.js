const Augur = require("augurbot"),
  config = require("../config/config.json"),
  u = require("../utils/utils");

const Module = new Augur.Module()
.addInteractionCommand({
  name: "rank",
  guildId: config.ldsg,
  commandId: undefined,
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);

      if (subcommand === "view") {
        // View member rankings
      } else if (subcommand === "leaderboard") {
        // View leaderboard
      } else if (subcommand === "track") {
        await interaction.deferReply({ ephemeral: true });
        const track = interaction.options.getBoolean("choice");
        await Module.db.user.trackXP(interaction.user, track);
        await interaction.reply({
          content: `Ok! I'll ${track ? "start" : "stop"} tracking your XP!`,
          ephemeral: true
        });
      } else {
        interaction.reply({
          content: "Well, this is embarrasing. I don't know what you asked for.",
          ephemeral: true
        });
      }
    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
})
.setClockwork(() => {
  // Do stuff
});

module.exports = Module;
