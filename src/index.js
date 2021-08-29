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

for await (const url of urls) {
  console.log(url);
  const data = await main(url);
  await csv(data);
  await sql(data);
  visited.push(url);
  await sleep(1500);
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
