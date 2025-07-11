import dayjs from "dayjs";
import format from "dayjs/plugin/advancedFormat.js";
import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import sqlite from "sqlite3";
import timezone from "dayjs/plugin/timezone.js";
import { fileURLToPath, pathToFileURL } from "url";
import utc from "dayjs/plugin/utc.js";

import {
  cachePath,
  dataPath,
  docsPath,
  getStormCategory,
  srcPath,
  sleep,
  sqlite as dbUtils,
  year,
} from "./util.js";

const { getAll } = dbUtils;

dayjs.extend(format);
dayjs.extend(utc);
dayjs.extend(timezone);

const makeMaps = async (force = false) => {
  const lastUpdated = force
    ? {}
    : JSON.parse(
        await fs.readFile(`${cachePath}/lastUpdated.json`, {
          encoding: "utf-8",
        })
      );

  const db = new sqlite.Database(`${dataPath}/storms.${year}.sqlite`);

  const url = pathToFileURL(path.join(srcPath, "map.html")).href;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);

  await sleep(500);

  // Only draw maps for active storms
  const ids = (
    await getAll(db, "SELECT DISTINCT id FROM storms WHERE final=0")
  ).map(({ id }) => id);

  const allActive = [];
  let redrawOverviewMap = false;

  for await (const id of ids) {
    const storm = await getAll(db, "SELECT * FROM storms WHERE id=?", id);
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

    const latest = storm.pop();

    const wind = {
      hurricane: latest.hurricane_wind_extent_miles,
      tropical: latest.tropical_storm_wind_extent_miles,
    };

    // Some intermediate hurricane updates don't include new wind extents. In
    // those cases, fall back to the nearest update that does have extents.
    if (
      latest.classification.toLowerCase() === "hurricane" &&
      !wind.hurricane
    ) {
      let previous = storm.pop();
      while (
        previous.classification.toLowerCase() === "hurricane" &&
        !previous.hurricane_wind_extent_miles
      ) {
        previous = storm.pop();
      }

      wind.hurricane = previous.hurricane_wind_extent_miles;
      wind.tropical = previous.tropical_storm_wind_extent_miles;
    }

    const metadata = {
      type: `${latest.classification.toLowerCase()}`,
      name: `${latest.classification} ${latest.name}`,
      updated: dayjs(latest.timestamp)
        .tz("America/Chicago")
        .format("ddd, MMM D, YYYY, ha z"),
      category: getStormCategory(latest.maximum_sustained_wind_mph),
      lat: latest.latitude,
      lon: latest.longitude,
      wind: latest.maximum_sustained_wind_mph,
      pressure: latest.minimum_central_pressure_mb,
      direction: latest.movement_direction_degrees,
      windExtent: wind,
      tracks: storm.map(({ latitude, longitude }) => [latitude, longitude]),
    };
    allActive.push(metadata);

    if (lastUpdated[id] === latest.timestamp) {
      continue;
    }
    lastUpdated[id] = latest.timestamp;

    // If we update any individual maps, also update the overview map
    redrawOverviewMap = true;

    const discussionUrl = await fetch(
      `https://www.nhc.noaa.gov/archive/${year}/${latest.name.toUpperCase()}.shtml`
    )
      .then((response) => response.text())
      .then((text) =>
        text
          .match(/<td.+? headers="col1">([\s\S]*?)<\/td>/gim)
          .map((block) =>
            block
              .match(/<a href="([^"]+)"/gi)
              ?.map((a) => a.match(/<a href="([^"]+)"/i)[1])
          )
          .filter((v) => Array.isArray(v))
          .flat()
          // For some reason, forecast discussion URLs are sometimes spelled
          // as discus instead of discuss.
          .filter((v) => /\.discuss?\./.test(v))
          .map((u) => `https://www.nhc.noaa.gov${u}`)
          .pop()
      );

    metadata.forecast = await fetch(discussionUrl)
      .then((response) => response.text())
      .then((text) => {
        const [, discussion] = text.match(/<pre>([\s\S]*)<\/pre>/im);

        const [, forecastText] = discussion
          .replace(/ ?\n ?/gm, "\n")
          .match(/FORECAST POSITIONS AND MAX WINDS\n\n([\s\S]+?)\n\n/im);

        return (
          forecastText
            .split("\n")
            .map((line) => line.split(/[a-z] /i))
            // Slice off the first one since it's the current state and we're
            // already handling that.
            .slice(1)
            .map(([, , lat, lon]) => ({
              lat,
              lon,
            }))
            .map(({ lat, lon }) => ({ lat: +lat, lon: -+lon }))
            .filter(({ lat, lon }) => lat && lon)
        );
      });

    console.log(`Updating map for storm ${id}`);

    page.on("console", (msg) => {
      console.log(msg);
    });
    await page.evaluate((metadata) => {
      window.draw(metadata);
    }, metadata);
    await sleep(3000);

    const map = await page.$("#map");
    await map.screenshot({ path: `${docsPath}/${id}.png` });

    await page.reload();
    await sleep(500);
  }

  if (redrawOverviewMap) {
    await page.evaluate((allActive) => {
      window.draw(allActive);
    }, allActive);
    await sleep(3000);

    const activeMap = await page.$("#map");
    await activeMap.screenshot({ path: `${docsPath}/active.png` });
  }

  await browser.close();

  if (!force) {
    await fs.writeFile(
      `${cachePath}/lastUpdated.json`,
      JSON.stringify(lastUpdated, null, 2),
      { encoding: "utf-8" }
    );
  }
};

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  makeMaps(true);
}

export default makeMaps;
