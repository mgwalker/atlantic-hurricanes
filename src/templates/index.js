import Handlebars from "handlebars";
import fs from "node:fs/promises";
import path from "node:path";

const registeredTemplates = {
  index: "index.html.handlebars",
  activeStorm: "active-storm.html.handlebars",
  finishedStorm: "finished-storm.html.handlebars",
  stormData: "storm-data.json.handlebars",
  timeSeriesCharts: "timeseries-charts.html.handlebars",
  mainJs: "main.js",
};

const templatePromise = Promise.all(
  Object.entries(registeredTemplates).map(async ([name, filename]) => {
    const template = await fs.readFile(
      path.join(import.meta.dirname, filename),
      {
        encoding: "utf-8",
      }
    );
    return [name, template];
  })
)
  .then((all) =>
    all.map(([name, template]) => {
      Handlebars.registerPartial(name, template);
      return [name, Handlebars.compile(template)];
    })
  )
  .then((all) =>
    all.reduce((obj, [name, template]) => ({ ...obj, [name]: template }), {})
  );

Handlebars.registerHelper("json", function (context) {
  return JSON.stringify(this.series);
});

const render = async (context) => {
  const templates = await templatePromise;
  return templates.index(context);
};

export default render;
