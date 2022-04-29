const https = require("https");

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

module.exports = {
  fetchGalnetFeed,
  fetchSystemFactions
};
