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

const getStormCategory = (windSpeed) => {
  if (windSpeed >= 157) {
    return 5;
  }
  if (windSpeed >= 130) {
    return 4;
  }
  if (windSpeed >= 111) {
    return 3;
  }
  if (windSpeed >= 96) {
    return 2;
  }
  if (windSpeed >= 74) {
    return 1;
  }
  return 0;
};

export default async () => {
  // const indexTemplate = await fs.readFile(`${srcPath}/web/index.mustache`, {
  //   encoding: "utf-8",
  // });
  // const stormTemplate = await fs.readFile(`${srcPath}/web/storm.mustache`, {
  //   encoding: "utf-8",
  // });

  const db = new sqlite.Database(`${dataPath}/storms.2021.sqlite`);

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
        category: getStormCategory(last.maximum_sustained_wind_mph),
        heading: `${last.movement_speed_mph} mph to the ${headingFriendly(
          last.movement_direction_degrees
        )}`,
        // name: `${last.classification} ${last.name}`,
        updated: dayjs(last.timestamp)
          .tz("America/Chicago")
          .format("dddd, MMMM D, YYYY, h:mm a z"),
      };

      storms.push(stormData);

      // const html = mustache.render(stormTemplate, stormData);
      // fs.writeFile(`${docsPath}/${id}.html`, html);
    })
  );

  storms.sort(({ timestamp: a }, { timestamp: b }) => {
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

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Atlantic Hurricanes, 2021</title>
    <!-- COMMON TAGS -->
    <meta charset="utf-8" />
    <!-- Search Engine -->
    <meta name="description" content="Atlantic Hurricanes, 2021" />
    <meta name="image" content="https://mgwalker.github.io/atlantic-hurricanes/" />
    <!-- Schema.org for Google -->
    <meta itemprop="name" content="Atlantic Hurricanes, 2021" />
    <meta itemprop="description" content="Atlantic Hurricanes, 2021" />
    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Atlantic Hurricanes, 2021" />
    <meta name="twitter:description" content="Atlantic Hurricanes, 2021" />
    <!-- Open Graph general (Facebook, Pinterest & Google+) -->
    <meta name="og:title" content="Atlantic Hurricanes, 2021" />
    <meta name="og:description" content="Atlantic Hurricanes, 2021" />
    <meta name="og:url" content="https://mgwalker.github.io/atlantic-hurricanes/" />
    <meta name="og:site_name" content="Atlantic Hurricanes, 2021" />
    <meta name="og:locale" content="en_US" />
    <meta name="og:type" content="website" />

    <style type="text/css">
      body {
        font-family: monospace;
        padding: 0 3em;
      }

      h2 .updated {
        color: #888;
        font-size: 0.8rem;
        margin: 0;
      }

      table th.spacer, table td.spacer {
        padding-left: 2em;
      }

      table td.storm {
        border-top: 1px solid black;
        border-bottom: 1px solid #bbb;
      }

      table td.storm.category-1 {
        background-color: #ffffcc;
      }

      table td.storm.category-2 {
        background-color: #ffe775;
      }

      table td.storm.category-3 {
        background-color: #ffc140;
      }

      table td.storm.category-4 {
        background-color: #ff8f20;
      }

      table td.storm.category-4 h2 .updated {
        color: #eee;
      }

      table td.storm.category-5 {
        background-color: #ff6060;
      }

      table td.storm.category-5 h2 .updated {
        color: #ddd;
      }

      table th, table td {
        text-align: left;
        vertical-align: top;
      }

      table th + th, table td + td {
        padding-left: 1em;
      }
    </style>
  </head>
  <body>
    <h1>Atlantic Storms, 2021</h1>

    <p>
      Data of all storms:
      <a href="https://raw.githubusercontent.com/mgwalker/atlantic-hurricanes/main/data/storms.2021.sqlite">sqlite</a>
    </p>

    <table>${storms
      .map(
        (storm) => `
      <tr>
        <td colspan="6" class="storm category-${storm.category}">
          <h2>
            ${storm.classification} ${storm.name}${
          storm.category > 0 ? ` - Category ${storm.category}` : ""
        }
            <p class="updated">last updated   ${storm.updated}</p>
          </h2>
        </td>
      </tr>
      <tr>
        <th class="spacer"></th>
        <th>wind speed</th>
        <th>central pressure</th>
        <th>movement</th>
        <th>data (CSV)</th>
        <th>National Hurricane Center</th>
      </tr>
      <tr>
        <td class="spacer"></td>
        <td>${storm.maximum_sustained_wind_mph} mph</td>
        <td>${storm.minimum_central_pressure_mb} mb</td>
        <td>
          ${storm.heading}
          <br/>
          <span style="display: inline-block; font-size: 1.5em; rotate: ${
            storm.movement_direction_degrees
          }deg;">↑</span>
        </td>
        <td><a href="https://raw.githubusercontent.com/mgwalker/atlantic-hurricanes/main/data/csv/${
          storm.id
        }.csv">${storm.id}.csv</a></td>
        <td><a href="https://www.nhc.noaa.gov/archive/2021/${storm.name.toUpperCase()}.shtml?">NHC advisories</a></td>
      </tr>`
      )
      .join("\n")}
    </table>
  </body>
</html>
`;

  // const html = mustache.render(indexTemplate, { storms });
  fs.writeFile(`${docsPath}/index.html`, html);
};
