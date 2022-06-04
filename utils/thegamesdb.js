const axios = require("axios");

class theGamesDBApi {
  constructor(apikey) {
    this._setKey(apikey);
  }

  async _call(url, params, data, method = "get") {
    return (await axios({
      url,
      baseURL: "https://api.thegamesdb.net/",
      method,
      headers: null,
      params,
      data
    })).data?.data;
  }

  _setKey(apikey) {
    this.apikey = apikey;
  }

  byGameName(name, options = {}) {
    const params = {
      apikey: this.apikey,
      name,
      fields: (Array.isArray(options.fields) ? options.fields.join(",").toLowerCase() : options.fields),
      filter: (Array.isArray(options.filter) ? options.filter.join(",").toLowerCase() : options.filter),
      include: (Array.isArray(options.include) ? options.include.join(",").toLowerCase() : options.include),
      page: options.page
    };
    return this._call("/v1.1/Games/ByGameName", params);
  }

  images(games_id, options = {}) {
    const params = {
      apikey: this.apikey,
      games_id,
      filter: options.filter,
      page: options.page
    };
    return this._call("/v1/Games/Images", params);
  }
}

module.exports = theGamesDBApi;