const axios = require("axios");
const { Collection } = require('discord.js');
const u = require('./utils');
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
    }).catch(error => u.errorHandler(error, `YT API Fetch ${url}`)))?.data;
  }
  _setKey(apikey) {this.apikey = apikey;}
  /**
   * @typedef IdObj
   * @property {string} yt the YouTube ID
   * @property {string} id the Discord ID
   */
  /**
   * Get the playlist IDs from an array of channel IDs
   * @param {IdObj[]} ids
   * @returns {IdObj[]} object with the discord ID and their channel playlist ID
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
   * Get the name of the game from a video
   * @param {string} id the video ID
   * @returns {Promise<string|null>} the game name if it found one
   */
  async getGame(id) {
    const regex = /\\x22mediaLockups\\x22:\\x5b\\x7b\\x22mediaLockupRenderer\\x22:\\x7b\\x22title\\x22:\\x7b\\x22runs\\x22:\\x5b\\x7b\\x22text\\x22:\\x22(.*?)\\x22\\x7d\\x5d\\x7d,/g;
    const document = await axios({
      url: `https://m.youtube.com/watch?v=${id}`,
      method: 'get',
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Access-Control-Allow-Origin': '*',
        'x-youtube-client-name': 1,
        'x-youtube-client-version': '2.20200911.04.00',
        'User-Agent': 'Mozilla/5.0 (Linux; Android 5.0; SM-G900P Build/LRX21T) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/67.0.3396.87 Mobile Safari/537.36'
      }
    }).catch(error => u.errorHandler(error, "Fetch YouTube Video's game"));
    let found = regex.exec(document?.data)?.at(1);
    if (found?.includes('\\\\')) found = decodeURIComponent(found.replace(/\\\\/g, '\\')); // Decode any encoded unicode (There's an extra \ in there for some reason)
    return found;
  }
  /**
   * Get channel snippets of 1 or more channels
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
  /**
   * Get an array of video IDs from a playlist
   * @param {string} playlist The playlist ID
   * @param {number} max The maximum number of videos to return
   * @returns {string[]}
   */
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
  /**
   * Get an array of videos from an array of IDs
   * @param {string[]} ids An array of video IDs to fetch
   * @param {number} max The maximum number of videos to return
   * @returns {Video[]}
   */
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
   * Shortcut for most of the methods, gets a array of videos from an array of channel IDs
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
   * @property {string?} game
   */
  /**
   * See if any of the provided videos are livestreams
   * @param {Video[]} videos
   */
  getLive(videos) {
    return videos.sort((a, b) => a.snippet.publishedAt - b.snippet.publishedAt)
      .find(v => v.snippet.liveBroadcastContent == 'live');
  }
}

module.exports = youtubeAPI;