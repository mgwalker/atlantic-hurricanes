import fs from "fs/promises";
import sqlite from "sqlite3";
import { dataPath, sqlite as dbUtils } from "./util.js";

const { get, run } = dbUtils;

const columnize = (name) => name.replace(/[^a-z]+/gi, "_").replace(/_$/, "");

const createIfNecessary = async (db, data) => {
  const columns = Object.keys(data)
    .map((k) => {
      const column = columnize(k);
      const type = typeof data[k];

      return `${column} ${type === "number" ? "REAL" : "TEXT"}`;
    })
    .join(",");

  const sql = `CREATE TABLE IF NOT EXISTS storms (${columns})`;
  await run(db, sql);
};

export default async (data) => {
  const path = `${dataPath}/storms.2021.sqlite`;

  const db = new sqlite.Database(path);
  await createIfNecessary(db, data);

  const { count } = await get(
    db,
    `SELECT COUNT(*) as count FROM storms WHERE id=? AND timestamp=?`,
    [data.id, data.timestamp]
  );

  if (count === 0) {
    const columns = Object.keys(data).map(columnize);
    const values = Object.values(data);

    const sql = `INSERT INTO storms (${columns.join(",")}) VALUES(${values
      .map(() => "?")
      .join(",")})`;

    await run(db, sql, values);
  }
};
