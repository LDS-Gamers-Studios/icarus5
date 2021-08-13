const axios = require("axios");

class RegistryClient {
  constructor(applicationId, token) {
    this.applicationId = applicationId;
    this.token = token;
  }

  async _call(url, data, method = "get") {
    let response = await axios({
      method,
      url,
      data,
      baseURL: `https://discord.com/api/v8/applications/${this.applicationId}`,
      headers: { Authorization: `Bot ${this.token}` }
    });
    return response.data;
  }

  batchEditGuildCommandPermissions(guildId, permissions) {
    return this.call(`/guilds/${guildId}/commands/permissions`, permissions, "put");
  }

  bulkOverwriteCommands(commands, guildId) {
    return this.call(`${guildId ? `/guilds/${guildId}` : ""}/commands`, commands, "put");
  }

  createCommand(command, guildId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands`, command, "post");
  }

  deleteCommand(commandId, guildId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands/${commandId}`, null, "delete");
  }

  editCommand(commandId, command, guildId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands/${commandId}`, command, "patch");
  }

  editGuildCommandPermissions(guildId, commandId, permissions) {
    return this._call(`/guilds/${guildId}/commands/${commandId}/permissions`, permissions, "put");
  }

  getCommand(commandId, guildId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands/${commandId}`);
  }

  getGuildCommandPermissions(guildId, commandId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands${commandId ? `/${commandId}` : ""}/permissions`);
  }

  getCommands(guildId) {
    return this._call(`${guildId ? `/guilds/${guildId}` : ""}/commands`);
  }

}

module.exports = RegistryClient;
