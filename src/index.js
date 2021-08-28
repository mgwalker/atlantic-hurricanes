import fs from "fs/promises";
import getUrls from "./archive-urls.js";
import csv from "./csv.js";
import map from "./map.js";
import main from "./parse.js";
import sqlite from "./sqlite.js";
import { cachePath, sleep } from "./util.js";
import web from "./web.js";

const urls = await getUrls();

const visited = JSON.parse(
  await fs.readFile(`${cachePath}/visited.json`, { encoding: "utf-8" })
);

for await (const url of urls) {
  console.log(url);
  const data = await main(url);
  await csv(data);
  await sqlite(data);
  visited.push(url);
  await sleep(1500);
}

await fs.writeFile(
  `${cachePath}/visited.json`,
  JSON.stringify(visited, null, 2),
  {
    encoding: "utf-8",
  }
);

await web();
await map();
