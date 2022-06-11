const axios = require("axios");
const { Collection } = require('discord.js');

class youtubeAPI {
  constructor(apikey) {
    this._setKey(apikey);
  }

  async _call(url, params, data, method = "get") {
    return (await axios({
      url,
      baseURL: "https://www.googleapis.com/youtube/v3/",
      method,
      headers: null,
      params,
      data
    })).data;
  }
  _setKey(apikey) {this.apikey = apikey;}
  /**
   * @typedef IdObj
   * @property {string} yt the YouTube ID
   * @property {string} id the Discord ID
   */
  /**
   * @param {IdObj[]} ids
   * @returns {[IdObj]}
   */
  getChannelPlaylist(ids) {
    const mapper = (yt) => {
      if (yt[1] != 'C') return '';
      const split = yt.split('');
      split[1] = 'U';
      return split.join('');
    };
    if (!ids || ids.length == 0) return [];
    const newIDs = ids.map(id => {return { id: id.id, yt: mapper(id.yt) };}).filter(i => i.yt != '');
    return newIDs;

  }
  /**
   * @param {string} id youtube channel ID
   * @returns {Promise<[{id: string, snippet: snippet}]>}
   */
  async getChannels(id) {
    if (Array.isArray(id)) id = id.join(',');
    const params = {
      key: this.apikey,
      part: "snippet",
      id,
      maxResults: 1
    };
    const channel = await this._call("channels", params);
    return channel.items?.map(i => {return { id: i.id, snippet: i.snippet };}) ?? [];
  }
  async getVideoIDsFromPlaylist(playlist, max = 3) {
    const params = {
      key: this.apikey,
      part: "contentDetails",
      playlistId: playlist,
      maxResults: max
    };
    const vids = await this._call("playlistItems", params);
    return vids.items.map(v => v.contentDetails.videoId);
  }
  async getVideosFromIds(ids, max = 3) {
    const params = {
      key: this.apikey,
      part: 'snippet',
      id: ids.join(','),
      maxResults: max
    };
    const vids = await this._call("videos", params);
    return vids.items;
  }
  /**
   * @param {IdObj[]} ids
   * @returns {Promise<Collection<string, {id: string, videos: Video[]}>>}
  */
  async getManyUserVids(ids, vidsPerChannel = 3) {
    const videos = new Collection();
    const playlists = this.getChannelPlaylist(ids);
    let i = 0;
    do {
      const list = playlists[i];
      if (list) {
        const pvids = await this.getVideoIDsFromPlaylist(list.yt, vidsPerChannel);
        const vids = await this.getVideosFromIds(pvids, vidsPerChannel);
        videos.set(list.id, { id: list.id, videos: vids });
      }
      i++;
    } while (i < playlists.length);
    return videos;
  }
  /**
   * @typedef snippet
   * @property {string} publishedAt
   * @property {string} channelId
   * @property {string} title
   * @property {string} description
   * @property {{}} thumbnails
   * @property {string} channelTitle
   * @property {string[]} tags
   * @property {string} categoryId
   * @property {string} liveBroadcastContent
   * @property {string} defaultLanguage
   * @property {{}} localized
   * @property {string} defaultAudioLanguage
   *
   * @typedef Video
   * @property {string} kind
   * @property {string} etag
   * @property {string} id
   * @property {snippet} snippet
   */
  /** @param {Video[]} videos */
  getLive(videos) {
    return videos.sort((a, b) => a.snippet.publishedAt - b.snippet.publishedAt)
      .find(v => v.snippet.liveBroadcastContent == 'live');
  }
}

module.exports = youtubeAPI;