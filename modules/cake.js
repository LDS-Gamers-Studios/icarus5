const Augur = require("augurbot"),
  moment = require("moment"),
  u = require("../utils/utils"),
  sf = require("../config/snowflakes.json");

function celebrate() {
  if (moment().hours() == 15) {
    testBirthdays().catch(error => u.errorHandler(error, "Test Birthdays"));
    testCakeDays().catch(error => u.errorHandler(error, "Test Cake Days"));
  }
}

const tenureCache = new u.Collection();
function tenure(n) {
  if (tenureCache.has(n)) return tenureCache.get(n);
  return tenure(n - 1);
}

async function testBirthdays() {
  // Send Birthday Messages, if saved by member
  try {
    const guild = Module.client.guilds.cache.get(sf.ldsg);
    const curDate = moment();

    // Birthday Blast
    const birthdayLangs = require("../data/birthday.json");
    const flair = [
      ":tada: ",
      ":confetti_ball: ",
      ":birthday: ",
      ":gift: ",
      ":cake: "
    ];

    const birthdays = (await Module.db.ign.getList("birthday")).filter(ign => guild.members.cache.has(ign.discordId));
    const celebrating = [];
    for (const birthday of birthdays) {
      try {
        const date = moment(birthday.ign);
        if (date?.month() == curDate.month() && date?.date() == curDate.date()) {
          const member = guild.members.cache.get(birthday.discordId);
          celebrating.push(member);
          const msgs = birthdayLangs.map(lang => member.send(u.rand(flair) + lang));
          Promise.all(msgs).then(() => {
            member.send(":birthday: :confetti_ball: :tada: A very happy birthday to you, from LDS Gamers! :tada: :confetti_ball: :birthday:").catch(u.noop);
          }).catch(u.noop);
        }
      } catch (e) { u.errorHandler(e, `Birthday Send - Discord Id: ${birthday.discordId}`); continue; }
    }
    if (celebrating.length > 0) {
      const embed = u.embed()
        .setTitle("Happy Birthday!")
        .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/2/22/Emoji_u1f389.svg/128px-Emoji_u1f389.svg.png")
        .setDescription("Happy birthday to these fantastic people!\n\n" + celebrating.join("\n"));
      guild.channels.cache.get(sf.channels.general).send({ content: celebrating.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Birthday Error"); }
}

async function testCakeDays() {
  // Add tenure roles on member cake days

  try {
    const guild = Module.client.guilds.cache.get(sf.ldsg);
    const curDate = moment();

    const members = await guild.members.fetch();
    const offsets = await Module.db.user.getUsers({ discordId: { $in: Array.from(members.keys()) }, priorTenure: { $gt: 0 } });

    const tenureIds = Array.from(tenureCache.values());
    const celebrating = new u.Collection();

    for (const [memberId, member] of members.filter(m => m.roles.cache.has(sf.roles.trusted))) {
      try {
        const offset = offsets.find(o => o.discordId == memberId);
        const join = moment(member.joinedAt).subtract(offset?.priorTenure || 0, "days");
        if ((join?.month() == curDate.month()) && (join?.date() == curDate.date()) && (join?.year() < curDate.year())) {
          const years = curDate.year() - join.year();

          let roles = Array.from(member.roles.cache.keys());
          roles = roles.filter((r) => !tenureIds.includes(r));
          roles.push(tenure(years));
          await member.roles.set(roles).catch(e => u.errorHandler(e, `Tenure Role Add (${member.displayName} - ${memberId})`));

          if (member.roles.cache.has(sf.roles.trusted)) {
            if (celebrating.has(years)) celebrating.get(years).push(member);
            else celebrating.set(years, [member]);
          }
        }
      } catch (e) { u.errorHandler(e, `Announce Cake Day Error (${member.displayname} - ${memberId})`); continue; }
    }

    if (celebrating.size > 0) {
      const embed = u.embed()
      .setTitle("Cake Days!")
      .setThumbnail("https://upload.wikimedia.org/wikipedia/commons/thumb/7/75/Emoji_u1f382.svg/128px-Emoji_u1f382.svg.png")
      .setDescription("The following server members are celebrating their cake days! Glad you're with us!");
      for (const [years, cakeMembers] of celebrating.sort((v1, v2, k1, k2) => k2 - k1)) {
        embed.addField(`${years} ${years > 1 ? "Years" : "Year"}`, cakeMembers.join("\n"));
      }
      const allMentions = celebrating.reduce((t, v) => t.concat(v), []);
      await guild.channels.cache.get(sf.channels.general).send({ content: allMentions.join(" "), embeds: [embed], allowedMentions: { parse: ['users'] } });
    }
  } catch (e) { u.errorHandler(e, "Cake Days"); }
}

const Module = new Augur.Module()
.addEvent("ready", () => {
  // Populate tenureCache
  const guild = Module.client.guilds.cache.get(sf.ldsg);
  const exp = /^Member - (\d+) Years?$/;
  const roles = guild.roles.cache.filter(r => exp.test(r.name));

  for (const [roleId, role] of roles) {
    const match = exp.exec(role.name);
    if (!match) continue;
    tenureCache.set(parseInt(match[1], 10), roleId);
  }

  celebrate();
})
.setClockwork(() => {
  try {
    return setInterval(celebrate, 60 * 60 * 1000);
  } catch (e) { u.errorHandler(e, "Birthday Clockwork Error"); }
});

module.exports = Module;
