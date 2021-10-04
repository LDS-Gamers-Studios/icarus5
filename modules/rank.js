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
        const members = interaction.guild.members.cache;

        // View leaderboard
        await interaction.deferReply();
        const leaderboard = await Module.db.user.getLeaderboard({
          members,
          member: interaction.member
        });

        const records = leaderboard.map(l => `${l.rank}: ${members.get(l.discordId).toString()} (${l.currentXP.toLocaleString()} XP)`);
        const embed = u.embed()
        .setTitle("LDSG Chat Season Leaderboard")
        .setThumbnail(interaction.guild.iconURL({ format: "png" }))
        .setURL("https://my.ldsgamers.com/leaderboard")
        .setDescription("Current season chat rankings:\n" + records.join("\n"))
        .setFooter("Use `/rank track` to join the leaderboard!");

        await interaction.editReply({ embeds: [embed] });
      } else if (subcommand === "track") {
        await interaction.deferReply({ ephemeral: true });
        const track = interaction.options.getBoolean("choice");
        await Module.db.user.trackXP(interaction.user, track);
        await interaction.editReply({
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
