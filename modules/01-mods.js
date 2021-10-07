const Augur = require("augurbot"),
  u = require("../utils/utils"),
  config = require("../config/config.json");

function compareRoles(mod, target) {
  const modHigh = mod.roles.cache.filter(r => r.id != Module.config.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  const targetHigh = target.roles.cache.filter(r => r.id != Module.config.roles.live)
    .sort((a, b) => b.comparePositionTo(a)).first();
  return (modHigh.comparePositionTo(targetHigh) > 0);
}

function isMod(interaction) {
  return interaction.member.roles.cache.some(r => ([Module.config.roles.management, Module.config.roles.mod].includes(r.id)));
}

async function slashModBan(interaction) {
  try {
    await interaction.deferReply();
    const target = interaction.options.getMember("ban");
    const reason = interaction.options.getString("reason");
    const days = interaction.options.getInteger("clean") ?? 1;

    if (!compareRoles(interaction.member, target)) {
      await interaction.editReply(`You have insufficient permissions to ban ${target}!`);
      return;
    }

    const confirm = await u.confirmInteraction(interaction, `Ban ${target.toString()} for:\n${reason}?`, `Confirm Ban on ${target.toString()}`);
    if (confirm) {
      // Do the ban!

      // Edit interaction
      await interaction.editReply({
        embeds: [
          u.embed({ author: interaction.member })
          .setColor(0x00ff00)
          .setDescription(`${target.toString()} banned for:\n${reason}`)
        ],
        components: []
      });

      // Do the ban
      const targetRoles = target.roles.cache.clone();
      await target.send({ embeds: [
        u.embed()
        .setTitle("User Ban")
        .setDescription(`You have been banned in ${interaction.guild.name} for:\n${reason}`)
      ] }).catch(() => u.blocked(target));
      await target.ban({ days, reason });

      // Save infraction
      const infraction = Module.db.infraction.save({
        discordId: target.id,
        description: `[User Ban]: ${reason}`,
        value: 30,
        mod: interaction.member.id
      });

      // Save roles
      targetRoles.set(Module.config.roles.untrusted, null).delete(Module.config.roles.trusted);
      const fakeTarget = {
        id: target.id,
        roles: { cache: targetRoles }
      };
      Module.db.user.updateRoles(fakeTarget);

      // Log it
      interaction.client.channels.cache.get(Module.config.channels.modlogs).send({ embeds: [
        u.embed({ author: target })
        .setTitle("User Ban")
        .setDescription(`**${infraction.member}** banned **${target}** for:\n${reason}`)
        .setColor(0x0000ff)
      ] });
    } else {
      // Never mind
      await interaction.editReply({
        embeds: [u.embed({ author: interaction.member }).setColor(0x0000ff).setDescription(`Ban ${confirm === false ? "cancelled" : "timed out"}`)],
        components: []
      });
    }
    u.cleanInteraction(interaction);
  } catch (error) { u.errorHandler(error, interaction); }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "mod",
  guildId: config.ldsg,
  commandId: undefined,
  permissions: (interaction) => interaction.member.roles.cache.has(Module.config.roles.mod),
  process: async (interaction) => {
    try {
      const subcommand = interaction.options.getSubcommand(true);
      switch (subcommand) {
        case "ban":
          await slashModBan(interaction);
          break;
        //case "kick":
        //  await slashModKick(interaction);
        //  break;
        //case "mute":
        //  await slashModMute(interaction);
        //  break;
        //case "note":
        //  await slashModNote(interaction);
        //  break;
        //case "office":
        //  await slashModOffice(interaction);
        //  break;
        //case "purge":
        //  await slashModPurge(interaction);
        //  break;
        //case "rename":
        //  await slashModRename(interaction);
        //  break;
        //case "slowmode":
        //  await slashModSlowmode(interaction);
        //  break;
        //case "summary":
        //  await slashModSummary(interaction);
        //  break;
        //case "trust":
        //  await slashModTrust(interaction);
        //  break;
        //case "warn":
        //  await slashModWarn(interaction);
        //  break;
        default:
          interaction.reply({
            content: "Well, this is embarrasing. I don't know how to handle that (yet).",
            ephemeral: true
          });
          //u.errorHandler(Error("Unknown Interaction Subcommand"), interaction);
      }
    } catch (error) { u.errorHandler(error, interaction); }
  }
});

module.exports = Module;
