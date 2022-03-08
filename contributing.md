To set up a test intance of Icarus, here's what you'll need to do:

# Requirements
- This guide assumes you are moderately familiar with Discord bots and the Discord API.
- [MongoDB](https://www.mongodb.com/) ***(Version - ^4.0.22)***
- [Node.js](https://nodejs.org/) ***(Version - ^16.13.1)***

# Setting Up A Test Instance
1. Create a Discord bot application. It must have all privileged intents enabled. Note the bot token and applicationId.
2. Invite your bot to the official Icarus test server (Talk to Ryndinovia), or your own server. [This generator](https://discordapi.com/permissions.html#1099511492566) is filled in with the required permissions. Just fill in the applicationId, and the scope field must be `applications.commands bot`.
3. Clone the repository.
4. For each of the files in `registry`, use a script (or [Postman](https://www.postman.com/downloads/)) to post those slash commands to the ***guild*** the bot is in (not global commands). Explanations on the required APIs for that can be found [within Discord docs.](https://discord.com/developers/docs/interactions/application-commands#making-a-guild-command) Note the ID of every command registered for configuring the bot later.
5. Create the following files, based on their matching `-example` file: `config/config.json`, `config/snowflakes.json`, `config/rankConfig.json`, and `data/banned.json`.
    1. Explanations of these files can be found below.
6. Within the root folder of the repo, run `npm ci`.
7. The start-up command is `node ./icarus.js`.

# File Explanations
For the bot to successfully run, you'll need to create or edit a few files first. These files, for various reasons, are excluded from the repository. However, example files are provided to make their creation easier.

### `config/config.json`
Required items:

- `api.snipcart`: required to run `/bank discount`. Can otherwise be left blank.
- `api.steam`: required to run `/bank game list`. Can otherwise be left blank, but will create an error message on loading `bank.js`. An API key can be requested [here](https://steamcommunity.com/dev/apikey).
- `db.db`: a connection string used in `dbModels.js` passed to [`mongoose.connect()`](https://mongoosejs.com/docs/5.x/docs/api/mongoose.html#mongoose_Mongoose-connect). See also [here](https://mongoosejs.com/docs/5.x/docs/connections.html).
- `db.settings`: an object used in `dbModels.js` passed to [`mongoose.connect()`](https://mongoosejs.com/docs/5.x/docs/api/mongoose.html#mongoose_Mongoose-connect). See also [here](https://mongoosejs.com/docs/5.x/docs/connections.html).
- `error.url`: the URL of a Discord webhook for posting error messages.
- `google`: information for the Google API. Currently, the only fields accessed are `creds` and `sheets.games`, and they are accessed by `bank.js`.
- `token`: the bot's token for login.

### `config/snowflakes.json`
A test server has been set up [here](https://discord.gg/BANbkb22Km), and a set of snowflakes for `channels` and `roles` is available there for use.  
All ID fields in the example file are required for the bot to be fully functional. Many are required for it to start up at all.
- `commands`: Snowflakes of any registered application commands.
- `ldsg`: The Discord ID of the bot's home server (such as the test server), provided as a string.
- `ownerId`: The Discord ID of the bot's owner. Used in permission checks for various commands.
- `adminId`: An array of Discord User IDs. Used in permission checks for various commands.

### `config/rankConfig.json`
This file is used by `rankInfo.js`, which is in turn used by `rank.js`. This file will be merged into `config.json` and `snowflakes.json` later on.

### `data/banned.json`
The provided example can be copied without modification.

# Needs for more complete testing
- Google Sheets config and example for testing `bank.js`.
- How to test Snipcart-related functionality if needed?
- Automation of slash command registration.
