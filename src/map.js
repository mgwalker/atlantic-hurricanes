import dayjs from "dayjs";
import format from "dayjs/plugin/advancedFormat.js";
import fs from "fs/promises";
import http from "http";
import path from "path";
import { chromium } from "playwright";
import sqlite from "sqlite3";
import timezone from "dayjs/plugin/timezone.js";
import utc from "dayjs/plugin/utc.js";

import {
  cachePath,
  dataPath,
  docsPath,
  getStormCategory,
  srcPath,
  sleep,
  sqlite as dbUtils,
} from "./util.js";

const { getAll } = dbUtils;

dayjs.extend(format);
dayjs.extend(utc);
dayjs.extend(timezone);

export default async () => {
  const lastUpdated = JSON.parse(
    await fs.readFile(`${cachePath}/lastUpdated.json`, { encoding: "utf-8" })
  );

  const db = new sqlite.Database(`${dataPath}/storms.2021.sqlite`);
  const html = await fs.readFile(path.join(srcPath, "map.html"));

  const serve = async () =>
    new Promise((resolve) => {
      const requestListener = async (req, res) => {
        res.writeHead(200);
        res.end(html);
      };

      const server = http.createServer(requestListener);
      server.listen(8080, () => {
        resolve({
          close: () => {
            server.close();
          },
        });
      });
    });

  const server = await serve();

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto("http://localhost:8080");

  await sleep(500);

  const ids = (await getAll(db, "SELECT DISTINCT id FROM storms")).map(
    ({ id }) => id
  );

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

    if (lastUpdated[id] === latest.timestamp) {
      continue;
    }
    lastUpdated[id] = latest.timestamp;

    console.log(`Updating map for storm ${id}`);

    const metadata = {
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
      tracks: storm.map(({ latitude, longitude }) => [latitude, longitude]),
    };

    await page.evaluate((metadata) => {
      window.draw(metadata);
    }, metadata);
    await sleep(3000);

    const map = await page.$("#map");
    await map.screenshot({ path: `${docsPath}/${id}.png` });

    await page.reload();
    await sleep(500);
  }

  await browser.close();
  server.close();

  const final = (
    await getAll(db, "SELECT DISTINCT id FROM STORMS WHERE final=1")
  ).map(({ id }) => id);

  await Promise.all(
    final.map(async (id) => {
      try {
        await fs.rm(`${docsPath}/${id}.png`);
      } catch (e) {}
    })
  );

  await fs.writeFile(
    `${cachePath}/lastUpdated.json`,
    JSON.stringify(lastUpdated, null, 2),
    { encoding: "utf-8" }
  );
};
