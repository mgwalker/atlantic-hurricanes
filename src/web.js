import fs from "fs/promises";
import sqlite from "sqlite3";

import {
  dataPath,
  docsPath,
  getStormCategory,
  headingFriendly,
  sqlite as dbUtils,
} from "./util.js";

const { getAll } = dbUtils;

export default async () => {
  const db = new sqlite.Database(`${dataPath}/storms.2023.sqlite`);

  const ids = (await getAll(db, "SELECT DISTINCT id FROM storms")).map(
    ({ id }) => id
  );

  const storms = [];

  await Promise.all(
    ids.map(async (id) => {
      const storm = await getAll(db, "SELECT * FROM storms WHERE id=?", [id]);
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
      const prev = storm.slice(-2, -1).pop();

      const delta = (a, b) => {
        const d = a - b;
        const sign = d > 0 ? "+" : "";

        return `${sign}${d}`;
      };

      const stormData = {
        ...last,
        id,
        category: getStormCategory(last.maximum_sustained_wind_mph),
        heading: `${last.movement_speed_mph} mph to the ${headingFriendly(
          last.movement_direction_degrees
        )}`,
        deltaWind: prev
          ? `<br>${delta(
              last.maximum_sustained_wind_mph,
              prev.maximum_sustained_wind_mph
            )} mph since last update`
          : "",
        deltaPressure: prev
          ? `<br>${delta(
              last.minimum_central_pressure_mb,
              prev.minimum_central_pressure_mb
            )} mb since last update`
          : "",
        updated: last.timestamp,
      };

      storms.push(stormData);
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

  const active = storms.filter(({ final }) => !final);

  const html = `
<!DOCTYPE html>
<html lang="en">
  <head>
    <title>Atlantic Hurricanes, 2023</title>
    <!-- COMMON TAGS -->
    <meta charset="utf-8" />
    <!-- Search Engine -->
    <meta name="description" content="Atlantic Hurricanes, 2023" />
    <meta name="image" content="https://mgwalker.github.io/atlantic-hurricanes/" />
    <!-- Schema.org for Google -->
    <meta itemprop="name" content="Atlantic Hurricanes, 2023" />
    <meta itemprop="description" content="Atlantic Hurricanes, 2023" />
    <!-- Twitter -->
    <meta name="twitter:card" content="summary" />
    <meta name="twitter:title" content="Atlantic Hurricanes, 2023" />
    <meta name="twitter:description" content="Atlantic Hurricanes, 2023" />
    <!-- Open Graph general (Facebook, Pinterest & Google+) -->
    <meta name="og:title" content="Atlantic Hurricanes, 2023" />
    <meta name="og:description" content="Atlantic Hurricanes, 2023" />
    <meta name="og:url" content="https://mgwalker.github.io/atlantic-hurricanes/" />
    <meta name="og:site_name" content="Atlantic Hurricanes, 2023" />
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
        border-top: 4px solid black;
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

      figcaption {
        font-size: 0.7em;
        text-align: right;
      }
    </style>
  </head>
  <body>
    <h1>Atlantic Storms, 2023</h1>

    <p>
      Data of all storms:
      <a href="https://raw.githubusercontent.com/mgwalker/atlantic-hurricanes/main/data/storms.2023.sqlite">sqlite</a>
    </p>

    ${
      active.length < 2
        ? ""
        : `
    <h2>${active.length} active storms</h2>
    <img src="active.png">`
    }

    <table>${storms
      .map(
        (storm) => `
      <tr>
        <td colspan="6" class="storm ${
          storm.final ? "" : `category-${storm.category}`
        }" ${
          storm.final
            ? `style="cursor:pointer;" onClick="toggle('${storm.id}')"`
            : ""
        }>
          <h2>${
            storm.final
              ? `🏁 ${storm.name}`
              : `
            ${storm.classification} ${storm.name}${
                  storm.category > 0 ? ` - Category ${storm.category}` : ""
                }
            <p class="updated">last updated <span data-time>${
              storm.updated
            }</span></p>`
          }
          </h2>
        </td>
      </tr>
      ${
        storm.final
          ? ""
          : `
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
        <td>${storm.maximum_sustained_wind_mph} mph${storm.deltaWind}</td>
        <td>${storm.minimum_central_pressure_mb} mb${storm.deltaPressure}</td>
        <td>
          ${storm.heading}
          <br/>
          <span style="display: inline-block; font-size: 1.5em; transform: rotate(${
            storm.movement_direction_degrees
          }deg);">↑</span>
        </td>
        <td><a href="https://raw.githubusercontent.com/mgwalker/atlantic-hurricanes/main/data/csv/${
          storm.id
        }.csv">${storm.id}.csv</a></td>
        <td><a href="https://www.nhc.noaa.gov/archive/2023/${storm.name.toUpperCase()}.shtml?">NHC advisories</a></td>
      </tr>`
      }
      <tr id="storm_${storm.id}" ${storm.final ? 'style="display:none;"' : ""}>
        <td class="spacer">
        <td colspan="5">
          <figure>
            <img src="${storm.id}.png">
            <figcaption>
              Map data &copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors,
              Imagery &copy; <a href="https://www.mapbox.com/">Mapbox</a> |
              <a href="https://www.mapbox.com/map-feedback/" target="_blank">Improve this map</a>
            </figcaption>
          </figure>
        </td>
      </tr>
      `
      )
      .join("\n")}
    </table>
    <script type="text/javascript">
      const formatter = new Intl.DateTimeFormat([], {
        day: "numeric",
        hour: "numeric",
        minute: "numeric",
        month: "long",
        timeZoneName: "short",
        weekday: "long",
        year: "numeric"
      });

      Array.from(document.querySelectorAll("[data-time]")).forEach((e) => {
        const d = new Date(Date.parse(e.innerText));
        e.innerText = formatter.format(d);
      });

      const toggle = (id) => {
        const el = document.querySelector(\`#storm_\${id}\`);
        if(el.style.display === "none") {
          el.style.display = "";
        } else {
          el.style.display = "none";
        }
      }
    </script>
  </body>
</html>
`;

  fs.writeFile(`${docsPath}/index.html`, html);
};
