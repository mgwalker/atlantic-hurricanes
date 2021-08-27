import fetch from "node-fetch";

import { months, tzOffsets } from "./constants.js";
import { formatTime, ucwords } from "./util.js";

export default async (url) => {
  const r = await fetch(url);
  const d = await r.text();

  const [, advisory] = d.match(/<pre>([\s\S]*)<\/pre>/im);

  const [, classification, , name] = advisory
    .match(
      /(hurricane|tropical depression|tropical storm|post(-|\s)?tropical cyclone|remnants of|potential tropical cyclone) (.+?)\b(intermediate|advisory)?/i
    )
    .map((t) => t?.trim());

  const [, unformattedTime, ampm, tz, month, day, year] = advisory
    .match(/(\d{3,4}) ([AP]M) (.{3}) .{3} (.{3}) (\d{1,2}) (\d{4})/)
    .map((t) => t.toLowerCase());

  const time = formatTime(unformattedTime, ampm);

  const timestamp = new Date(
    Date.parse(
      `${year}-${months[month]}-${day}T${time.slice(0, 2)}:${time.slice(2)}${
        tzOffsets[tz]
      }`
    )
  ).toISOString();

  const [, , , id] = advisory.match(
    /NWS (Weather Prediction|National Hurricane) Center (Miami FL|College Park MD)\s*(AL\d+)/i
  );

  const [, lat, ns, lon, ew] = advisory.match(
    /location\.+(\d{1,2}\.\d)(n|s) (\d{1,3}\.\d)(e|w)/i
  );

  const [, windMph] = advisory.match(/maximum sustained winds[\D]+(\d+) mph/i);
  const [, pressureMb] = advisory.match(/minimum central pressure\D+(\d+) mb/i);
  const [, directionDeg, speedMph] = advisory.match(
    /present movement\D+(\d+) degrees at (\d+) mph/i
  );

  return {
    id,
    timestamp,
    classification: ucwords(classification),
    name: ucwords(name),
    latitude: ns.toLowerCase() === "s" ? -+lat : +lat,
    longitude: ew.toLowerCase() === "w" ? -+lon : +lon,
    "maximum sustained wind (mph)": +windMph,
    "minimum central pressure (mb)": +pressureMb,
    "movement speed (mph)": +speedMph,
    "movement direction (degrees)": +directionDeg,
  };
};
