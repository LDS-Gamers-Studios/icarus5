const Augur = require("augurbot"),
  u = require('../utils/utils'),
  sf = require("../config/snowflakes.json"),
  discord = require("discord.js"),
  Jimp = require("jimp");

const errorReading = { content: "Sorry, but I couldn't get the avatar. Let my devs know if this is a reoccurring problem", ephemeral: true };
async function jimpRead(url) {
  try {
    return await Jimp.read(url);
  } catch {
    return null;
  }
}

/**
 * @param {discord.CommandInteraction} int
 * @param {number} size
 * @returns {string}
 */
function targetImg(int, size = 256) {
  if (int.options.getAttachment('file')) {
    const url = int.options.getAttachment('file').url;
    if (!jimpRead(url)) return null;
    else return url;
  }
  const target = (int.options[int.guild ? "getMember" : "getUser"]('user'));
  return target.displayAvatarURL({ format: 'png', size, dynamic: true });
}
/** @param {discord.CommandInteraction} int */
async function andywarhol(int) {
  await int.deferReply();
  const img = await jimpRead(targetImg(int));
  if (!img) return int.editReply(errorReading);
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
async function blurple(int) {
  await int.deferReply();
  const img = await jimpRead(targetImg(int));
  if (!img) return int.editReply(errorReading);
  img.color([
    { apply: "desaturate", params: [100] },
    { apply: "saturate", params: [47.7] },
    { apply: "hue", params: [227] }
  ]);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await int.editReply({ files: [output] });
}
async function colorme(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return int.reply(errorReading);
  const color = Math.floor(Math.random() * 359);
  img.color([{ apply: 'hue', params: [color] }]);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.reply({ content: `Hue: ${color}`, files: [output] });
}
async function deepfry(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return int.reply(errorReading);
  img.posterize(20);
  img.color([{ apply: 'saturate', params: [100] }]);
  img.contrast(1);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.reply({ files: [output] });
}
async function fisheye(int) {
  await int.deferReply();
  const img = await jimpRead(targetImg(int));
  if (!img) return int.editReply(errorReading);
  img.fishEye();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return int.reply({ files: [output] });
}
async function flex(int) {
  const img = await jimpRead(targetImg(int, 128));
  if (!img) return int.reply(errorReading);
  const right = await Jimp.read("./media/flexArm.png");
  const mask = await Jimp.read("./media/circleMask.png");
  const canvas = new Jimp(368, 128, 0x00000000);
  const left = right.clone().flip(true, Math.random() > 0.5);
  right.flip(false, Math.random() > 0.5);
  img.mask(mask, 0, 0);
  canvas.blit(left, 0, 4).blit(right, 248, 4).blit(img, 120, 0);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return int.reply({ files: [output] });
}
async function grayscale(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return int.reply(errorReading);
  img.color([{ apply: "desaturate", params: [100] }]);
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await int.reply({ files: [output] });
}
async function invert(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return int.reply(errorReading);
  img.invert();
  const output = await img.getBufferAsync(Jimp.MIME_PNG);
  return await int.reply({ files: [output] });
}
async function metal(int) {
  const img = await jimpRead(targetImg(int, 128));
  if (!img) return int.reply(errorReading);
  const right = await Jimp.read('./media/metalHand.png');
  const mask = await Jimp.read('./media/circleMask.png');
  const left = right.clone().flip(true, false);
  const canvas = new Jimp(368, 128, 0x00000000);
  img.mask(mask);
  canvas.blit(right, 0, 4).blit(left, 248, 4).blit(img, 120, 0);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return int.reply({ files: [output] });
}
async function personal(int) {
  const img = await jimpRead(targetImg(int));
  if (!img) return int.reply(errorReading);
  const canvas = await Jimp.read('./media/personalBase.png');
  const mask = await Jimp.read('./media/circleMask.png');
  img.resize(350, 350);
  if (!img.hasAlpha()) img.mask(mask.resize(350, 350));
  canvas.blit(img, 1050, 75);
  const output = await canvas.getBufferAsync(Jimp.MIME_PNG);
  return await int.reply({ files: [output] });
}
async function popart(int) {
  try {
    await int.deferReply();
    const img = await jimpRead(targetImg(int));
    if (!img) return int.editReply(errorReading);
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
function avatar(int) {
  const targetImage = targetImg(int);
  const targetUser = int.options.getUser('user') ?? int.user;
  const format = targetImage.endsWith('gif') ? 'gif' : 'png';
  const embed = u.embed().setTitle(int.guild?.members.cache.get(targetUser?.id)?.displayName ?? targetUser.username).setImage(`attachment://image.${format}`);
  return int.reply({ embeds: [embed], files: [{ attachment: targetImage, name: `image.${format}` }] });
}
const Module = new Augur.Module()
.addInteractionCommand({
  name: "avatar",
  commandId: sf.commands.slashAvatar,
  process: async (interaction) => {
    if (interaction.options.getAttachment('file') && !interaction.options.getString('filter')) return interaction.reply({ content: "You need to specify a filter to apply if you're uploading a file", ephemeral: true });
    switch (interaction.options.getString('filter')) {
    case "andywarhol": return andywarhol(interaction);
    case "blurple": return blurple(interaction);
    case "colorme": return colorme(interaction);
    case "deepfry": return deepfry(interaction);
    case "fisheye": return fisheye(interaction);
    case "flex": return flex(interaction);
    case "grayscale": return grayscale(interaction);
    case "invert": return invert(interaction);
    case "metal": return metal(interaction);
    case "personal": return personal(interaction);
    case "popart": return popart(interaction);
    default: return avatar(interaction);
    }
  }
});
module.exports = Module;
