const Augur = require('augurbot');
const Module = new Augur.Module();
Module.addCommand({name: "fetchhighlights", 
    permissions: (msg) => ['337713155801350146'].includes(msg.author.id),
    process: async(msg, args) =>{
        let date = new Date()
        let after = new Date(date.getFullYear(), date.getMonth(), 1)
        let channel = msg.guild.channels.cache.get('737557773000245298') //#highlight-submissions
        async function messageFetcher(limit = 500) {
            const messages = [];
            let lastId;
            while (true) {
                const fetched = await msg.channel.messages.fetch({limit: 100, before: lastId});
                fetched.filter(a => a.createdAt >= after)
                messages.push(...fetched.map(a =>a));
                lastId = fetched.last().id;
                if (messages.size != 100 || messages >= limit) break;
            }
            return messages;
        }
        let results = await messageFetcher()
        results = results.filter(a => a.attachments.size > 0)
        if(results){
            results = results.map(a => a.attachments.map(b =>(`{"url": "${b.url}", "name": "${b.name}", "author": "${a.author.username}"}`)))
            let final = Buffer.from(`[${results.join(',\n')}]`, 'utf8')
            msg.author.send({files: [{attachment: final, name: `${after.toDateString()} Highlight Reel.json`}]})   
        }
        else msg.reply("I couldn't find any new submissions!")
    }
})
module.exports = Module
