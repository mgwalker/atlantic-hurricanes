import fs from "node:fs/promises";
import { FormData } from "formdata-node";
import sqlite from "sqlite3";
import {
  dataPath,
  getStormCategory,
  sqlite as dbUtils,
  year,
  exists,
} from "./util.js";

const { getAll } = dbUtils;

export default async (updatedStorms, metadataMap) => {
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
      const body = new FormData();
      body.set("status", text.join(" "));

      const mediaPath = `./docs/${storm[0].id}.png`;
      if (await exists(mediaPath)) {
        const buffer = await fs.readFile(mediaPath);
        const blob = new Blob([buffer], { type: "image/png" });

        const mediaBody = new FormData();
        mediaBody.set("file", blob, `${storm[0].id}.png`);

        const upload = await fetch(`${TOOT_URL}/api/v2/media`, {
          method: "POST",
          headers: { Authorization: `Bearer ${API_TOKEN}` },
          body: mediaBody,
        }).then((response) => response.json());

        if (upload.id) {
          body.set("media_ids[]", upload.id);
        }
      }

      await fetch(`${TOOT_URL}/api/v1/statuses`, {
        method: "POST",
        headers: { Authorization: `Bearer ${API_TOKEN}` },
        body,
      });
    }
  }
};
