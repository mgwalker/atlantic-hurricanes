import fs from "fs/promises";
import sqlite from "sqlite3";
import { fileURLToPath } from "url";
import render from "./templates/index.js";
import {
  dataPath,
  sqlite as dbUtils,
  docsPath,
  getStormCategory,
  headingFriendly,
  year,
} from "./util.js";

const { getAll } = dbUtils;

export const makeWeb = async () => {
  const db = new sqlite.Database(`${dataPath}/storms.${year}.sqlite`);

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
        year,
        ucname: last.name.toUpperCase(),
        category: getStormCategory(last.maximum_sustained_wind_mph),
        heading: `${last.movement_speed_mph} mph to the ${headingFriendly(
          last.movement_direction_degrees
        )}`,
        deltaWind: prev
          ? `${delta(
              last.maximum_sustained_wind_mph,
              prev.maximum_sustained_wind_mph
            )} mph since last update`
          : "",
        deltaPressure: prev
          ? `${delta(
              last.minimum_central_pressure_mb,
              prev.minimum_central_pressure_mb
            )} mb since last update`
          : "",
        updated: last.timestamp,
        series: {
          pressure: storm.map(({ timestamp, minimum_central_pressure_mb }) => ({
            timestamp,
            value: minimum_central_pressure_mb,
          })),
          wind: storm.map(({ timestamp, maximum_sustained_wind_mph }) => ({
            timestamp,
            value: maximum_sustained_wind_mph,
          })),
          extents: {
            hurricane: storm.map(
              ({ timestamp, hurricane_wind_extent_miles }) => ({
                timestamp,
                value: hurricane_wind_extent_miles,
              })
            ),
            tropical: storm.map(
              ({ timestamp, tropical_storm_wind_extent_miles }) => ({
                timestamp,
                value: tropical_storm_wind_extent_miles,
              })
            ),
          },
        },
      };

      if (stormData.classification.toLowerCase() !== "hurricane") {
        stormData.category = false;
      }

      // If there aren't any tropical storm wind extents, remove it
      if (!stormData.series.extents.tropical.some(({ value }) => value)) {
        delete stormData.series.extents.tropical;
      }
      // Same with hurricane.
      if (!stormData.series.extents.hurricane.some(({ value }) => value)) {
        delete stormData.series.extents.hurricane;
      }
      if (
        !stormData.series.extents.tropical &&
        !stormData.series.extents.hurricane
      ) {
        delete stormData.series.extents;
      }

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

  const html = await render({
    year,
    active,
    multipleActive: active > 1,
    storms,
  });

  fs.writeFile(`${docsPath}/index.html`, html);
  fs.writeFile(`${docsPath}/${year}.html`, html);
};

export default makeWeb;

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  makeWeb();
}
