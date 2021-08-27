import dayjs from "dayjs";
import format from "dayjs/plugin/advancedFormat.js";
import fs from "fs/promises";
import mustache from "mustache";
import sqlite from "sqlite3";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import { dataPath, docsPath, headingFriendly, srcPath } from "./util.js";

dayjs.extend(format);
dayjs.extend(utc);
dayjs.extend(timezone);

const get = async (db, query, params) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, row) => {
      if (err) {
        return reject(err);
      }
      return resolve(row);
    });
  });

export default async () => {
  const indexTemplate = await fs.readFile(`${srcPath}/web/index.mustache`, {
    encoding: "utf-8",
  });
  const stormTemplate = await fs.readFile(`${srcPath}/web/storm.mustache`, {
    encoding: "utf-8",
  });

  const db = new sqlite.Database(`${dataPath}/storms.sqlite`);

  const ids = (await get(db, "SELECT DISTINCT id FROM storms")).map(
    ({ id }) => id
  );

  const storms = [];

  await Promise.all(
    ids.map(async (id) => {
      const storm = await get(db, "SELECT * FROM storms WHERE id=?", [id]);
      storm.sort(({ timestamp: a }, { timestamp: b }) => {
        const aa = Date.parse(a);
        const bb = Date.parse(b);

        if (aa < bb) {
          return -1;
        }
        if (aa > bb) {
          return 1;
        }
        return 0;
      });

      const last = storm.slice(-1).pop();
      const stormData = {
        ...last,
        id,
        heading: `${last.movement_speed_mph} mph to the ${headingFriendly(
          last.movement_direction_degrees
        )}`,
        name: `${last.classification} ${last.name}`,
        updated: dayjs(last.timestamp)
          .tz("America/Chicago")
          .format("dddd, MMMM D, YYYY, h:mm a z"),
      };

      storms.push(stormData);

      const html = mustache.render(stormTemplate, stormData);
      fs.writeFile(`${docsPath}/${id}.html`, html);
    })
  );

  storms.sort(({ timestamp: a }, { timestamp: b }) => {
    const aa = Date.parse(a);
    const bb = Date.parse(b);

    if (aa < bb) {
      return -1;
    }
    if (aa > bb) {
      return 1;
    }
    return 0;
  });

  const html = mustache.render(indexTemplate, { storms });
  fs.writeFile(`${docsPath}/index.html`, html);
};
