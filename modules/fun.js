const Augur = require("augurbot"),
  u = require("../utils/utils"),
  melonFacts = require("../data/buttermelon.json"),
  emoji = require('../utils/emojiCharacters.js'),
  sf = require('../config/snowflakes.json'),
  Jimp = require("jimp"),
  profanityFilter = require("profanity-matcher");
const pf = new profanityFilter();
function eightball(int) {
  if (!int.options.getString("question").endsWith("?")) {
    return "you need to ask me a question, silly.";
  } else {
    const outcomes = [
      "It is certain.",
      "It is decidedly so.",
      "Without a doubt.",
      "Yes - definitely.",
      "You may rely on it.",
      "As I see it, yes.",
      "Most likely.",
      "Outlook good.",
      "Yes.",
      "Signs point to yes.",
      "Don't count on it.",
      "My reply is no.",
      "My sources say no.",
      "Outlook not so good.",
      "Very doubtful."
    ];
    const embed = u.embed().setTitle(int.options.getString("question")).setDescription(`🎱 ${u.rand(outcomes)}`);
    return { embeds: [embed] };
  }
}
function acronym() {
  const alphabet = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "Y", "Z"];
  const len = Math.floor(Math.random() * 3) + 3;
  let word = [];
  while (word.length == 0) {
    for (let i = 0; i < len; i++) {
      word.push(alphabet[Math.floor(Math.random() * alphabet.length)]);
    }
    word = word.join("");

    if (pf.scan(word.toLowerCase()).length == 0) return `I've always wondered what __**${word}**__ stood for...`;
    else word = [];
  }
}
function allthe(int) {
  const input = int.options.getString('things');
  return { content: `${(int.member?.displayName ?? int.user.username)}:\nALL THE ${input?.toUpperCase()}!`, files: ["https://cdn.discordapp.com/emojis/250348426817044482.png"] };
}
function buttermelon() {
  return `🍌  ${u.rand(melonFacts)}`;
}
async function color(int) {
  const suffix = int.options.getString('color');
  try {
    let col;
    if (suffix.startsWith('0x')) col = "#" + suffix.substr(2);
    else col = suffix;
    if (!["#000000", "black", "#000000FF"].includes(col)) col = Jimp.cssColorToHex(col);
    if (col != 255) {
      const img = new Jimp(256, 256, col);
      const result = await img.getBufferAsync(Jimp.MIME_PNG);
      return { files: [result] };
    } else {
      return { content: `sorry, I couldn't understand the color "${suffix}"`, ephemeral: true };
    }
  } catch (error) {
    return { content: `sorry, I couldn't understand the color "${suffix}"`, ephemeral: true };
  }
}
function fine(int) {
  const target = int.options.getUser("target", true);
  return `${target} You are fined one credit for a violation of the Verbal Morality Statute. Reason Code: 2DANK`;
}
function hbs(int) {
  const userPick = int.options.getString('choice');
  const botPick = u.rand(["b", "h", "s"]);
  const options = {
    "b": { emoji: int.client.emojis.cache.get(sf.emoji.buttermelon)?.toString(), value: 0 },
    "h": { emoji: int.client.emojis.cache.get(sf.emoji.handicorn)?.toString(), value: 1 },
    "s": { emoji: int.client.emojis.cache.get(sf.emoji.sloth)?.toString(), value: 2 }
  };
  const diff = options[botPick].value - options[userPick].value;
  const prefix = `You picked ${options[userPick].emoji}, I picked ${options[botPick].emoji}. `;

  if (diff == 0) return prefix + "It's a tie!";
  else if ((diff == -1) || (diff == 2)) return prefix + "I win!";
  else return prefix + "You win!";
}
async function hug(int) {
  const hugs = [
    "http://24.media.tumblr.com/72f1025bdbc219e38ea4a491639a216b/tumblr_mo6jla4wPo1qe89guo1_1280.gif",
    "https://cdn.discordapp.com/attachments/96335850576556032/344202091776049152/hug.gif"
  ];
  const target = int.options.getUser('target', true);
  if (target.id == int.client.user.id) return "I can't send myself a hug, silly!";
  await target.send({ content: `Incoming hug from **${int.user.username}**!`, files: [{ "attachment": u.rand(hugs), "name": "hug.gif" }] })
  .catch(() => {
    return `I couldn't send a hug to ${target}. Maybe they blocked me?`;
  });
  return "Hug on the way!";
}
function minesweeper(int) {
  let size = 0;
  let mineCount = 0;
  const suffix = int.options.getString("difficulty");
  switch (suffix) {
  case "e": {
    size = mineCount = 5;
    break;
  } case "m": {
    size = 10;
    mineCount = 30;
    break;
  } case "h": {
    size = 14;
    mineCount = 60;
    break;
  }
  }

  // Getting all possible board spaces
  const possibleSpaces = Array.from({ length: size * size }, (v, k) => k);
  // Remove 4 corners, corners can't be mines
  possibleSpaces.splice((size * size) - 1, 1);
  possibleSpaces.splice((size - 1) * size, 1);
  possibleSpaces.splice(size - 1, 1);
  possibleSpaces.splice(0, 1);
  // Finding out where the mines will be
  const mineSpaces = [];
  for (let i = 0; i < mineCount; i++) {
    const random = Math.floor(Math.random() * possibleSpaces.length);
    mineSpaces.push(possibleSpaces[random]);
    possibleSpaces.splice(random, 1);
  }

  function getMineCount(x, y) {
    let count = 0;
    for (let i = -1; i <= 1; i++) {
      if ((x + i) < 0 || (x + i) >= size) continue;
      for (let j = -1; j <= 1; j++) {
        if ((y + j) < 0 || (y + j) >= size) continue;
        if (mineSpaces.includes((y + j) * size + x + i)) count++;
      }
    }

    return count;
  }

  // Creating the final board
  const board = [];
  for (let x = 0; x < size; x++) {
    board.push([]);
    for (let y = 0; y < size; y++) {
      if (mineSpaces.includes(x + (y * size))) {
        board[x].push(9);
        continue;
      }
      board[x].push(getMineCount(x, y));
    }
  }

  const output = board.map(row => row.map(num => `||${num == 9 ? "💣" : emoji[num]}||`).join("")).join("\n");

  return `**Mines: ${mineCount}** (Tip: Corners are never mines)\n${output}`;
}
async function repost(int) {
  let post = await int.channel.messages.fetch({ limit: 100 });
  post = post.filter(m => m.attachments.size > 0);
  if (post.size > 0) return { files: [post.last().attachments.first().url] };
  else return { content: `I couldn't find anything to repost!`, ephemeral: true };
}


const Module = new Augur.Module()
.addInteractionCommand({ name: "fun",
  commandId: sf.commands.fun,
  process: async interaction => {
    let response;
    switch (interaction.options.getSubcommand(true)) {
    case "8ball": {
      response = eightball(interaction); break;
    } case "acronym": {
      response = acronym(); break;
    } case "allthe": {
      response = allthe(interaction); break;
    } case "buttermelon": {
      response = buttermelon(); break;
    } case "color": {
      response = await color(interaction); break;
    } case "fine": {
      response = fine(interaction); break;
    } case "hbs": {
      response = hbs(interaction); break;
    } case "hug": {
      response = await hug(interaction); break;
    } case "minesweeper": {
      response = minesweeper(interaction); break;
    } case "repost": {
      response = await repost(interaction); break;
    }
    }
    interaction.reply(response);
  }
})
.addInteractionCommand({ name: "react",
  commandId: sf.commands.react,
  process: async (interaction) => {
    const reactions = new u.Collection(require('../data/reactions.json'));
    const choice = interaction.options.getString('reaction');
    const react = reactions.get(choice);
    if (react.length == 0) return;
    return interaction.reply({ content: `${interaction.member?.displayName ?? interaction.user.username} right now:`, files: [u.rand(react)] });
  }
});

module.exports = Module;
