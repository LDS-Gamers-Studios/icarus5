const { request } = require("https");

class ExtraLifeAPI {
  constructor(data = {}) {
    this.set(data);
    this.teams = new Map();
    this.participants = new Map();
  }

  _call(path, data) {
    return new Promise((fulfill, reject) => {
      if (data) {
        path += "?" + Array.from(Object.keys(data)).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(data[k])}`).join("&");
      }
      request({
        host: "extralife.donordrive.com",
        port: 443,
        path: "/api" + path,
        method: "GET"
      }, (response) => {
        let output = "";
        response.on("data", (chunk) => {
          output += chunk;
        });
        response.on("end", () => {
          try {
            const parsed = JSON.parse(output);
            fulfill(parsed);
          } catch (error) {
            reject(error);
          }
        });
      }).end();
    });
  }

  async getParticipant(participantId) {
    participantId = participantId ?? this.participantId;
    if (!participantId) throw Error("participantId must be provided");

    const participant = await this._call(`/participants/${encodeURIComponent(participantId)}`);
    this.participants.set(participantId, participant);

    return participant;
  }

  async getParticipantDonations(participantId) {
    participantId = participantId ?? this.participantId;
    if (!participantId) throw Error("participantId must be provided");

    const donations = await this._call(`/participants/${encodeURIComponent(participantId)}/donations`);

    return donations;
  }

  async getTeam(teamId) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");

    const team = await this._call(`/teams/${encodeURIComponent(teamId)}`);
    this.teams.set(teamId, team);

    return team;
  }
  /**
   * @typedef donation
   * @property {String} donationID
   * @property {String} participantID
   * @property {String} displayName
   * @property {String} amount
   * @property {String} recipientName
   * @property {String} incentiveID
   * @property {String} message
   * @property {String} avatarImageURL
   * @property {Date} createdDateUTC
   */

  /**
   * @param {Number} participantId
   * @returns {Promise<donation[]>}
   */
  async getTeamDonations(teamId) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");

    const donations = await this._call(`/teams/${encodeURIComponent(teamId)}/donations`);

    return donations;
  }

  async getTeamWithParticipants(teamId) {
    teamId = teamId ?? this.teamId;
    if (!teamId) throw Error("teamId must be provided");
    const team = await this.getTeam(teamId);

    team.participants = await this._call(`/teams/${encodeURIComponent(teamId)}/participants`);
    return team;
  }

  set({ teamId = undefined, participantId = undefined }) {
    this.teamId = teamId ?? this.teamId;
    this.participantId = participantId ?? this.participantId;
    return this;
  }
}

const extraLifeAPI = new ExtraLifeAPI();

module.exports = extraLifeAPI;