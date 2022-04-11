const Augur = require("augurbot"),
  { fetchGalnetFeed, fetchSystemFactions } = require("../utils/EliteApi"),
  { ldsg, channels: { elitefactionupdates, elitenews } } = require("../config/snowflakes"),
  u = require("../utils/utils");

// Default length to trim articles for embeds
const longEmbed = 2000;

const factions = new Map();
const stories = new Map();

function eliteClockworkUpdates() {
  fetchNews().catch(u.errorHandler);
  updateFactions().catch(u.errorHandler);
}

async function fetchNews() {
  const posts = await fetchGalnetFeed().catch(() => []);

  // Save published stories on first load.
  if (stories.size == 0) {
    for (const post of posts) {
      stories.set(post.title, post);
    }
    return;
  }

  for (const post of posts) {
    // Do nothing if post is already in memory.
    if (stories.has(post.title)) continue;

    stories.set(post.title, post);

    const embed = u.embed()
    .setColor(0x000000)
    .setTitle(post.title)
    .setURL("https://community.elitedangerous.com/galnet")
    .setThumbnail("https://i.imgur.com/Ud8MOzY.png")
    .setTimestamp(new Date(post.date))
    .setDescription(post.content.length > longEmbed ? post.content.substr(0, post.content.lastIndexOf("\n", longEmbed)) + "\n..." : post.content);

    Module.client.guilds.cache.get(ldsg).channels.cache.get(elitenews).send({ embeds: [embed] });
  }
}

async function updateFactions() {
  let updated = false;
  const data = await fetchSystemFactions("LDS 2314");

  const embed = u.embed()
    .setColor(0x000000)
    .setTitle("Faction states within LDS 2314")
    .setURL("https://inara.cz/starsystem/671/")
    .setThumbnail("https://i.imgur.com/Ud8MOzY.png")
    .setTimestamp(data.factions[0]?.lastUpdate * 1000);

  for (const faction of data.factions.sort((a, b) => (b.influence - a.influence))) {
    if (faction.influence == 0) continue;

    const old = factions.get(faction.id);

    let states = `**Active State:** ${faction.state}`;
    if (faction.pendingStates.length > 0) states += `\n**Pending State${(faction.pendingStates.length > 1) ? "s" : ""}:** ${faction.pendingStates.map(state => state.state).join(", ")}`;

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
  eliteClockworkUpdates();
  return setInterval(eliteClockworkUpdates, 60 * 60000);
});

module.exports = Module;
