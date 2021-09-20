import fs from "fs/promises";
import path from "path";
import getUrls from "./archive-urls.js";
import csv from "./csv.js";
import mapsForCurrentStorms from "./mapsForCurrentStorms.js";
import mapsForFinishedStorms from "./mapsForFinishedStorms.js";
import main from "./parse.js";
import sql from "./sqlite.js";
import { cachePath, docsPath, sleep } from "./util.js";
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

    // If this storm is now final, delete the current map. Otherwise, the map's
    // final form won't be rendered.
    if (data.final) {
      await fs.rm(path.join(docsPath, `${data.id}.png`), { force: true });
    }
  }
  visited.push(url);
  on += 1;
}

await fs.writeFile(
  `${cachePath}/visited.json`,
  JSON.stringify(visited, null, 2),
  {
    encoding: "utf-8",
  }
);

await mapsForFinishedStorms();
await mapsForCurrentStorms();
await web();
