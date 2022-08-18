const Augur = require("augurbot"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes");

// Message context menu for bookmarking a message.

const Module = new Augur.Module()
.addInteractionCommand({ name: "Bookmark",
  commandId: sf.commands.messageBookmark,
  process: async (interaction) => {
    try {
      await interaction.deferReply?.({ ephemeral: true });
      const message = await interaction.channel.messages.fetch(interaction.targetId);
      if (message) {
        await interaction.editReply({ content: "I'm sending you a DM!", ephemeral: true });
        const embed = u.embed({ author: message.member ?? message.user })
          .setDescription(message.cleanContent)
          .setColor(message.member?.displayColor)
          .setTimestamp(message.createdAt);
        interaction.user.send({ embeds: [embed].concat(message.embeds), files: Array.from(message.attachments.values()) }).catch(u.noop);
      } else {
        interaction.editReply({ content: "Against all odds, I couldn't find that message.", ephemeral: true });
      }
    } catch (error) {
      u.errorHandler(error, interaction);
    }
  }
});

module.exports = Module;
