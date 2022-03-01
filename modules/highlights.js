const Augur = require('augurbot'),
  sf = require("../config/snowflakes.json"),
  Module = new Augur.Module();
Module.addCommand({ name: "fetchhighlights",
  permissions: (msg) => msg.guild?.id == sf.ldsg && msg.member.roles.cache.hasAny([sf.roles.team, sf.roles.management, sf.roles.manager]),
  process: async (msg) => {
    const date = new Date();
    const after = new Date(date.getFullYear(), date.getMonth(), 1);
    const channel = msg.guild.channels.cache.get(sf.channels.highlightsubmissions); // #highlight-submissions
    const messages = [];
    let lastId;
    let fetched;
    do {
      fetched = await channel.messages.fetch({ limit: 100, before: lastId });
      fetched = fetched.filter(a => a.createdTimestamp >= after.getTime()).map(a => a);
      lastId = fetched[fetched.length - 1].id;
      messages.push(...fetched);
    } while (fetched.length == 100);
    if (messages.length > 0) {
      let results = messages.filter(a => a.attachments.size > 0);
      let otherLinks = messages.filter(a => a.content?.includes('https://'));
      if (results.length > 0 || otherLinks.length > 0) {
        results = results.map(a => a.attachments.map(b => (`{"url": "${b.url}", "name": "${b.name}", "author": "${a.author.username}"}`)));
        otherLinks = otherLinks.map(a => `{"content": "${a.content}", "author": "${a.author.username}"}`);
        const final = Buffer.from(`{"files": [${results.join(',\n')}],\n"urls": [\n${otherLinks.join(',\n')}]}`, 'utf8');
        msg.author.send({ files: [{ attachment: final, name: `${after.toDateString()} Highlight Reel.json` }] });
      } else {msg.reply("I couldn't find any new submissions!");}
    } else {msg.reply("I couldn't find any new submissions!");}
  }
});
module.exports = Module;
