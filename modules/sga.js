/* eslint-disable no-multi-spaces */
const Augur = require("augurbot"),
  { MessageActionRow, MessageButton } = require('discord.js');

const dict = {
  "a": "ᔑ",  "b": "ʖ",   "c": "ᓵ",  "d": "↸",   "e": "ŀ",
  "f": "⎓",  "g": "ㅓ",  "h": "〒",  "i": "╎",   "j": "፧",
  "k": "ꖌ",  "l": "ꖎ",   "m": "ᒲ",   "n": "リ",  "o": "フ",
  "p": "¡",  "q": "ᑑ",  "r": "።",   "s": "ነ",   "t": "ﬧ",
  "u": "⚍",  "v": "⍊",  "w": "∴",   "x": "∕",  "y": "॥",
  "z": "∩",   zeroWidthSpace: '​',
};

const translate = (sga) => {
  let to = "";

  let upper = false;

  for (let i = 0; i < sga.length; i++) {
    const c = sga.charAt(i);
    if (c === dict.zeroWidthSpace) {
      upper = true;
      continue;
    }

    const f = Object.keys(dict).find(key => dict[key] === c);
    to += f ? (upper ? f.toUpperCase() : f) : (upper ? c.toUpperCase() : c);
    upper = false;
  }

  return to;
};

const handleMessage = (msg) => {
  if (msg.author.bot || !([...msg.content].some(char => Object.values(dict).includes(char)))) {
    return;
  }

  const row = new MessageActionRow()
  .addComponents(
    new MessageButton()
      .setCustomId('sgaTranslate')
      .setLabel('Translate')
      .setStyle('PRIMARY'),
  );

  msg.reply({
    components: [row]
  });
};

const handleButton = (inter) => {
  if (!inter.isButton() || inter.customId !== "sgaTranslate") return;
  inter.message.fetchReference()
    .then(async msg => {
      const translated = translate(msg.content);
      await inter.reply({ content: translated, ephemeral: true });
    }).catch(async () => {
      await inter.reply({ content: "It appears the message was deleted.", ephemeral: true });
      await inter.message.delete();
    });
};

const Module = new Augur.Module()
  .addEvent("messageCreate", handleMessage)
  .addEvent("interactionCreate", handleButton);

module.exports = Module;