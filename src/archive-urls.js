import fs from "fs/promises";
import { cachePath, sleep, year } from "./util.js";

const baseUrl = `https://www.nhc.noaa.gov/archive/${year}/`;

const promise = fetch(baseUrl)
  .then((r) => r.text())
  .then(async (text) => {
    const visited = JSON.parse(
      await fs.readFile(`${cachePath}/visited.json`, { encoding: "utf-8" })
    );

    const [, links] = text.match(
      /(<td valign="top" headers="al">([\s\S]*?)<\/td>)/im
    );

    const urls = (links.match(/<a href="([^"]+)"/gi) || [])
      .map((l) => l.match(/href="([^"]+)"/i)[1])
      .map((u) => `${baseUrl}${u}`);

    const advisoryUrls = [];

    for await (const url of urls) {
      if (advisoryUrls.length > 0) {
        await sleep(1500);
      }

      const text = await fetch(url).then((page) => page.text());

      advisoryUrls.push(
        ...text
          .match(/<td.+? headers="col2">([\s\S]*?)<\/td>/gim)
          .map((block) =>
            block
              .match(/<a href="([^"]+)"/gi)
              ?.map((a) => a.match(/<a href="([^"]+)"/i)[1])
          )
          .filter((v) => Array.isArray(v))
          .flat()
          .map((u) => `https://www.nhc.noaa.gov${u}`)
          .filter((u) => !visited.includes(u))
      );
    }

    return advisoryUrls;
  });

export default async () => promise;
