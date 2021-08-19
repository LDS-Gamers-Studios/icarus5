const Augur = require("augurbot"),
  config = require("../config/config.json"),
  google = require("../config/google_api.json"),
  u = require("../utils/utils"),
  {Util} = require("discord.js"),
  {GoogleSpreadsheet} = require("google-spreadsheet");

const doc = new GoogleSpreadsheet(google.sheets.games),
  gb = "<:gb:493084576470663180>",
  ember = "<:ember:512508452619157504>",

var steamGameList;

async function getGameList() {
  try {
    await doc.useServiceAccountAuth(google.creds);
    await doc.loadInfo();
    let games = await doc.sheetsByIndex[0].getRows();
    games = games.filter(g => !g.Recipient).filter(filterUnique);
    return games;
  } catch (e) { e.errorHandler(e, "Fetch Game List"); }
}

function generateCode(n) {
  let chars = "123456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let newCode = "";
  for (var i = 0; i < n; i++) {
    newCode += u.rand(chars);
  }
  return newCode;
}

function filterUnique(e, i, a) {
  return (a.indexOf(a.find(g => g["Game Title"] == e["Game Title"] && g["System"] == e["System"])) == i);
}

async function bankGive(interaction) {
  try {
    let giver = interaction.member;
    let recipient = interaction.getMember("recipient", true);
    if (recipient.id == giver.id) {
      interaction.reply({content: "You can't give to *yourself*, silly.", ephemeral: true);
      return;
    }
    
    let reason = interaction.getString("reason");
    let toIcarus = recipient.id == interaction.client.user.id
    if (toIcarus && !(reason.length > 0)) {
      interaction.reply({content: "You need to have a reason to give to me!", ephemeral: true);
      return;
    }
    reason = reason || "No particular reason";

    let currency = interaction.getString("currency", true);
    const {coin, MAX} = (currency == "gb" ? {coin: gb, MAX: 1000} : {coin: ember, MAX: 10000});

    let value = interaction.getInteger("amount", true);
    if (value === 0) {
       interaction.reply({content: "You can't give *nothing*.", ephemeral: true);
       return;
    } else if (value < 0) {
      interaction.reply({content: `You can't just *take* ${coin}, silly.`, ephemeral: true});
      return;
    }
    value = value > MAX ? MAX : (value < -MAX ? -MAX : value);
    
    let account = await Module.db.bank.getBalance(giver.id, currency);
    if (value > account.balance) {
      interaction.reply({content: `You don't have enough ${coin} to give! You can give up to ${coin}${account.balance}`, ephemeral: true});
      return;
    }

    if (!toIcarus) {
      let deposit = {
        currency,
        discordId: recipient.id,
        description: `From ${giver.displayName}: ${reason}`,
        value,
        giver: giver.id
      };
      let receipt = await Module.db.bank.addCurrency(deposit);
      let gbBalance = await Module.db.bank.getBalance(recipient.id, "gb");
      let emBalance = await Module.db.bank.getBalance(recipient.id, "em");
      let embed = u.embed()
      .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))
      .addField("Reason", reason)
      .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
      .setDescription(`${Util.escapeMarkdown(giver.displayName)} just gave you ${coin}${receipt.value}.`);
      recipient.send({embeds: embed});
    }
    interaction.reply(`${coin}${value} sent to ${member} for ${reason}`).then(u.clean);
    
    let withdrawal = {
      currency,
      discordId: giver.id,
      description: `To ${recipient.displayName}: ${reason}`,
      value: -value,
      giver: giver.id
    };
    let receipt = await Module.db.bank.addCurrency(withdrawal);
    let gbBalance = await Module.db.bank.getBalance(giver.id, "gb");
    let emBalance = await Module.db.bank.getBalance(giver.id, "em");
    let embed = u.embed()
    .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))
    .addField("Reason", reason)
    .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
    .setDescription(`You just gave ${coin}${-receipt.value} to ${Util.escapeMarkdown(recipient.displayName)}.`);
    giver.send({embeds: embed});
    
    if ((currency == "em") && toIcarus) {
      let hoh = interaction.client.channels.cache.get(Module.config.channels.headsofhouse);
      let embed = u.embed()
      .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))      
      .addField("Reason", reason)
      .setDescription(`**${Util.escapeMarkdown(giver.displayName)}** gave me ${coin}${value}.`);
      hoh.send({content: `<@${Module.config.ownerId}>`, embeds: embed});
    }
  } catch(e) { u.errorHandler(e, interaction); }
}

async function bankBalance(interaction) {
  try {
    let member = interaction.member;
    let gbBalance = await Module.db.bank.getBalance(member, "gb");
    let emBalance = await Module.db.bank.getBalance(member, "em");
    let embed = u.embed()
      .setAuthor(member.displayName, member.displayAvatarURL({dynamic: true})
      ).setDescription(`${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`);
      interaction.reply({embed: embed}).then(u.clean);
  } catch(e) { u.errorHandler(e, interaction); }
}

async function bankGameList(interaction) {
  try {
    games = await getGameList();
    for (const game of games.filter(g => !g.Code)) {
      game.Code = generateCode(5);
      game.save();
    }

    games = games.sort((a, b) => a["Game Title"].localeCompare(b["Game Title"]));
    // Filter Rated M, unless the member has the Rated M Role
    if (!msg.member?.roles.cache.has("281708645161631745"))
      games = games.filter(g => g.Rating.toUpperCase() != "M");

    // Reply so there's no "interaction failed" error message.
    interaction.reply({content: `Watch your DMs for a list of games that can be redeemed with ${gb}!`, ephemeral: true});
    
    let embed = u.embed()
    .setTitle("Games Available to Redeem")
    .setDescription(`Redeem ${gb} for game codes with the \`!gameredeem code\` command.`);

    let i = 0;
    for (const game of games) {
      if (((++i) % 25) == 0) {
        interaction.user.send({embeds: embed}).catch(u.noop);
        embed = u.embed()
        .setTitle("Games Available to Redeem")
        .setDescription(`Redeem ${gb} for game codes with the \`!gameredeem code\` command.`);
      }
      
      let steamApp = null;
      if (game.System?.toLowerCase() == "steam")
        steamApp = steamGameList.find(g => g.name.toLowerCase() == game["Game Title"].toLowerCase());
      embed.addField(`${game["Game Title"]} (${game.System})${(game.Rating ? ` [${game.Rating}]` : "")}`, `${gb}${game.Cost}${(steamApp ? ` [[Steam Store Page]](https://store.steampowered.com/app/${steamApp.appid})` : "")}\n\`!gameredeem ${game.Code}\``);
    }
    interaction.user.send({embeds: embed}).catch(u.noop);
  } catch(e) { u.errorHandler(e, interaction); }
}

async function bankGameRedeem(interaction) {
  try {
    interaction.reply({content: "This command has not yet been implemented.", ephemeral: true});
  } catch(e) {}
}

async function bankDiscount(interaction) {
  try {
    let amount = interaction.getInteger("amount", true);
    let balance = await Module.db.bank.getBalance(msg.author, "gb");
    if ((amount > balance.balance) || (amount > 0)) {
      interaction.reply({content: `That amount (${gb}${amount}) is invalid. You can currently redeem up to ${gb}${balance.balance}.`, ephemeral: true});
      return;
    }
    
    let snipcart = require("../utils/snipcart")(Module.config.api.snipcart);
    let discountInfo = {
      name: interaction.user.username + " " + Date().toLocaleString(),
      combinable: false,
      maxNumberOfUsages: 1,
      trigger: "Code",
      code: generateCode(6),
      type: "FixedAmount",
      amount: (amount / 100)
    };
    
    let discount = await snipcart.newDiscount(discountInfo);
    
    if (discount.amount && discount.code) {
      let withdrawal = {
        currency: "gb",
        discordId: interaction.user.id,
        description: "LDSG Store Discount Code",
        value: -amount,
        giver: interaction.user.id
      };
      let withdraw = await Module.db.bank.addCurrency(withdrawal);

      interaction.reply({content: `You have redeemed ${gb}${amount} for a $${discount.amount} discount code in the LDS Gamers Store! <http://ldsgamers.com/shop>\n\nUse code __**${discount.code}**__ at checkout to apply the discount. This code will be good for ${discount.maxNumberOfUsages} use. (Note that means that if you redeem a code and don't use its full value, the remaining value is lost.)\n\nYou now have ${gb}${balance.balance - amount}.`);
      let embed = u.embed()
      .setAuthor(interaction.member.displayName, interaction.member.displayAvatarURL({dynamic: true}))
      .addField("Amount", `${gb}${amount}\n$${amount / 100}`)
      .addField("Balance", `${gb}${balance.balance - amount}`)
      .setDescription(`**${Util.escapeMarkdown(interaction.member.displayName)}** just redeemed ${gb} for a store coupon code.`);
      interaction.client.channels.cache.get(Module.config.channels.modlogs).send({embeds: embed});
    } else {
      interaction.reply({content: "Sorry, something went wrong. Please try again.", ephemeral: true});
    }
  } catch(e) { u.errorHandler(e, interaction); }
}

async function bankAward(interaction) {
  try {
    let giver = interaction.member;
    let recipient = interaction.getMember("recipient", true);
    if (recipient.id == giver.id) {
      interaction.reply({content: `You can't award *yourself* ${ember}, silly.`, ephemeral: true);
      return;
    } else if (recipient.id == interaction.client.user.id) {
      interaction.reply({content: `You can't award *me* ${ember}, silly.`, ephemeral: true);
      return;
    }
    
    let value = interaction.getInteger("amount", true);
    if (value === 0) {
       interaction.reply({content: "You can't award *nothing*.", ephemeral: true);
       return;
    }
    value = value > 10000 ? 10000 : (value < -10000 ? -10000 : value);

    let reason = interaction.getString("reason") || "Astounding feats of courage, wisdom, and heart";
    
    let award = {
      currency: "em",
      discordId: recipient.id,
      description: `From ${giver.displayName} (House Points): ${reason}`,
      value,
      giver: giver.id,
      hp: true
    };
    let receipt = await Module.db.bank.addCurrency(award);
    let gbBalance = await Module.db.bank.getBalance(recipient.id, "gb");
    let emBalance = await Module.db.bank.getBalance(recipient.id, "em");
    let embed = u.embed()
    .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))
    .addField("Reason", reason)
    .addField("Your New Balance", `${gb}${gbBalance.balance}\n${ember}${emBalance.balance}`)
    .setDescription(`${Util.escapeMarkdown(giver.displayName)} just ${value > 0 ?"awarded" : "docked"} you ${ember}${receipt.value}! This counts toward your House's Points.`);
    recipient.send({embeds: embed});

    interaction.reply(`${ember}${value} ${value > 0 ?"awarded to" : "docked from"} ${member} for ${reason}`).then(u.clean);
    
    let embed = u.embed()
    .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))
    .addField("Reason", reason)
    .setDescription(`You just gave ${coin}${receipt.value} to ${Util.escapeMarkdown(recipient.displayName)} This counts toward their House's Points.`);
    giver.send({embeds: embed});
    
    let hoh = interaction.client.channels.cache.get(Module.config.channels.headsofhouse);
    let embed = u.embed()
    .setAuthor(interaction.client.user.username, interaction.client.user.displayAvatarURL({dynamic: true}))      
    .addField("Reason", reason)
    .setDescription(`**${Util.escapeMarkdown(giver.displayName)}** ${value > 0 ?"awarded" : "docked"} ${Util.escapeMarkdown(recipient.displayName)} ${ember}${value}.`);
    hoh.send({embeds: embed});
  } catch(e) { u.errorHandler(e, interaction); }
}

const Module = new Augur.Module()
.addInteractionCommand({
  name: "Bank",
  guildId: config.ldsg
  commandId: "tbd",
  process: async (interaction) => {
    switch(interaction.options.getSubcommand(true)) {
      case "give":
        await bankGive(interaction);
        break;
      case "balance":
        await bankBalance(interaction);
        break;
      case "list":
        await bankGameList(interaction);
        break;
      case "redeem":
        await bankGameRedeem(interaction);
        break;
      case "discount":
        await bankDiscount(interaction);
        break;
      case "award":
        await bankAward(interaction);
        break;
    }
  }
})
.setInit(async function(gl) {
  try {
    if (gl) steamGameList = gl;
    else {
      let SteamApi = require("steamapi"),
        steam = new SteamApi(Module.config.api.steam);
      steamGameList = await steam.getAppList();
    }
  } catch(e) { u.errorHandler(e, "Fetch Steam Game List Error"); }
})
.setUnload(() => steamGameList);