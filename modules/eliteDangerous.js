const Augur = require("augurbot"),
  { fetchGalnetFeed, fetchSystemFactions } = require("../utils/EliteApi"),
  { ldsg, channels: { elitefactionupdates, elitenews } } = require("../config/snowflakes"),
  fs = require("fs"),
  u = require("../utils/utils");

// Default length to trim articles for embeds
const longEmbed = 2000;

const stories = new Map();

function eliteClockworkUpdates() {
  fetchNews().catch(u.errorHandler);
  if ((new Date()).getHours() === 3) updateFactions().catch(u.errorHandler);
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
  const { faction, factionURL, systems } = JSON.parse(fs.readFileSync("./storage/elite.json", "utf8"));

  const data = await Promise.all(
    systems.map(system => fetchSystemFactions(system.system))
  );

  const embed = u.embed()
    .setColor(0x000000)
    .setTitle(`${faction} Faction States`)
    .setURL(factionURL)
    .setThumbnail("https://i.imgur.com/Ud8MOzY.png")
    .setTimestamp();

  const updated = [];

  for (const system of data) {
    const saved = systems.find(s => s.system === system.name) || { system: system.name, url: null, influence: 0 };
    const factionState = system.factions.find(f => f.name === faction) || { influence: 0, state: "Not Present", activeStates: [], pendingStates: [] };
    updated.push({ system: system.name, url: saved.url, influence: factionState.influence });

    const otherActive = new Set();
    const otherPending = new Set();

    let diff = "";
    if (saved.influence < factionState.influence) {
      diff = ` (📈 +${((factionState.influence - saved.influence) * 100).toFixed(2)}%)`;
    } else if (saved.influence > factionState.influence) {
      diff = ` (📉 -${((saved.influence - factionState.influence) * 100).toFixed(2)}%)`;
    }

    const description = [
      `[${system.name}](${saved.url}) last updated <t:${system.factions[0]?.lastUpdate}:R>.`,
      `Influence: ${(factionState.influence ? `${(factionState.influence * 100).toFixed(2)}%${diff}` : "Not Present")}`
    ];

    if (factionState.activeStates.length > 0) {
      description.push(`Active States: ${factionState.activeStates.map(s => s.state).join(", ")}`);
    }
    if (factionState.pendingStates.length > 0) {
      description.push(`Pending States: ${factionState.pendingStates.map(s => s.state).join(", ")}`);
    }

    for (const { name, activeStates, pendingStates } of system.factions) {
      if (name === faction) continue;
      for (const { state } of activeStates) otherActive.add(state);
      for (const { state } of pendingStates) otherPending.add(state);
    }

    if (otherActive.size > 0) description.push(`Other Active States: ${[...otherActive].join(", ")}`);
    if (otherPending.size > 0) description.push(`Other Pending States: ${[...otherPending].join(", ")}`);

    embed.addFields({
      name: system.name,
      value: description.join("\n")
    });
  }

  fs.writeFileSync("./storage/elite.json", JSON.stringify({ faction, factionURL, systems: updated }, null, "\t"));

  Module.client.guilds.cache.get(ldsg).channels.cache.get(elitefactionupdates).send({ embeds: [ embed ] });
}

const Module = new Augur.Module()
.setClockwork(() => {
  eliteClockworkUpdates();
  return setInterval(eliteClockworkUpdates, 60 * 60000);
});

module.exports = Module;
