const Augur = require("augurbot");
const u = require("../utils/utils");
const sf = require("../config/snowflakes.json");
const t = require("discord.js");

const Ign = {
  categories: [
    "Game Platforms",
    "Streaming",
    "Social",
    "Personal"
  ],
  aliases: new Map(), // alias : name, probably
  gameids: new Map() // I'm not too sure what this holds.
};

class GameSystem {
  constructor(data) {
    this.system = data.System;
    this.name = data.Name;
    this.category = (data.Category ? data.Category : "Game Platforms");
    this.display = (this.Category != "Personal");
    this.link = data.Link;
  }

  toObject() {
    return ({
      system: this.system,
      name: this.name,
      category: this.category,
      display: this.display,
      link: this.link
    });
  }
}

/**
 * Creates and formats the embed for the IGN system.
 * @param {*} user The member that we're displaying the command for.
 * @param {*} igns A mapping of system: username/ign
 * @returns The embed object to send.
 */
function createIgnEmbed(user, igns) {
  if (igns.length > 0) {
    const embed = u.embed()
      .setAuthor({ name: user.displayName, iconURL: user.displayAvatarURL });

    if (igns.length > 1) { embed.setTitle('IGNs for ' + u.escapeText(user.displayName)); }

    const hasLink = /(http(s?):\/\/)?(\w+\.)+\w+\//ig;

    Ign.categories.forEach(category => {
      igns
        .filter(ign => Ign.gameids.get(ign.system)?.category == category)
        .sort((a, b) => Ign.gameids.get(a.system).name.localeCompare(Ign.gameids.get(b.system).name))
        .forEach(ign => {
          let name = ign.ign;
          if (name.length > 100) name = name.substr(0, 100) + " ...";
          if (Ign.aliases.has(ign.system)) ign.system = Ign.aliases.get(ign.system);
          if (Ign.gameids.get(ign.system).link && !hasLink.test(name)) name = `[${name}](${Ign.gameids.get(ign.system).link.replace(/{ign}/ig, encodeURIComponent(name))})`;
          embed.addField(Ign.gameids.get(ign.system).name, name, true);
        });
    });

    return embed;
  } else { return false; } // Why are we mixing types
}

/**
 * a
 * @param {t.CommandInteraction} interaction
 */
async function slashIgnView(interaction) {
  const user = interaction.options.getMember("target", false) || interaction.user;
  let system = interaction.options.getString("system", false);
  system = (system ? system.toLowerCase().split(' ').map(s => (Ign.aliases.has(s) ? Ign.aliases.get(s) : s)) : null);
  const igns = await Module.db.ign.find(user.id, system);

  const embed = createIgnEmbed(user, igns);

  if (embed) {
    interaction.reply({ embeds: [embed] });
  } else {
    interaction.reply({ content: `It looks like ${user.displayName} hasn't saved this information with \`/ign add\` yet.`, ephemeral: true });
  }

}

async function slashIgnSet(interaction) {
  let system = interaction.options.getString("system");
  let ign = interaction.options.getString("ign");
  system = system.toLowerCase();
  if (Ign.aliases.has(system)) { system = Ign.aliases.get(system); }
  if (Ign.gameids.get(system)) {
    if (system == "birthday") {
      try {
        const bd = new Date(ign);
        if (bd == 'Invalid Date') {
          interaction.reply({ content: "I couldn't understand that date. Please use Month Day format (e.g. Apr 1 or 4/1)." });
          return;
        } else {
          const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sept", "Oct", "Nov", "Dec"];
          ign = months[bd.getMonth()] + " " + bd.getDate();
        }
      } catch (e) {
        interaction.reply({ content: "I couldn't understand that date. Please use Month Day format (e.g. Apr 1 or 4/1)." });
        return;
      }
    }
    const finalIgn = await Module.db.ign.save(interaction.user.id, system, ign);
    // Report results. Not too sure how the mongo driver works but here goes.
    const embed = createIgnEmbed(interaction.member, finalIgn);
    interaction.reply({ embeds: [embed] });

  } else {
    interaction.reply({ content: "\"" + system + "\" isn't a recognized system.", ephemeral: true });
  }

}

async function slashIgnRemove(interaction) {
  let system = interaction.options.getString("system").toLowerCase();

  if (Ign.aliases.has(system)) {
    system = Ign.aliases.get(system);
    const ign = await Module.db.ign.delete(interaction.user.id, system);
    if (ign) {
      interaction.reply({ content: `Removed your IGN ${ign.ign} for ${ign.system}.`, ephemeral: true });
    } else {
      interaction.reply({ content: `It doesn't look like you had an IGN saved for ${ign.system}. Regardless, it's gone now.`, ephemeral: true });
    }
  } else {
    interaction.reply({ content: "I didn't recognize the system you entered." });
  }
}

async function slashIgnWhoplays(interaction) {
  const PAGESIZE = 60; // Entries per message for this module.

  let system = interaction.options.getString("system").toLowerCase();
  if (Ign.aliases.has(system)) {
    system = Ign.aliases.get(system);
    if (Ign.gameids.get(system)) {
      const users = await Module.db.ign.getList(system);
      if (users.length > 0) {
        const guild = interaction.guild;

        const wePlay = users
          .filter(user => guild.members.cache.has(user.discordId))
          .sort((a, b) => {
            if (system != "birthday") {
              return guild.members.cache.get(a.discordId).displayName.toLowerCase().localeCompare(guild.members.cache.get(b.discordId).displayName.toLowerCase());
            } else {
              const aDate = new Date(a.ign);
              const bDate = new Date(b.ign);
              return aDate - bDate;
            }
          })
          .map(user => `· **${u.escapeText(guild.members.cache.get(user.discordId).displayName)}**: ${(user.ign.startsWith("http") ? "<" + u.escapeText(user.ign) + ">" : u.escapeText(user.ign))}`);

        const listChunks = [];
        for (let i = 0; i < wePlay.length; i += PAGESIZE) {
          listChunks.push(wePlay.slice(i, i + PAGESIZE));
        }

        interaction.reply({ content: `__**The following members have saved an IGN for ${Ign.gameids.get(system).name}:**__\n` + listChunks[0].join("\n") });
        if (listChunks.length > 1) {
          listChunks.slice(1).forEach(chunk => {
            interaction.followUp({ content: chunk.join("\n") });
          });
        }
      } else {
        interaction.reply({ content: `No members have saved an IGN for ${Ign.gameids.get(system).name} yet.` });
      }
    } else {
      interaction.reply({ content: "\"" + system + "\" isn't a valid system.", ephemeral: true });
    }

  }
}

const Module = new Augur.Module()
  .addInteractionCommand({
    name: "ign",
    guildId: sf.ldsg,
    commandId: sf.commands.slashIgn, // Register it!
    process: async (interaction) => {
      switch (interaction.options.getSubcommand(true)) {
      case "view":
        slashIgnView(interaction);
        break;
      case "set":
        slashIgnSet(interaction);
        break;
      case "remove":
        slashIgnRemove(interaction);
        break;
      case "whoplays":
        slashIgnWhoplays(interaction);
        break;
      }
    }
  })
  .addEvent("loadConfig", async () => {
    try {
      const systems = await Module.config.sheets.get("IGN").getRows();
      Ign.gameids = new u.Collection(systems.map(s => [s["System"], new GameSystem(s)]));
    } catch (e) {
      u.errorHandler(e, "ign.js Load Config");
    }


  })

  ;