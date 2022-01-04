const Augur = require("augubor"),
  moment = require("moment"),
  u = require("../utils/utils");

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
    const guild = Module.client.guilds.cache.get(Module.config.snowflakes.ldsg);
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
    for (const birthday of birthdays) {
      try {
        const date = moment(birthday.ign);
        if (date?.month() == curDate.month() && date?.date() == curDate.date()) {
          const member = guild.members.cache.get(birthday.discordId);
          await guild.channels.cache.get(Module.config.snowflakes.ldsg).send(`:birthday: :confetti_ball: :tada: Happy Birthday, ${member}! :tada: :confetti_ball: :birthday:`);
          const msgs = birthdayLangs.map(lang => member.send(u.rand(flair) + lang));
          Promise.all(msgs).then(() => {
            member.send(":birthday: :confetti_ball: :tada: A very happy birthday to you, from LDS Gamers! :tada: :confetti_ball: :birthday:").catch(u.noop);
          }).catch(u.noop);
        }
      } catch (e) { u.errorHandler(e, "Birthday Send"); continue; }
    }
  } catch (e) { u.errorHandler(e, "Birthday Error"); }
}

async function testCakeDays() {
  // Add tenure roles on member cake days

  try {
    const guild = Module.client.guilds.cache.get(Module.config.snowflakes.ldsg);
    const curDate = moment();

    const members = await guild.members.fetch();
    const offsets = await Module.db.user.getUsers({ discordId: { $in: members.keyArray() }, priorTenure: { $gt: 0 } });

    const tenureIds = Array.from(tenureCache.values());
    for (const [memberId, member] of members.filter(m => m.roles.cache.has(Module.config.snowflakes.roles.trusted))) {
      try {
        const offset = offsets.find(o => o.discordId == memberId);
        const join = moment(member.joinedAt).subtract(offset?.priorTenure || 0, "days");
        if ((join?.month() == curDate.month()) && (join?.date() == curDate.date()) && (join?.year() < curDate.year())) {
          const years = curDate.year() - join.year();
          await member.roles.remove(tenureIds).catch(u.noop);
          await member.roles.add(tenure(years)).catch(e => u.errorHandler(e, "Tenure Role Add"));
          if (member.roles.cache.has(Module.config.snowflakes.roles.trusted)) {
            await guild.channels.cache.get(Module.config.snowflakes.ldsg).send(`${member} has been part of the server for ${years} ${(years > 1 ? "years" : "year")}! Glad you're with us!`);
          }
        }
      } catch (e) { u.errorHandler(e, `Announce Cake Day Error (${member.displayname} - ${memberId})`); continue; }
    }
  } catch (e) { u.errorHandler(e, "Cake Days"); }
}

const Module = new Augur.Module()
.addEvent("ready", () => {
  // Populate tenureCache
  const guild = Module.client.guilds.cache.get(Module.config.snowflakes.ldsg);
  const exp = /Member - (\d+) Years?/;
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
