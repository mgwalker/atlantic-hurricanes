import fs from "fs/promises";
import { dataPath, exists } from "./util.js";

export default async (data) => {
  const path = `${dataPath}/csv/${data.id}.csv`;

  const storm = { ...data };
  delete storm.position;
  delete storm.final;

  const lines = [];
  if (await exists(path)) {
    const text = await fs.readFile(path, { encoding: "utf-8" });
    lines.push(...text.split("\n"));
  } else {
    lines.push(
      Object.keys(storm)
        .map((v) => `"${v}"`)
        .join(",")
    );
  }

  const r = new RegExp(`${storm.id},${storm.timestamp},`);
  if (!lines.some((l) => r.test(l))) {
    lines.push(Object.values(storm).join(","));
    await fs.writeFile(path, lines.join("\n"), { encoding: "utf-8" });
  }
};
