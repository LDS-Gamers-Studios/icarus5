const https = require("https");
// none of the "new" api functions work with https
const axios = require('axios');
function request({ path, method = "GET", hostname = "www.edsm.net", params = {} }) {
  return new Promise((fulfill, reject) => {
    const options = {
      hostname,
      port: 443,
      path: `${path}?${Object.keys(params).map(k => `${encodeURIComponent(k)}=${encodeURIComponent(params[k])}`).join("&")}`,
      method
    };
    const req = https.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });

      res.on("end", () => {
        try {
          fulfill(JSON.parse(data.replace(/<br \\\/>/g, "\\n")));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.end();
  });
}
async function axiosRequest({ path, method, hostname = "https://www.edsm.net", params }) {
  const fetched = await axios({
    method,
    url: path,
    baseURL: hostname,
    params
  });
  if (!params) console.log(fetched?.data);
  return fetched?.data;
}

function fetchSystemFactions(systemName) {
  return request({
    path: "/api-system-v1/factions",
    params: { systemName, showHistory: 0 }
  });
}

function fetchGalnetFeed() {
  return request({
    hostname: "www.alpha-orbital.com",
    path: "/galnet-feed"
  });
}
async function getSystemInfo(systemName) {
  try {
    const starSystem = await axiosRequest({
      path: "api-v1/system",
      params: {
        showPrimaryStar: 1,
        showInformation: 1,
        showPermit: 1,
        showId: 1,
        systemName: systemName
      }
    });
    if (Array.isArray(starSystem)) return null;

    if (starSystem.information === {}) starSystem.information = null;

    const bodiesResponse = await axiosRequest({
      path: "api-system-v1/bodies",
      params: {
        systemName: systemName
      }
    });
    starSystem.bodies = bodiesResponse.bodies;
    starSystem.bodiesURL = bodiesResponse.url;

    const stationsResponse = await axiosRequest({
      path: "api-system-v1/stations",
      params: {
        systemName: systemName
      }
    });
    starSystem.stations = stationsResponse.stations;
    starSystem.stationsURL = stationsResponse.url;

    const factionsResponse = await axiosRequest({
      path: "api-system-v1/factions",
      params: {
        systemName: systemName
      }
    });
    starSystem.factions = factionsResponse.factions;
    starSystem.factionsURL = factionsResponse.url;

    return starSystem;
  } catch (error) { throw new Error(error); }
}
async function getEliteStatus() {
  try {
    return await axiosRequest({ path: "api-status-v1/elite-server" });
  } catch (error) {
    throw new Error(error);
  }
}

module.exports = {
  axiosRequest,
  fetchGalnetFeed,
  fetchSystemFactions,
  getSystemInfo,
  getEliteStatus
};
