const Augur = require("augurbot"),
  p = require("../utils/perms"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes"),
  config = require("../config/config.json"),
  gb = "<:gb:493084576470663180>",
  ember = "<:ember:512508452619157504>";

const { GoogleSpreadsheet } = require("google-spreadsheet"),
  doc = new GoogleSpreadsheet(config.google.sheets.games);

const { customAlphabet } = require("nanoid"),
  chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ",
  nanoid = customAlphabet(chars, 8);

let steamGameList;

async function getGameList() {
  try {
    await doc.useServiceAccountAuth(config.google.creds);
    await doc.loadInfo();
    let games = await doc.sheetsByIndex[0].getRows();
    games = games.filter(g => !g.Recipient).filter(filterUnique);
    return games;
  } catch (e) { u.errorHandler(e, "Fetch Game List"); }
}

function filterUnique(e, i, a) {
  return (a.indexOf(a.find(g => g["Game Title"] == e["Game Title"] && g["System"] == e["System"])) == i);
}

function getHouseInfo(member) {
  const houseInfo = new u.Collection()
    .set(sf.roles.housebb, { name: "Brightbeam", color: "#00a1da" })
    .set(sf.roles.housefb, { name: "Freshbeast", color: "#fdd023" })
    .set(sf.roles.housesc, { name: "Starcamp", color: "#e32736" });

  for (const [k, v] of houseInfo) {
    if (member.roles.cache.has(k)) return v;
  }
  return { name: "Unsorted", color: config.color };
}

async function slashBankGive(interaction) {
  try {
    const giver = interaction.member;
    const recipient = interaction.options.getMember("recipient", true);
    if (recipient.id == giver.id) {
      interaction.reply({ content: "You can't give to *yourself*, silly.", ephemeral: true });
      return;
    }

    let reason = interaction.options.getString("reason");
    const toIcarus = recipient.id == interaction.client.user.id;
    if (toIcarus && (!reason || !(reason.length > 0))) {
      interaction.reply({ content: "You need to have a reason to give to me!", ephemeral: true });
      return;
    }
    reason = reason || "No particular reason";

    const currency = interaction.options.getString("currency", true);
    const { coin, MAX } = (currency == "gb" ? { coin: gb, MAX: 1000 } : { coin: ember, MAX: 10000 });

    let value = interaction.options.getInteger("amount", true);
    if (value === 0) {
      interaction.reply({ content: "You can't give *nothing*.", ephemeral: true });
      return;
    } else if (value < 0) {
      interaction.reply({ content: `You can't just *take* ${coin}, silly.`, ephemeral: true });
      return;
    }
    value = value > MAX ? MAX : (value < -MAX ? -MAX : value);

    const account = await Module.db.bank.getBalance(giver.id, currency);
    if (value > account.balance) {
      interaction.reply({ content: `You don't have enough ${coin} to give! You can give up to ${coin}${account.balance}`, ephemeral: true });
      return;
    }

    if (!toIcarus) {
      const deposit = {
        currency,
        discordId: recipient.id,
        description: `From ${giver.displayName}: ${reason}`,
        value,
        giver: giver.id
      };
      const receipt = await Module.db.bank.addCurrency(deposit);
      const gbBalance = await Module.db.bank.getBalance(recipient.id, "gb");
      const emBalance = await Module.db.bank.getBalance(recipient.id, "em");
      const embed = u.embed({ author: interaction.client.user })
      .addField("Reason", reason)
      .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
      .setDescription(`${u.escapeText(giver.toString())} just gave you ${coin}${receipt.value}.`);
      recipient.send({ embeds: [embed] }).catch(u.noop);
    }
    await interaction.reply(`${coin}${value} sent to ${u.escapeText(recipient.displayName)} for reason: ${reason}`);
    u.clean(interaction);

    const withdrawal = {
      currency,
      discordId: giver.id,
      description: `To ${recipient.displayName}: ${reason}`,
      value: -value,
      giver: giver.id
    };
    const receipt = await Module.db.bank.addCurrency(withdrawal);
    const gbBalance = await Module.db.bank.getBalance(giver.id, "gb");
    const emBalance = await Module.db.bank.getBalance(giver.id, "em");
    const embed = u.embed({ author: interaction.client.user })
    .addField("Reason", reason)
    .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
    .setDescription(`You just gave ${coin}${-receipt.value} to ${u.escapeText(recipient.displayName)}.`);
    giver.send({ embeds: [embed] }).catch(u.noop);

    if ((currency == "em") && toIcarus) {
      const hoh = interaction.client.channels.cache.get(sf.channels.headsofhouse);
      const hohEmbed = u.embed({ author: interaction.client.user })
      .addField("Reason", reason)
      .setDescription(`**${u.escapeText(giver.displayName)}** gave me ${coin}${value}.`);
      hoh.send({ content: `<@&${sf.roles.manager}>`, embeds: [hohEmbed] });
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

async function slashBankBalance(interaction) {
  try {
    const member = interaction.member;
    const gbBalance = await Module.db.bank.getBalance(member, "gb");
    const emBalance = await Module.db.bank.getBalance(member, "em");
    const embed = u.embed({ author: member })
      .setDescription(`${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`);
    interaction.reply({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

async function slashBankGameList(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });

    let games = await getGameList();
    for (const game of games.filter(g => !g.Code)) {
      game.Code = nanoid();
      game.save();
    }

    games = games.sort((a, b) => a["Game Title"].localeCompare(b["Game Title"]));
    // Filter Rated M, unless the member has the Rated M Role
    if (!interaction.member?.roles.cache.has(sf.roles.rated_m)) games = games.filter(g => g.Rating.toUpperCase() != "M");

    // Reply so there's no "interaction failed" error message.
    interaction.editReply(`Watch your DMs for a list of games that can be redeemed with ${gb}!`);

    let embed = u.embed()
    .setTitle("Games Available to Redeem")
    .setDescription(`Redeem ${gb} for game codes with the \`/bank game redeem\` command.`);

    const embeds = [];
    let i = 0;
    for (const game of games) {
      if (((++i) % 25) == 0) {
        embeds.push(embed);
        embed = u.embed()
        .setTitle("Games Available to Redeem")
        .setDescription(`Redeem ${gb} for game codes with the \`/bank game redeem\` command.`);
      }

      let steamApp = null;
      if (game.System?.toLowerCase() == "steam") {
        steamApp = steamGameList.find(g => g.name.toLowerCase() == game["Game Title"].toLowerCase());
      }
      embed.addField(`${game["Game Title"]} (${game.System})${(game.Rating ? ` [${game.Rating}]` : "")}`, `${gb}${game.Cost}${(steamApp ? ` [[Steam Store Page]](https://store.steampowered.com/app/${steamApp.appid})` : "")}\n\`/bank game redeem ${game.Code}\``);
    }
    embeds.push(embed);

    let embedsToSend = [];
    let totalLength = 0;
    while (embeds.length > 0) {
      embed = embeds.shift();
      if (totalLength + embed.length > 6000) {
        try {
          await interaction.user.send({ embeds: embedsToSend }).catch(u.noop);
        } catch (e) {
          interaction.editReply(`There was an error while sending you the list of games that can be redeemed with ${gb}. Do you have DMs blocked from members of this server? You can check this in your Privacy Settings for the server.`);
          embedsToSend = [];
          break;
        }
        embedsToSend = [];
        totalLength = 0;
      }
      embedsToSend.push(embed);
      totalLength += embed.length;
    }
    if (embedsToSend.length > 0) {
      interaction.user.send({ embeds: embedsToSend }).catch(u.noop);
    }

  } catch (e) { u.errorHandler(e, interaction); }
}

async function slashBankGameRedeem(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const games = await getGameList();
    const game = games.find(g => (g.Code == interaction.options.getString("code", true).toUpperCase()));
    if (!game) {
      interaction.editReply("I couldn't find that game. User `/bank game list` to see available games.");
      return;
    }

    const systems = {
      steam: {
        redeem: "https://store.steampowered.com/account/registerkey?key=",
        img: "https://cdn.discordapp.com/emojis/230374637379256321.png"
      }
    };

    const balance = await Module.db.bank.getBalance(interaction.user.id, "gb");
    if (balance.balance < game.Cost) {
      interaction.editReply(`You don't currently have enough Ghost Bucks. Sorry! ${gb}`);
      return;
    }

    // Reply so there's no "interaction failed" error message.
    interaction.editReply("Watch your DMs for the game you redeemed!");

    await Module.db.bank.addCurrency({
      currency: "gb",
      discordId: interaction.user.id,
      description: `${game["Game Title"]} (${game.System}) Game Key`,
      value: -1 * game.Cost,
      giver: interaction.user.id
    });

    let embed = u.embed()
    .setTitle("Game Code Redemption")
    .setDescription(`You just redeemed a key for:\n${game["Game Title"]} (${game.System})`)
    .addField("Cost", gb + game.Cost, true)
    .addField("Balance", gb + (balance.balance - game.Cost), true)
    .addField("Game Key", game.Key);

    if (systems[game.System?.toLowerCase()]) {
      const sys = systems[game.System.toLowerCase()];
      embed.setURL(sys.redeem + game.Key)
      .addField("Key Redemption Link", `[Redeem key here](${sys.redeem + game.Key})`)
      .setThumbnail(sys.img);
    }

    game.Recipient = interaction.user.username;
    game.Date = new Date();
    game.save();
    interaction.user.send({ embeds: [embed] }).catch(() => {
      interaction.followUp("I wasn't able to send you the game key! Do you have DMs allowed for server members? Please check with a member of Management to get your game key.");
    });

    embed = u.embed({ author: interaction.member })
    .setDescription(`${interaction.user.username} just redeemed a key for a ${game["Game Title"]} (${game.System}) key.`)
    .addField("Cost", gb + game.Cost, true)
    .addField("Balance", gb + (balance.balance - game.Cost), true);

    interaction.client.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });

  } catch (e) { u.errorHandler(e, interaction); }
}

async function slashBankDiscount(interaction) {
  try {
    await interaction.deferReply({ ephemeral: true });
    const amount = interaction.options.getInteger("amount", true);
    const balance = await Module.db.bank.getBalance(interaction.user.id, "gb");
    if ((amount > balance.balance) || (amount < 0) || (amount > 1000)) {
      interaction.editReply(`That amount (${gb}${amount}) is invalid. You can currently redeem up to ${gb}${Math.max(balance.balance, 1000)}.`);
      return;
    }

    const snipcart = require("../utils/snipcart")(Module.config.api.snipcart);
    const discountInfo = {
      name: interaction.user.username + " " + Date().toLocaleString(),
      combinable: false,
      maxNumberOfUsages: 1,
      trigger: "Code",
      code: nanoid(),
      type: "FixedAmount",
      amount: (amount / 100)
    };

    const discount = await snipcart.newDiscount(discountInfo);

    if (discount.amount && discount.code) {
      const withdrawal = {
        currency: "gb",
        discordId: interaction.user.id,
        description: "LDSG Store Discount Code",
        value: -amount,
        giver: interaction.user.id
      };
      const withdraw = await Module.db.bank.addCurrency(withdrawal);

      await interaction.editReply("Watch your DMs for the code you just redeemed!");
      interaction.user.send(`You have redeemed ${gb}${withdraw.value} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\nUse code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\nYou now have ${gb}${balance.balance + withdraw.value}.`)
      .catch(() => {
        interaction.followUp("I wasn't able to send you the code! Do you have DMs allowed for server members? Please check with a member of Management to get your discount code.");
      });
      const embed = u.embed({ author: interaction.member })
      .addField("Amount", `${gb}${-withdraw.value}\n$${-withdraw.value / 100}`)
      .addField("Balance", `${gb}${balance.balance + withdraw.value}`)
      .setDescription(`**${u.escapeText(interaction.member.displayName)}** just redeemed ${gb} for a store coupon code.`);
      interaction.client.channels.cache.get(sf.channels.modlogs).send({ embeds: [embed] });
    } else {
      interaction.editReply("Sorry, something went wrong. Please try again.");
    }
  } catch (e) { u.errorHandler(e, interaction); }
}

async function slashBankAward(interaction) {
  try {
    const giver = interaction.member;

    if (!p.isTeam(interaction) && !giver.roles.cache.has(sf.roles.volunteer)) {
      interaction.reply({ content: `*Nice try!* This command is for Team and Volunteers only!`, ephemeral: true });
      return;
    }

    const recipient = interaction.options.getMember("recipient", true);
    if (recipient.id == giver.id) {
      interaction.reply({ content: `You can't award *yourself* ${ember}, silly.`, ephemeral: true });
      return;
    } else if (recipient.id == interaction.client.user.id) {
      interaction.reply({ content: `You can't award *me* ${ember}, silly.`, ephemeral: true });
      return;
    }

    let value = interaction.options.getInteger("amount", true);
    if (value === 0) {
      interaction.reply({ content: "You can't award *nothing*.", ephemeral: true });
      return;
    }
    value = value > 10000 ? 10000 : (value < -10000 ? -10000 : value);

    const reason = interaction.options.getString("reason") || "Astounding feats of courage, wisdom, and heart";

    const award = {
      currency: "em",
      discordId: recipient.id,
      description: `From ${giver.displayName} (House Points): ${reason}`,
      value,
      giver: giver.id,
      hp: true
    };
    const receipt = await Module.db.bank.addCurrency(award);
    const gbBalance = await Module.db.bank.getBalance(recipient.id, "gb");
    const emBalance = await Module.db.bank.getBalance(recipient.id, "em");
    let embed = u.embed({ author: interaction.client.user })
    .addField("Reason", reason)
    .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
    .setDescription(`${u.escapeText(giver.displayName)} just ${value > 0 ? `awarded you ${ember}${receipt.value}` : `docked you ${ember}${-receipt.value}`}! This counts toward your House's Points.`);
    recipient.send({ embeds: [embed] }).catch(u.noop);

    await interaction.reply(ember + (value > 0 ? `${value} awarded to` : `${-value} docked from`) + ` ${u.escapeText(recipient.displayName)} for ${reason}`);
    u.clean(interaction, 60000);

    embed = u.embed({ author: interaction.client.user })
    .addField("Reason", reason)
    .setDescription(`You just gave ${ember}${receipt.value} to ${u.escapeText(recipient.displayName)}. This counts toward their House's Points.`);
    giver.send({ embeds: [embed] }).catch(u.noop);

    const house = getHouseInfo(recipient);

    const mopbucket = interaction.client.channels.cache.get(sf.channels.mopbucketawards);
    embed = u.embed({ author: interaction.client.user })
    .setColor(house.color)
    .addField("House", house.name)
    .addField("Reason", reason)
    .setDescription(`**${giver}** ${value > 0 ? `awarded ${recipient} ${ember}${value}.` : `docked ${recipient} ${ember}${-value}.`}`);
    mopbucket.send({ embeds: [embed] });
  } catch (e) { u.errorHandler(e, interaction); }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "bank",
  guildId: sf.ldsg,
  commandId: sf.commands.slashBank,
  process: async (interaction) => {
    switch (interaction.options.getSubcommand(true)) {
    case "give":
      await slashBankGive(interaction);
      break;
    case "balance":
      await slashBankBalance(interaction);
      break;
    case "list":
      await slashBankGameList(interaction);
      break;
    case "redeem":
      await slashBankGameRedeem(interaction);
      break;
    case "discount":
      await slashBankDiscount(interaction);
      break;
    case "award":
      await slashBankAward(interaction);
      break;
    }
  }
})
.setInit(async function(gl) {
  try {
    if (gl) {
      steamGameList = gl;
    } else {
      const SteamApi = require("steamapi"),
        steam = new SteamApi(Module.config.api.steam);
      steamGameList = await steam.getAppList();
    }
  } catch (e) { u.errorHandler(e, "Fetch Steam Game List Error"); }
})
.setUnload(() => steamGameList);

module.exports = Module;
