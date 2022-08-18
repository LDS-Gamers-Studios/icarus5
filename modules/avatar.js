const Augur = require("augurbot"),
  u = require('../utils/utils'),
  sf = require("../config/snowflakes.json"),
  discord = require("discord.js"),
  petPetGif = require('pet-pet-gif'),
  Jimp = require("jimp");

function errorReading(int) {
  int.editReply("Sorry, but I couldn't get the image. Let my devs know if this is a reoccurring problem").then(u.cleanInteraction);
}
async function jimpRead(url) {
  try {
    return await Jimp.read(url);
  } catch {
    return null;
  }
}
/**
 * @param {discord.CommandInteraction} int
 * @param {string} filter filter to apply
 * @param {any[]} params array of params to pass into the filter function
 */
async function basicFilter(int, filter, params) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  if (params) img[filter](...params);
  else img[filter]();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}

/**
 * @param {discord.CommandInteraction} int
 * @param {number} size size of the image
 * @returns {string} image url
 */
function targetImg(int, size = 256) {
  if (int.options.getAttachment('file')) {
    const url = int.options.getAttachment('file').url;
    if (!jimpRead(url)) return null;
    else return url;
  }
  const target = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  return target.displayAvatarURL({ format: 'png', size, dynamic: true });
}
/** @param {discord.CommandInteraction} int */
async function andywarhol(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  const width = img.getWidth();
  const height = img.getHeight();
  const canvas = new Jimp(width * 2 + 36, height * 2 + 36, 0xffffffff);
  const o = 12; // offset
  const positions = [[o, o], [width + o * 2, o], [o, height + o * 2], [width + o * 2, height + o * 2]];
  for (const p of positions) {
    img.color([{ apply: 'spin', params: [60] }]);
    canvas.blit(img, p[0], p[1]);
  }
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function blurple(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  img.color([
    { apply: "desaturate", params: [100] },
    { apply: "saturate", params: [47.7] },
    { apply: "hue", params: [227] }
  ]);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function colorme(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  const color = Math.floor(Math.random() * 359);
  img.color([{ apply: 'hue', params: [color] }]);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ content: `Hue: ${color}`, files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function deepfry(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  img.posterize(20);
  img.color([{ apply: 'saturate', params: [100] }]);
  img.contrast(1);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function flex(int) {
  const img = await jimpRead(targetImg(int, 128));
  if (!img) return errorReading(int);
  const right = await Jimp.read("./media/flexArm.png");
  const left = right.clone().flip(true, Math.random() > 0.5);
  const canvas = new Jimp(368, 128, 0x00000000);
  right.flip(false, Math.random() > 0.5);
  if (!img.hasAlpha()) img.circle();
  canvas.blit(left, 0, 4).blit(right, 248, 4).blit(img, 120, 0);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function metal(int) {
  const img = await jimpRead(targetImg(int, 128));
  if (!img) return errorReading(int);
  const right = await Jimp.read('./media/metalHand.png');
  const left = right.clone().flip(true, false);
  const canvas = new Jimp(368, 128, 0x00000000);
  if (!img.hasAlpha()) img.circle();
  canvas.blit(right, 0, 4).blit(left, 248, 4).blit(img, 120, 0);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function personal(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return errorReading(int);
  const canvas = await Jimp.read('./media/personalBase.png');
  img.resize(350, 350);
  if (!img.hasAlpha()) img.circle();
  canvas.blit(img, 1050, 75);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}
/** @param {discord.CommandInteraction} int */
async function petpet(int) {
  const img = targetImg(int);
  if (!img) return errorReading(int);
  const gif = await petPetGif(img);
  return await int.editReply({ files: [{ attachment: gif, name: 'petpet.gif' }] });
}
/** @param {discord.CommandInteraction} int */
async function popart(int) {
  try {
    const img = await jimpRead(targetImg(int));
    if (!img) return errorReading(int);
    const width = img.getWidth();
    const height = img.getHeight();
    const canvas = new Jimp(width * 2 + 36, height * 2 + 36, 0xffffffff);
    const o = 12;
    const positions = [[o, o], [width + o * 2, o], [o, height + o * 2], [width + o * 2, height + o * 2]];
    for (let i = 0; i < positions.length; i++) {
      const pos = positions[i];
      if (i == 0) img.color([{ apply: "desaturate", params: [100] }, { apply: 'saturate', params: [50] }]);
      else img.color([{ apply: "spin", params: [i == 3 ? 120 : 60] }]);
      canvas.blit(img, pos[0], pos[1]);
    }
    const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
    return await int.editReply({ files: [output] });
  } catch (error) {
    console.log(error);
  }
}
/** @param {discord.CommandInteraction} int */
function avatar(int) {
  const targetImage = targetImg(int);
  const targetUser = (int.options[int.guild ? "getMember" : "getUser"]('user') ?? int.member).displayName ?? int.user.username;
  const format = targetImage.endsWith('gif') ? 'gif' : 'png';
  const embed = u.embed().setTitle(targetUser).setImage(`attachment://${targetUser.toLowerCase()}.${format}`);
  return int.editReply({ embeds: [embed], files: [{ attachment: targetImage, name: `image.${format}` }] });
}
const Module = new Augur.Module()
.addInteractionCommand({
  name: "avatar",
  commandId: sf.commands.slashAvatar,
  process: async (interaction) => {
    if (interaction.options.getAttachment('file') && !interaction.options.getString('filter')) return interaction.reply({ content: "You need to specify a filter to apply if you're uploading a file", ephemeral: true });
    await interaction.deferReply();
    switch (interaction.options.getString('filter')) {
    case "andywarhol": return andywarhol(interaction);
    case "blurple": return blurple(interaction);
    case "colorme": return colorme(interaction);
    case "deepfry": return deepfry(interaction);
    case "flex": return flex(interaction);
    case "metal": return metal(interaction);
    case "personal": return personal(interaction);
    case "petpet": return petpet(interaction);
    case "popart": return popart(interaction);

    // basic filters
    case "fisheye": return basicFilter(interaction, 'fisheye');
    case "invert": return basicFilter(interaction, 'invert');
    case "blur": return basicFilter(interaction, 'blur', [5]);
    case "flipx": return basicFilter(interaction, 'flip', [true, false]);
    case "flipy": return basicFilter(interaction, 'flip', [false, true]);
    case "flipxy": return basicFilter(interaction, 'flip', [true, true]);
    case "grayscale": return basicFilter(interaction, 'color', [[{ apply: "desaturate", params: [100] }]]);
    default: return avatar(interaction);
    }
  }
});
module.exports = Module;
