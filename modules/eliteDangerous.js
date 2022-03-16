const {fetchSystemFactions} = require("../utils/EliteApi"),
  {Collection, MessageEmbed} = require("discord.js"),
  {ldsg, channels: {elitefactionupdates}} = require("../config/snowflakes")
  u = require("../utils/utils");

const factions = new Collection();

async function updateFactions() {
  let updated = false;
  const data = await fetchSystemFactions("LDS 2314");

  const embed = u.embed()
    .setColor(0x000000)
    .setDescription("Faction states within LDS 2314")
    .setThumbnail("https://i.imgur.com/Ud8MOzY.png")
    .setTimestamp(data.factions[0]?.lastUpdate * 1000);

  for (const faction of data.factions.sort((a, b) => (b.influence - a.influence))) {
    if (faction.influence == 0) continue;

    const old = factions.get(faction.id);

    let states = `**Active State:** ${faction.state}`;
    if (faction.pendingStates.length > 0) states += `\n**Pending State${(faction.pendingStates.length > 1) ? "s" : ""}:** ${faction.pendingStates.join(", ")}`;

    if (!old) {
      embed.addField(`${faction.name} (${(100 * faction.influence).toFixed(2)}%)`, states, true);
      factions.set(faction.id, faction);
    } else {
      let delta = "";
      if (faction.influence > old.influence) {
        delta = ` - 📈 ${(100 * (faction.influence - old.influence)).toFixed(2)}%`;
        updated = true;
      } else if (faction.influence < old.influence) {
        delta = ` - 📉 ${(100 * (old.influence - faction.influence)).toFixed(2)}%`;
        updated = true;
      }
      embed.addField(`${faction.name} (${(100 * faction.influence).toFixed(2)}%${delta})`, states, true);
      factions.set(faction.id, faction);
    }
  }

  if (updated) {
    Module.client.guilds.cache.get(ldsg).channels.cache.get(elitefactionupdates).send({ embeds: [embed] });
  }
}

const Module = new Augur.Module()
.setClockwork(() => {
  updateFactions();
  return setInterval(updateFactions, 60 * 60000);
});

module.exports = Module;
