import sqlite from "sqlite3";
import { dataPath, sqlite as dbUtils, year } from "./util.js";

const { get, run } = dbUtils;

const columnize = (name) => name.replace(/[^a-z]+/gi, "_").replace(/_$/, "");

export const createIfNecessary = async (db, data) => {
  const columns = Object.keys(data)
    // specify the final column separately, so we can make enforce its range
    // and default
    .filter((k) => k !== "final")
    .map((k) => {
      const column = columnize(k);
      const type = typeof data[k];

      return `${column} ${type === "number" ? "REAL" : "TEXT"}`;
    });
  columns.push("final BOOLEAN NOT NULL CHECK (final IN (0,1)) DEFAULT 0");

  const sql = `CREATE TABLE IF NOT EXISTS storms (${columns.join(",")})`;
  await run(db, sql);
};

export default async (data) => {
  const storm = { ...data };
  delete storm.position;

  const path = `${dataPath}/storms.${year}.sqlite`;

  const db = new sqlite.Database(path);
  await createIfNecessary(db, storm);

  const { count } = await get(
    db,
    `SELECT COUNT(*) as count FROM storms WHERE id=? AND timestamp=?`,
    [storm.id, storm.timestamp]
  );

  if (count === 0) {
    const columns = Object.keys(storm).map(columnize);
    const values = Object.values(storm);

    const sql = `INSERT INTO storms (${columns.join(",")}) VALUES(${values
      .map(() => "?")
      .join(",")})`;

    await run(db, sql, values);
  }

  if (storm.final) {
    const sql = `UPDATE storms SET final=1 WHERE id=?`;
    await run(db, sql, [storm.id]);
  } else {
    const sql = `UPDATE storms SET final=0 WHERE id=?`;
    await run(db, sql, [storm.id]);
  }
};
