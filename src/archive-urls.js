import fetch from "node-fetch";
import fs from "fs/promises";
import sqlite from "sqlite3";
import { cachePath, dataPath, sleep, sqlite as dbUtils } from "./util.js";

const baseUrl = "https://www.nhc.noaa.gov/archive/2021/";

const promise = fetch(baseUrl)
  .then((r) => r.text())
  .then(async (text) => {
    const visited = JSON.parse(
      await fs.readFile(`${cachePath}/visited.json`, { encoding: "utf-8" })
    );

    const db = new sqlite.Database(`${dataPath}/storms.2021.sqlite`);
    const final = (
      await dbUtils.getAll(db, "SELECT DISTINCT name FROM storms WHERE final=1")
    ).map(({ name }) => name.toLowerCase());

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
          .filter((u) => !/\.update\.\d+\./i.test(u))
      );

      await sleep(1500);
    }

    return advisoryUrls;
  });

export default async () => promise;
