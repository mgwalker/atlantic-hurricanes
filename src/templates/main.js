const months = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const formatter = new Intl.DateTimeFormat([], {
  day: "numeric",
  hour: "numeric",
  minute: "numeric",
  month: "long",
  timeZoneName: "short",
  weekday: "long",
  year: "numeric",
});

Array.from(document.querySelectorAll("time[datetime]")).forEach((e) => {
  const d = new Date(Date.parse(e.innerText));
  e.innerText = formatter.format(d);
});

const createChart = (canvas, data, units) => {
  const values = data.map(({ value }) => value);
  const padding = Math.round((Math.max(...values) - Math.min(...values)) / 10);

  new Chart(canvas, {
    type: "line",
    data: {
      labels: data.map(({ timestamp }) => new Date(timestamp)),
      datasets: [
        {
          data: values,
          borderWidth: 3,
          lineTension: 0.3,
        },
      ],
    },

    options: {
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          callbacks: {
            label: function (context) {
              return ` ${context.raw} ${units}`;
            },
          },
        },
      },
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 4,
      scales: {
        x: {
          type: "timeseries",
          ticks: {
            callback: (label) => {
              const date = new Date(label);
              const hour24 = date.getHours();

              const hours = (() => {
                if (hour24 > 12) {
                  return hour24 - 12;
                }
                if (hour24 === 0) {
                  return 12;
                }
                return hour24;
              })();

              const ampm = hour24 > 11 ? "AM" : "PM";

              return `${
                months[date.getMonth()]
              } ${date.getDate()}, ${hours} ${ampm}`;
              return label;
            },
          },
        },
        y: {
          min: Math.max(
            0,
            Math.min(...data.map(({ value }) => value)) - padding
          ),
          max: Math.max(...data.map(({ value }) => value)) + padding,
          ticks: {
            callback: (label) => `${label} ${units}`,
          },
        },
      },
    },
  });
};

const createExtentChart = (canvas, tropical, hurricane, units) => {
  new Chart(canvas, {
    type: "bar",
    data: {
      labels: tropical.map(({ timestamp }) => new Date(timestamp)),
      datasets: [
        {
          label: "Hurricane-force winds",
          data: hurricane.map(({ value }) => value),
          borderWidth: 0,
          backgroundColor: "rgba(255,110,110,1)",
        },
        {
          label: "Tropical storm-force winds",
          data: tropical.map(
            ({ value }, i) => value - (hurricane[i].value ?? 0)
          ),
          borderWidth: 0,
          backgroundColor: "rgba(87,160,229,1)",
        },
      ],
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,
      aspectRatio: 4,
      barPercentage: 1,
      plugins: {
        tooltip: {
          callbacks: {
            label: function (context) {
              if (context.dataset.label.toLowerCase().startsWith("tropical")) {
                return ` ${
                  context.raw + +(hurricane[context.dataIndex].value ?? 0)
                } miles`;
              }
              return ` ${context.raw} miles`;
            },
          },
        },
      },
      scales: {
        x: {
          stacked: true,
          type: "timeseries",
          ticks: {
            callback: (label) => {
              const date = new Date(label);
              const hour24 = date.getHours();

              const hours = (() => {
                if (hour24 > 12) {
                  return hour24 - 12;
                }
                if (hour24 === 0) {
                  return 12;
                }
                return hour24;
              })();

              const ampm = hour24 > 11 ? "AM" : "PM";

              return `${
                months[date.getMonth()]
              } ${date.getDate()}, ${hours} ${ampm}`;
              return label;
            },
          },
        },
        y: {
          stacked: true,
          ticks: {
            callback: (label) => `${label} ${units}`,
          },
        },
      },
    },
  });
};
