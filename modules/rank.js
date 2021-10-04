const Augur = require("augurbot"),
  Rank = require("../utils/RankInfo"),
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
        await interaction.deferReply();
        const members = interaction.guild.members.cache;
        const member = interaction.options.getMember("user") ?? interaction.member;
        const leaderboard = await Module.db.user.getLeaderboard({ members, member });
        const record = leaderboard.find(r => r.discordId == member.id);

        if (record) {
          const embed = u.embed({ author: member })
          .setTitle("LDSG Chat Season Ranking")
          .setURL("https://my.ldsgamers.com/leaderboard")
          .setFooter("https://my.ldsgamers.com/leaderboard")
          .addField("Rank", `Season: ${record.rank} / ${members.size}`)
          .addField("Level")
          .addField("Exp.", `Season: ${record.currentXP.toLocaleString()} XP\nLifetime: ${record.totalXP.toLocaleString()} XP`);

          await interaction.editReply({ embeds: [embed] });
        } else {
          const snark = [
            "don't got time for dat.",
            "ain't interested in no XP gettin'.",
            "don't talk to me no more, so I ignore 'em."
          ];
          await interaction.editReply(`**${member}** ${u.rand(snark)}\n(Try \`/rank track\` if you want to participate in chat ranks!)`);
        }
      } else if (subcommand === "leaderboard") {
        // View leaderboard
        await interaction.deferReply();

        const members = interaction.guild.members.cache;

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
        // Set XP tracking
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
