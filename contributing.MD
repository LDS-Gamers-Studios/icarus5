To set up a test intance of Icarus, here's what you'll need to do:

# Dependencies
- [MongoDB](https://www.mongodb.com/) ***(version?)***
- [Node.js](https://nodejs.org/) ***(version - ^16.13.1)***

# Files to create
For the bot to successfully run, you'll need to create or edit a few files first. These files, for various reasons, are excluded from the repository. However, example files are provided to make their creation easier.

## config\config.json
Create `config/config.json` based on `config/config-example.json`. Required items include:
- adminId: an array of Discord User IDs provided as strings. Used in permission checks for various commands.
- api.snipcart: required to run `/bank discount`. Can otherwise be left blank.
- api.steam: required to run `/bank game list`. Can otherwise be left blank, but will create an error message on loading `bank.js`. An API key can be requested [here](https://steamcommunity.com/dev/apikey).
- channels: see "Snowflakes" section below.
- commands: snowflakes of any registered application commands.
- db.db: a connection string used in `dbModels.js` passed to [`mongoose.connect()`](https://mongoosejs.com/docs/5.x/docs/api/mongoose.html#mongoose_Mongoose-connect). See also [here](https://mongoosejs.com/docs/5.x/docs/connections.html).
- db.settings: an object used in `dbModels.js` passed to [`mongoose.connect()`](https://mongoosejs.com/docs/5.x/docs/api/mongoose.html#mongoose_Mongoose-connect). See also [here](https://mongoosejs.com/docs/5.x/docs/connections.html).
- error.url: the URL of a Discord webhook for posting error messages.
- google: information for the Google API. Currently, the only fields accessed are `creds` and `sheets.games`, and they are accessed by `bank.js`.
- ldsg: the Discord ID of the bot's home server (in this case the test server), provided as a string.
- ownerId: the Discord ID of the bot's owner. Used in permission checks for various commands.
- roles: see "Snowflakes" section below.
- token: the bot's token for login.

### Snowflakes
A test server has been set up [here](https://discord.gg/BANbkb22Km), and a set of snowflakes for `channels` and `roles` is available there for use.

## config\rankConfig.json
This file is used by `rankInfo.js`, which is in turn used by `rank.js`.

## data\banned.json
The provided example can be copied without modification.

# Questions I need to resolve
- What version of MongoDB does the Icarus server run?
- What permission does Icarus have? So far, I'm estimating [this](https://discordapi.com/permissions.html#2554719302).

# Needs for more complete testing
- Google Sheets config and example for testing `bank.js`
- How to test Snipcart-related functionality if needed?

# Notes for pull request
- Merging the PR ***will delete some config files*** in the process of adding them to the `.gitignore` (specifically, `rankConfig.json`). Back them up before merging!

# Misc
- How can the amount of config needed to start dev-testing be reduced??

# Bringing the bot into a server
Link to authorize slash commands:
https://discord.com/oauth2/authorize?client_id=CLIENTIDHERE&permissions=PERMISSIONSGOESHERE&scope=applications.commands%20bot

# Installation
- run `npm ci`
- run `node .\icarus.js`
