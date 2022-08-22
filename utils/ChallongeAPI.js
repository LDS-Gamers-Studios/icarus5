const request = require("request");

const ChallongeApi = {
  api_key: null,
  // GENERAL
  callApi: function(call, params = {}, method = "get") {
    const self = ChallongeApi;
    return new Promise(function(fulfill, reject) {
      params["api_key"] = self.api_key;
      const urlParams = Object.keys(params).map(function(key) {
        return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
      }).join('&');
      const url = "https://api.challonge.com/v1" + call + ".json?" + urlParams;
      request({ url: url, method: method, encoding: "utf8" }, function(error, response, body) {
        if (!error && response.statusCode == 200) {
          body = JSON.parse(body);
          if (body.error) {
            console.log(`${body.error.code} - ${body.error.message}`);
            reject(body);
          } else {
            fulfill(body);
          }
        } else {
          reject({ "code": response.statusCode, "error": error });
        }
      });
    });
  },
  resolve: function(resolvable) {
    if (resolvable.tournament) return resolvable.tournament.id;
    else if (resolvable.participant) return resolvable.participant.id;
    else if (resolvable.match) return resolvable.match.id;
    else return resolvable;
  },
  init: function(api_key) {
    ChallongeApi.api_key = api_key;
    return ChallongeApi;
  },

  // TOURNAMENTS,
  getTournamentsIndex: function(params) {
    const self = ChallongeApi;
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments`, params).then(fulfill, reject);
    });
  },
  getTournamentDetails: function(tournament, options = {}) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    const params = {
      "include_participants" : 1,
      "include_matches" : 0
    };
    let x;
    for (x in options) {
      params[x] = options[x];
    }
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}`, params).then(fulfill, reject);
    });
  },
  processCheckins: function(tournament, options = {}) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    const params = {
      "include_participants" : 0,
      "include_matches" : 0
    };
    let x;
    for (x in options) {
      params[x] = options[x];
    }
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/process_check_ins`, params, "post").then(fulfill, reject);
    });
  },
  startTournament: function(tournament, options = {}) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    const params = {
      "include_participants" : 0,
      "include_matches" : 0
    };
    let x;
    for (x in options) {
      params[x] = options[x];
    }
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/start`, params, "post").then(fulfill, reject);
    });
  },

  // PARTICIPANTS,
  participantCheckIn: function(tournament, participant) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    participant = self.resolve(participant);
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/participants/${participant}/check_in`, {}, "post").then(fulfill, reject);
    });
  },
  participantUndoCheckIn: function(tournament, participant) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    participant = self.resolve(participant);
    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/participants/${participant}/undo_check_in`, {}, "post").then(fulfill, reject);
    });
  },
  participantUpdate: function(tournament, participant, info = {}) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    participant = self.resolve(participant);
    const options = ["name", "challonge_username", "email", "seed", "misc"];
    const params = {};
    options.forEach(function(option) {
      if (info[option]) params[`participant[${option}]`] = info[option];
    });

    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/participants/${participant}`, params, "put").then(fulfill, reject);
    });
  },

  // MATCHES,
  matchUpdate: function(tournament, match, info = {}) {
    const self = ChallongeApi;
    tournament = self.resolve(tournament);
    match = self.resolve(match);
    const options = ["scores_csv", "winner_id", "player1_votes", "player2_votes"];
    const params = {};
    options.forEach(function(option) {
      if (info[option]) params[`match[${option}]`] = info[option];
    });

    return new Promise(function(fulfill, reject) {
      self.callApi(`/tournaments/${tournament}/matches/${match}`, params, "put").then(fulfill, reject);
    });
  }
};

module.exports = ChallongeApi;