import generator from "megalodon";
import sqlite from "sqlite3";
import { dataPath, getStormCategory, sqlite as dbUtils, year } from "./util.js";

const { getAll } = dbUtils;

const doCredentials = async () => {
  // const TOOT_URL = process.env.MASTODON_SERVER_URL;
  // const API_TOKEN = process.env.MASTODON_API_TOKEN;
  // const client = generator.default("mastodon", TOOT_URL);
  ///////// register client and get auth code /////////////
  // client
  //   .registerApp("Hurricane bot", { scopes: ["write:statuses"] })
  //   .then((appData) => {
  //     console.log(appData.client_id);
  //     console.log(appData.client_secret);
  //     console.log("\n\n");
  //     console.log("Authorization URL is generated.");
  //     console.log(appData.url);
  //   });
  ///////// get access token /////////////
  // const clientId = "---fill in---";
  // const clientSecret = "---fill in---";
  // const code = "---fill in---";
  // client
  //   .fetchAccessToken(clientId, clientSecret, code)
  //   .then((tokenData) => {
  //     console.log(tokenData.accessToken);
  //     console.log(tokenData.refreshToken);
  //   })
  //   .catch((err) => console.error(err));
};

export default async (updatedStorms, metadataMap) => {
  // await doCredentials();

  const TOOT_URL = process.env.MASTODON_SERVER_URL;
  const API_TOKEN = process.env.MASTODON_API_TOKEN;

  if (!TOOT_URL || !API_TOKEN) {
    console.log("No credentials. Not tooting.");
    return;
  }

  const db = new sqlite.Database(`${dataPath}/storms.${year}.sqlite`);

  const storms = await getAll(
    db,
    `SELECT DISTINCT * FROM storms WHERE id IN (${[...updatedStorms]
      .map((v) => `'${v}'`)
      .join(",")}) AND NOT final=true;`
  ).then((all) =>
    all.reduce((previous, current) => {
      if (!previous.has(current.id)) {
        previous.set(current.id, []);
      }
      previous.get(current.id).push(current);

      return previous;
    }, new Map())
  );

  for await (const storm of storms.values()) {
    let isTootable = false;

    storm.sort(({ timestamp: a }, { timestamp: b }) => {
      const aa = Date.parse(a);
      const bb = Date.parse(b);

      if (aa < bb) {
        return 1;
      }
      if (aa > bb) {
        return -1;
      }
      return 0;
    });

    const latest = storm[0];
    const previous = storm[1];

    const text = [];
    if (previous) {
      if (latest.classification === previous.classification) {
        text.push("Updating");
      }
      text.push(`${previous.classification} ${previous.name}`);
      if (latest.classification !== previous.classification) {
        text.push(`is now ${latest.classification} ${latest.name}`);
        isTootable = true;
      }
      const catLatest = getStormCategory(latest.maximum_sustained_wind_mph);
      const catPrevious = getStormCategory(previous.maximum_sustained_wind_mph);
      if (catLatest !== catPrevious && catLatest > 0) {
        if (catPrevious > 0) {
          // storm category changed
          isTootable = true;
          if (catLatest > catPrevious) {
            text.push(`\nUpgraded to category ${catLatest}`);
          } else {
            text.push(`\nDowngraded to category ${catLatest}`);
          }
        }
      } else if (catLatest > 0) {
        text.push(`\nCategory ${catLatest}`);
      }
    } else {
      text.push(`${latest.classification} ${latest.name} has formed`);
      isTootable = true;
    }

    text.push(
      `

${metadataMap.get(latest.id).position}

Max winds: ${latest.maximum_sustained_wind_mph} mph
Central pressure: ${latest.minimum_central_pressure_mb} mb`
    );
    text.push(`\n\n${metadataMap.get(latest.id).url}\n#${latest.id}`);

    if (isTootable) {
      const client = new generator.Mastodon(TOOT_URL, API_TOKEN);
      await client.postStatus(text.join(" "), {});
    }
  }
};
