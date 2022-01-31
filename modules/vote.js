const Augur = require("augurbot"),
  sf = require("../config/snowflakes"),
  u = require("../utils/utils"),
  Discord = require("discord.js");

const activeVotes = [];

async function vote(inter) {
  await inter.reply({ content: "Creating your vote!" });
  const title = inter.options.getString("title");
  const optionsString = inter.options.getString("options");
  const duration = inter.options.getNumber("duration") ?? 60;

  const options = optionsString.split(',')
    .map(o => {
      return {
        label: o,
        value: u.customId(),
      };
    });

  const e = u.embed(inter.member)
    .setTitle(`Vote by ${inter.member}!`)
    .setDescription(title);

  const selectId = u.customId();
  const row = new Discord.MessageActionRow()
    .addComponents(
      new Discord.MessageSelectMenu()
        .setCustomId(selectId)
        .setPlaceholder('Nothing Selected')
        .addOptions(options),
    );

  const message = await inter.channel.send({ embeds: [ e ], components: [ row ] });

  activeVotes.push({
    message: message.id,
    title: title,
    duration: duration,
    options: options,
    votes: []
  });
}

const Module = new Augur.Module()
.addInteractionCommand({ name: "Vote", commandId: sf.commands.vote, process: vote });

module.exports = Module;