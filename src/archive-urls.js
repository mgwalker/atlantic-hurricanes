import fetch from "node-fetch";
import fs from "fs/promises";
import sqlite from "sqlite3";
import {
  cachePath,
  dataPath,
  exists,
  sleep,
  sqlite as dbUtils,
} from "./util.js";

const baseUrl = "https://www.nhc.noaa.gov/archive/2021/";

const getStormsThatAreFinal = async () => {
  // If the sqlite database doesn't exist, we can't really query it yet. So, in
  // that case, return an empty list because there aren't any known-final storms
  // not to scrape yet.
  if (await exists(`${dataPath}/storms.2021.sqlite`)) {
    const db = new sqlite.Database(`${dataPath}/storms.2021.sqlite`);
    return (
      await dbUtils.getAll(db, "SELECT DISTINCT name FROM storms WHERE final=1")
    ).map(({ name }) => name.toLowerCase());
  }
  return [];
};

const promise = fetch(baseUrl)
  .then((r) => r.text())
  .then(async (text) => {
    const visited = JSON.parse(
      await fs.readFile(`${cachePath}/visited.json`, { encoding: "utf-8" })
    );

    const final = await getStormsThatAreFinal();

    const [, links] = text.match(
      /(<td valign="top" headers="al">([\s\S]*?)<\/td>)/im
    );
    const urls = links
      .match(/<a href="([^"]+)"/gi)
      .map((l) => l.match(/href="([^"]+)"/i)[1])
      .map((u) => `${baseUrl}${u}`)
      .filter(
        (u) =>
          !final.includes(u.split("/").pop().split(".").shift().toLowerCase())
      );

    const advisoryUrls = [];

    for await (const url of urls) {
      if (advisoryUrls.length > 0) {
        await sleep(1500);
      }

      const page = await fetch(url);
      const text = await page.text();

      advisoryUrls.push(
        ...text
          .match(/<td.+? headers="col2">([\s\S]*?)<\/td>/gim)
          .map((block) =>
            block
              .match(/<a href="([^"]+)"/gi)
              ?.map((a) => a.match(/<a href="([^"]+)"/i)[1])
          )
          .filter((v) => Array.isArray(v))
          .reduce((all, v) => [...all, ...v], [])
          .map((u) => `https://www.nhc.noaa.gov${u}`)
          .filter((u) => !visited.includes(u))
      );
    }

    return advisoryUrls;
  });

export default async () => promise;
