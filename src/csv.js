import fs from "fs/promises";
import { dataPath, exists } from "./util.js";

export default async (data) => {
  const path = `${dataPath}/csv/${data.id}.csv`;

  const lines = [];
  if (await exists(path)) {
    const text = await fs.readFile(path, { encoding: "utf-8" });
    lines.push(...text.split("\n"));
  } else {
    lines.push(
      Object.keys(data)
        .map((v) => `"${v}"`)
        .join(",")
    );
  }

  const r = new RegExp(`${data.id},${data.timestamp},`);
  if (!lines.some((l) => r.test(l))) {
    lines.push(Object.values(data).join(","));
    await fs.writeFile(path, lines.join("\n"), { encoding: "utf-8" });
  }
};
