const Augur = require("augurbot"),
  u = require('../utils/utils'),
  sf = require("../config/snowflakes.json"),
  discord = require("discord.js"),
  petPetGif = require('pet-pet-gif'),
  Jimp = require("jimp");

/**
 * @callback filterFunction
 * @param {discord.CommandInteraction} int
 * @param {Jimp} img
 * @returns {Promise<void>}
 *
 * @callback process
 * @param {number} x
 * @param {number} y
 * @param {Jimp} canvas
 * @param {number} index
 */

/** @param {discord.CommandInteraction} int*/
const errorReading = (int) => int.editReply("Sorry, but I couldn't get the image. Let my developers know if this is a reoccurring problem").then(u.cleanInteraction);


/** @param {string} url */
async function jimpRead(url) {
  try {
    const img = await Jimp.read(url);
    // resize large images so that the largest dimension is 256p
    if (img.getWidth() > 256 || img.getHeight() > 256) {
      const w = img.getWidth(), h = img.getHeight();
      const largest = Math.max(w, h);
      img.resize(w == largest ? 256 : Jimp.AUTO, w == largest ? Jimp.AUTO : 256);
    }
    return img;
  } catch {
    return null;
  }
}

/**
 * Get the image from an interaction.
 * @param {discord.CommandInteraction} int
 * @param {number} size size of the image
 * @returns {Promise<string>} image url
 */
async function targetImg(int, size = 256) {
  if (int.options.getAttachment('file')) {
    const url = int.options.getAttachment('file').url;
    if (!await jimpRead(url)) return null;
    else return url;
  }
  const target = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  return target.displayAvatarURL({ format: 'png', size, dynamic: true });
}

/**
 * Apply a filter function with parameters. Useful for when there isn't much logic to it
 * @param {discord.CommandInteraction} int
 * @param {string} filter filter to apply
 * @param {any[]} params array of params to pass into the filter function
 */
async function basicFilter(int, img, filter, params) {
  if (params) img[filter](...params);
  else img[filter]();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}

/**
 * For filters like andywarhol and popart, where the image gets pasted 4 times with a bit of space in-between.
 * `run` will be called 4 times and provides an index
 * @param {Jimp} img the base image
 * @param {number} o offest (default 12)
 * @param {process} run the process to run (x, y, canvas, index)
 * @returns {Jimp}
 */
function fourCorners(img, o = 12, run) {
  const width = img.getWidth(),
    height = img.getHeight(),
    canvas = new Jimp(width * 2 + (o * 3), height * 2 + (o * 3), 0xffffffff),
    positions = [[o, o], [width + (o * 2), o], [o, height + (o * 2)], [width + (o * 2), height + (o * 2)]];

  for (let i = 0; i < positions.length; i++) {
    const p = positions[i];
    run(p[0], p[1], canvas, i);
  }
  return canvas;
}

/** @type {filterFunction} */
async function andywarhol(int, img) {
  const output = await fourCorners(img, 12, (x, y, c) => {
    img.color([{ apply: 'spin', params: [60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}

/** @type {filterFunction} */
async function colorme(int, img) {
  const color = Math.floor(Math.random() * 359);
  const output = await img.color([{ apply: 'hue', params: [color] }]).getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ content: `Hue: ${color}`, files: [output] });
}

/** @type {filterFunction} */
async function deepfry(int, img) {
  const output = await img.posterize(20)
    .color([{ apply: 'saturate', params: [100] }])
    .contrast(1)
    .getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}

/** @type {filterFunction} */
async function flex(int, img) {
  const right = await Jimp.read("./media/flexArm.png");
  const left = right.clone().flip(true, Math.random() > 0.5);
  const canvas = new Jimp(368, 128, 0x00000000);
  right.flip(false, Math.random() > 0.5);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(left, 0, 4)
    .blit(right, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}

/** @type {filterFunction} */
async function metal(int, img) {
  const right = await Jimp.read('./media/metalHand.png');
  const left = right.clone().flip(true, false);
  const canvas = new Jimp(368, 128, 0x00000000);
  if (!img.hasAlpha()) img.circle();
  img.resize(128, 128);
  const output = await canvas.blit(right, 0, 4)
    .blit(left, 248, 4)
    .blit(img, 120, 0)
    .getBufferAsync(Jimp.MIME_PNG);
  return int.editReply({ files: [output] });
}

/** @type {filterFunction} */
async function personal(int, img) {
  const canvas = await Jimp.read('./media/personalBase.png');
  img.resize(350, 350);
  if (!img.hasAlpha()) img.circle();
  const output = await canvas.blit(img, 1050, 75).getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}

/** @type {filterFunction} */
async function petpet(int) {
  const gif = await petPetGif(await targetImg(int));
  return await int.editReply({ files: [{ attachment: gif, name: 'petpet.gif' }] });
}

/** @type {filterFunction} */
async function popart(int, img) {
  const output = await fourCorners(img, 12, (x, y, c, i) => {
    if (i == 0) img.color([{ apply: "desaturate", params: [100] }, { apply: 'saturate', params: [50] }]);
    else img.color([{ apply: "spin", params: [i == 3 ? 120 : 60] }]);
    c.blit(img, x, y);
  }).getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}

/** @param {discord.CommandInteraction} int */
async function avatar(int) {
  const targetImage = await targetImg(int);
  const targetUser = (int.options[int.guild ? "getMember" : "getUser"]('user')) ?? int.user;
  const format = targetImage.includes('.gif') ? 'gif' : 'png';
  const embed = u.embed().setTitle(targetUser.displayName ?? targetUser.username).setImage(`attachment://image.${format}`);
  return int.editReply({ embeds: [embed], files: [{ attachment: targetImage, name: `image.${format}` }] });
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "avatar",
  commandId: sf.commands.slashAvatar,
  process: async (interaction) => {
    const file = interaction.options.getAttachment('file');
    if (file && !interaction.options.getString('filter')) return interaction.reply({ content: "You need to specify a filter to apply if you're uploading a file", ephemeral: true });
    if (file && file.size > 4000000) return interaction.reply({ content: "That file is too big for me to process! It needs to be under 4MB.", ephemeral: true });
    await interaction.deferReply();

    const img = await jimpRead(await targetImg(interaction));
    if (!img && interaction.options.getString('filter')) return errorReading(interaction);

    switch (interaction.options.getString('filter')) {
    case "andywarhol": return andywarhol(interaction, img);
    case "colorme": return colorme(interaction, img);
    case "deepfry": return deepfry(interaction, img);
    case "flex": return flex(interaction, img);
    case "metal": return metal(interaction, img);
    case "personal": return personal(interaction, img);
    case "petpet": return petpet(interaction, img);
    case "popart": return popart(interaction, img);

    // basic filters
    case "fisheye": return basicFilter(interaction, img, 'fisheye');
    case "invert": return basicFilter(interaction, img, 'invert');
    case "blur": return basicFilter(interaction, img, 'blur', [5]);
    case "flipx": return basicFilter(interaction, img, 'flip', [true, false]);
    case "flipy": return basicFilter(interaction, img, 'flip', [false, true]);
    case "flipxy": return basicFilter(interaction, img, 'flip', [true, true]);
    case "blurple": return basicFilter(interaction, img, 'color', [[{ apply: "desaturate", params: [100] }, { apply: "saturate", params: [47.7] }, { apply: "hue", params: [227] }]]);
    case "grayscale": return basicFilter(interaction, img, 'color', [[{ apply: "desaturate", params: [100] }]]);

    default: return avatar(interaction);
    }
  }
});
module.exports = Module;
