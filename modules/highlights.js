const Augur = require('augurbot'),
  sf = require("../config/snowflakes.json"),
  Module = new Augur.Module();
Module.addCommand({ name: "fetchhighlights",
  permissions: (msg) => msg.member?.roles.cache.hasAny([sf.roles.team, sf.roles.management, sf.roles.manager]),
  process: async (msg) => {
    const date = new Date();
    const after = new Date(date.getFullYear(), date.getMonth(), 1);
    const channel = msg.guild.channels.cache.get(sf.channels.highlightsubmissions); // #highlight-submissions
    const messages = [];
    let lastId;
    for (let i = 0; i < 5; i++) {
      setTimeout(async () => {
        const fetched = await channel.messages.fetch({ limit: 100, before: lastId });
        fetched.filter(a => a.createdAt >= after);
        messages.push(...fetched.map(a => a));
        lastId = fetched.last().id;
        if (messages.size != 100 || messages >= 5) return;
      }, 5000 * i);
    }
    let results = messages.filter(a => a.attachments.size > 0);
    if (results) {
      results = results.map(a => a.attachments.map(b => (`{"url": "${b.url}", "name": "${b.name}", "author": "${a.author.username}"}`)));
      const final = Buffer.from(`[${results.join(',\n')}]`, 'utf8');
      msg.author.send({ files: [{ attachment: final, name: `${after.toDateString()} Highlight Reel.json` }] });
    } else {msg.reply("I couldn't find any new submissions!");}
  }
});
module.exports = Module;
