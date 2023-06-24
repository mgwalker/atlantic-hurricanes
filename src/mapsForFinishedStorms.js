import fs from "fs/promises";
import path from "path";
import { chromium } from "playwright";
import sqlite from "sqlite3";

import { pathToFileURL } from "url";

import {
  dataPath,
  docsPath,
  getStormCategory,
  srcPath,
  sleep,
  sqlite as dbUtils,
} from "./util.js";

const { getAll } = dbUtils;

export default async () => {
  const fileIds = await fs.readdir(docsPath);

  const db = new sqlite.Database(`${dataPath}/storms.2023.sqlite`);
  const stormIds = (
    await getAll(db, "SELECT DISTINCT id FROM storms WHERE final=1")
  )
    .map(({ id }) => id)
    .filter((id) => !fileIds.includes(`${id}.png`));

  const url = pathToFileURL(path.join(srcPath, "map.html")).href;

  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url);

  await sleep(500);

  for await (const id of stormIds) {
    const stormUpdates = await getAll(
      db,
      "SELECT * FROM storms WHERE id=?",
      id
    );

    // If this isn't the first storm, reload the page and then pause briefly
    // so it can finish loading.
    if (id !== stormIds[0]) {
      await page.reload();
      await sleep(500);
    }

    const storm = {
      id,
      name: stormUpdates.slice(-1)[0].name,
      tracks: stormUpdates.map(
        ({
          classification,
          hurricane_wind_extent_miles,
          minimum_central_pressure_mb,
          maximum_sustained_wind_mph,
          movement_direction_degrees,
          latitude,
          longitude,
          timestamp,
          tropical_storm_wind_extent_miles,
        }) => ({
          category: getStormCategory(maximum_sustained_wind_mph),
          direction: movement_direction_degrees,
          location: {
            lat: latitude,
            lon: longitude,
          },
          pressure: minimum_central_pressure_mb,
          timestamp,
          type: classification,
          wind: maximum_sustained_wind_mph,
          windExtent:
            classification.toLowerCase() === "hurricane"
              ? {
                  hurricane: hurricane_wind_extent_miles,
                  tropical: tropical_storm_wind_extent_miles,
                }
              : null,
        })
      ),
    };

    let extent = null;
    storm.tracks.forEach((track) => {
      if (
        track.type.toLowerCase() === "hurricane" &&
        !track.windExtent.hurricane
      ) {
        track.windExtent = extent;
      } else {
        extent = track.windExtent;
      }
    });

    await page.evaluate((storm) => {
      const points = storm.tracks.map(({ location: { lat, lon } }) => [
        lat,
        lon,
      ]);

      const box = L.latLngBounds(points);

      const map = L.map("map", { zoomControl: false });
      L.tileLayer(
        "https://api.mapbox.com/styles/v1/{id}/tiles/{z}/{x}/{y}?access_token={accessToken}",
        {
          attribution:
            "Map data &copy; OpenStreetMap contributors, Imagery &copy; Mapbox",
          maxZoom: 18,
          id: "mapbox/streets-v11",
          tileSize: 512,
          zoomOffset: -1,
          accessToken:
            "pk.eyJ1IjoibWd3YWxrZXIiLCJhIjoiY2tzdjYxcHI3MW11cDJva3R3YzRkYWUxYSJ9.sp1YDg1pBjrarmenwWpQDg",
        }
      ).addTo(map);

      map.fitBounds(box);

      L.polyline(points, { color: "red" }).addTo(map);

      storm.tracks.forEach(({ location: { lat, lon }, type }) => {
        L.circle([lat, lon], {
          color: "black",
          fillColor: "black",
          fillOpacity: 0.5,
          opacity: 0,
          radius: 7000,
        }).addTo(map);

        const trackType = type.toLowerCase();

        if (trackType === "hurricane" || trackType === "tropical storm") {
          L.marker([lat, lon], {
            icon: L.icon({
              iconUrl: icon[trackType],
              iconSize: [40, 40],
              iconAnchor: [18, 16],
            }),
          }).addTo(map);
        }
      });
    }, storm);

    await sleep(3000);

    const map = await page.$("#map");
    await map.screenshot({ path: `${docsPath}/${id}.png` });
  }

  await browser.close();
};
