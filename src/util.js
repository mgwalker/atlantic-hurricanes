import fs from "fs/promises";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

export const dataPath = join(
  dirname(fileURLToPath(import.meta.url)),
  "../data"
);

export const exists = async (path) => {
  try {
    await fs.access(path);
    return true;
  } catch (e) {
    return false;
  }
};

export const formatTime = (time, ampm) => {
  let formatted = time;
  if (ampm === "pm" && time.slice(0, 2) !== "12") {
    formatted = `${1200 + +time}`;
  } else if (ampm === "am" && time.slice(0, 2) === "12") {
    formatted = "0";
  }

  return formatted.padStart(4, "0");
};

export const headingFriendly = (deg) => {
  const dd = +deg;
  const range = 22.5;

  // prettier-ignore
  const headings = [
    "north", "north-northeast", "northeast",
    "east-northeast", "east", "east-southeast",
    "southeast", "south-southeast", "south",
    "south-southwest", "southwest", "west-southwest",
    "west", "west-northwest", "northwest", "north-northwest",
  ];

  let start = -11.25;
  for (let heading of headings) {
    if (dd >= start && dd < start + range) {
      return heading;
    }
    start += range;
  }
};

export const sleep = async (ms) =>
  new Promise((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });

export const ucwords = (text) =>
  text
    .split(" ")
    .map((w) => `${w.slice(0, 1).toUpperCase()}${w.slice(1).toLowerCase()}`)
    .join(" ");
