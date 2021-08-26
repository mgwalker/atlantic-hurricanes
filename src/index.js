import urls from "./archive-urls.js";
import csv from "./csv.js";
import main from "./parse.js";
import { sleep } from "./util.js";

for await (const url of urls) {
  console.log(url);
  const data = await main(url);
  await csv(data);
  await sleep(1500);
}
