const Augur = require("augurbot"),
  { MessageActionRow, MessageButton } = require('discord.js');

const dict = {
  "ᔑ": "a",
  "ʖ": "b",
  "ᓵ": "c",
  "↸": "d",
  "ŀ": "e",
  "⎓": "f",
  "ㅓ": "g",
  "〒": "h",
  "╎": "i",
  "፧": "j",
  "ꖌ": "k",
  "ꖎ": "l",
  "ᒲ": "m",
  "リ": "n",
  "フ": "o",
  "¡": "p",
  "ᑑ": "q",
  "።": "r",
  "ነ": "s",
  "ﬧ": "t",
  "⚍": "u",
  "⍊": "v",
  "∴": "w",
  "∕": "x",
  "॥": "y",
  "∩": "z",
  "zeroWidthSpace": "​"
};

function translate(sga) {
  let to = "";

  let upper = false;

  for (let i = 0; i < sga.length; i++) {
    const c = sga.charAt(i);
    if (c === dict.zeroWidthSpace) {
      upper = true;
      continue;
    }

    const f = dict[c];
    to += f ? (upper ? f.toUpperCase() : f) : c;
    upper = false;
  }

  return to;
}

async function handleMessage(msg) {
  if (msg.author.bot || !([...msg.content].some(char => Object.keys(dict).includes(char)))) {
    return;
  }

  const row = new MessageActionRow()
  .addComponents(
    new MessageButton()
      .setCustomId('sgaTranslate')
      .setLabel('Translate')
      .setStyle('PRIMARY'),
  );

  await msg.reply({
    components: [row]
  });
}

async function handleButton(inter) {
  if (!inter.isButton() || inter.customId !== "sgaTranslate") return;

  let message;

  try {
    message = await inter.message.fetchReference();
  } catch (e) {
    await inter.reply({ content: "It appears the message was deleted.", ephemeral: true });
    await inter.message.delete();
    return;
  }

  const translated = translate(message.content);
  await inter.reply({ content: translated, ephemeral: true });
}

const Module = new Augur.Module()
  .addEvent("messageCreate", handleMessage)
  .addEvent("interactionCreate", handleButton);

module.exports = Module;