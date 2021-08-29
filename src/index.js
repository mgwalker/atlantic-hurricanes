import fs from "fs/promises";
import sqlite from "sqlite3";
import getUrls from "./archive-urls.js";
import csv from "./csv.js";
import map from "./map.js";
import main from "./parse.js";
import sql from "./sqlite.js";
import { cachePath, dataPath, sleep, sqlite as dbUtils } from "./util.js";
import web from "./web.js";

const urls = await getUrls();

const visited = JSON.parse(
  await fs.readFile(`${cachePath}/visited.json`, { encoding: "utf-8" })
);

let on = 1;
for await (const url of urls) {
  if (on > 1) {
    await sleep(1500);
  }

  if (process.env.CI !== "true") {
    process.stdout.clearLine();
    process.stdout.cursorTo(0);
    process.stdout.write(`[${on} of ${urls.length}]: ${url}`);
  } else {
    console.log(`[${on} of ${urls.length}]: ${url}`);
  }

  const data = await main(url);

  // data can be false, for advisories that don't update the storm location,
  // wind, or movement.
  if (data) {
    await csv(data);
    await sql(data);
  }
  visited.push(url);
  on += 1;
}

const db = new sqlite.Database(`${dataPath}/storms.2021.sqlite`);

const finalIds = (
  await dbUtils.getAll(db, "SELECT DISTINCT id FROM storms WHERE final=1")
).map(({ id }) => id);

await fs.writeFile(
  `${cachePath}/visited.json`,
  JSON.stringify(
    visited.filter((u) => !RegExp(`/(${finalIds.join("|")})\.`, "i").test(u)),
    null,
    2
  ),
  {
    encoding: "utf-8",
  }
);

await web();
await map();
