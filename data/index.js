let activeZone = null; // Global variable to store the active zone
let pointColor = "#87bef2";

// Set start time (6:00 AM today) and end time (6:00 AM tomorrow)
var startOfDay = new Date();
startOfDay.setHours(6, 0, 0, 0); // Set time to 6:00 AM today
var endOfDay = new Date(startOfDay.getTime() + 24 * 3599 * 1000); // 6:00 AM tomorrow
// Adjust for timezone offset (in milliseconds)
var timezoneOffset = startOfDay.getTimezoneOffset() * 60000; // Convert minutes to milliseconds
var localStartOfDay = startOfDay.getTime() - timezoneOffset;

// Set the end time (6:00 AM tomorrow in local time)
var endOfDay = new Date(localStartOfDay + 24 * 3600 * 1000); // 6:00 AM the following day

// Create Pressure Chart
var chartP = Highcharts.chart("chart-pressure", {
  chart: {
    height: 280, // Set the chart height in pixels
    zooming: {
      type: "x",
    },
    panning: true,
    panKey: "shift",
    scrollablePlotArea: {
      minWidth: 600,
    },
  },

  series: [
    {
      yAxis: 0, // This series uses the primary Y-axis
      name: "PSI",
      color: pointColor,//"#87bef2",
      lineColor: pointColor,//"#87bef2",
      marker: {
        enabled: true,
        symbol: "circle",
        radius: 3,
        fillColor: pointColor, //"#87bef2"
        //lineColor: "#87bef2"
      },
    },
    {
      yAxis: 1, // This series uses the secondary Y-axis
      name: "Zone",
      color: "#f28f43",
      marker: {
        enabled: true,
        symbol: "diamond",
        radius: 3,
        fillColor: "#f28f43",
      },
    },
  ],

  title: {
    text: "Today's Chart",
  },

  xAxis: {
    type: "datetime",
    dateTimeLabelFormats: { minute: "%H:%M" },
    min: localStartOfDay, // Start at 6:00 AM today
    max: endOfDay.getTime(),   // End at 6:00 AM tomorrow
    //minRange: 3 * 3600 * 1000, // 4 hours in milliseconds
    tickInterval: 3600 * 1000, // 1 hour intervals for ticks
  },

  yAxis: [
    {
      // Primary yAxis
      min: 0,
      max: 62,
      labels: {
        style: {
          color: "#87bef2",
        },
        formatter: function () {
          return Math.floor(this.value); // No decimal places
        },
      },
      title: {
        text: "PSI",
        style: {
          color: "#87bef2",
        },
      },
    },
    {
      // Secondary yAxis
      opposite: true, // Display the secondary Y-axis on the right side
      min: 0,
      max: 25,
      labels: {
        style: {
          color: "#f28f43",
          //color: Highcharts.getOptions().colors[1],
        },
        formatter: function () {
          return Math.floor(this.value); // No decimal places
        },
      },
      title: {
        text: "Zone",
        style: {
          color: "#f28f43",
          //color: Highcharts.getOptions().colors[1],
        },
      },
    },
  ],

  plotOptions: {
    line: {
      animation: false,
      dataLabels: {
        enabled: true,
        format: "{y:.0f}", // No decimal places
      },
    },
  },

  tooltip: {
    shared: true,
    crosshairs: true,
    valueDecimals: 0, // No decimal places in tooltip
    dateTimeLabelFormats: {
      minute: "%H:%M",
      hour: "%H:%M",
    },
  },

  credits: {
    enabled: false,
  },
});

////// Create a chart for historical data //////
var chartH = Highcharts.chart("chart-history-container", {
  chart: {
    height: 280, // Set the chart height in pixels
    zooming: {
      type: "x",
    },
  },
  title: {
    text: "Historical Chart",
  },
  xAxis: {
    type: "datetime",
    dateTimeLabelFormats: { minute: "%H:%M" },
    tickInterval: 3600 * 1000, // 1 hour intervals for ticks
  },
  yAxis: [
    {
      // Primary yAxis
      min: 0,
      max: 62,
      labels: {
        style: {
          color: Highcharts.getOptions().colors[0],
        },
        formatter: function () {
          return Math.floor(this.value); // No decimal places
        },
      },
      title: {
        text: "PSI",
        style: {
          color: Highcharts.getOptions().colors[0],
        },
      },
    },
    {
      // Secondary yAxis
      opposite: true, // Display the secondary Y-axis on the right side
      min: 0,
      max: 25,
      labels: {
        style: {
          color: "#f28f43",
          //color: Highcharts.getOptions().colors[1],
        },
        formatter: function () {
          return Math.floor(this.value); // No decimal places
        },
      },
      title: {
        text: "Zone",
        style: {
          color: "#f28f43",
          //color: Highcharts.getOptions().colors[1],
        },
      },
    },
  ],
  series: [
    {
      yAxis: 0, // This series uses the primary Y-axis
      name: "PSI",
      color: "#87bef2",
      marker: {
        enabled: true,
        symbol: "circle",
        radius: 3,
        fillColor: "#87bef2",
      },
    },
    {
      yAxis: 1, // This series uses the secondary Y-axis
      name: "Zone",
      color: "#f28f43",
      marker: {
        enabled: true,
        symbol: "diamond",
        radius: 3,
        fillColor: "#f28f43",
      },
    },
  ],
  plotOptions: {
    line: {
      animation: false,
      dataLabels: {
        enabled: true,
        format: "{y:.0f}", // No decimal places
      },
    },
  },
  tooltip: {
    shared: true,
    crosshairs: true,
    valueDecimals: 0, // No decimal places in tooltip
    dateTimeLabelFormats: {
      minute: "%H:%M",
      hour: "%H:%M",
    },
    valueSuffix: " PSI",
  },
  credits: {
    enabled: false,
  },
});

function setupRealTimeUpdates() {
  const source = new EventSource("/events");

  source.addEventListener("new-readings", function (event) {
    var myObj = JSON.parse(event.data);

    // Extract currentPressure from myObj
    const currentPressure = myObj["Current Pressure"];

    const activeZone = myObj["Active Zone"];

    plotPressure(currentPressure, activeZone.znumber, activeZone.avgpsi);
    // console.log("Current Pressure:", currentPressure);
    // console.log(`Zone Number: ${activeZone.znumber}`);
    // console.log(`Zone Name: ${activeZone.zname}`);
    // console.log(`Average PSI: ${activeZone.avgpsi}`);
    // console.log(`Controller: ${activeZone.controller}`);
    // console.log(`Days: ${activeZone.days}`);

    document.getElementById("zone-info").innerHTML = `
      Zone: ${activeZone.znumber}<br>
      Name: ${activeZone.zname}<br>
      Controller: ${activeZone.controller}<br>
      Days: ${activeZone.days}<br>
      Avg PSI: ${activeZone.avgpsi}<br>
      Start: ${activeZone.start},
      Run: ${activeZone.run}
    `;
  });

  source.addEventListener("error", function (error) {
    console.error("Error with event source:", error);
  });
}

// Plot the Pressure and Active Zone Number
function plotPressure(currentPressure, activeZoneNumber, activeZoneAvgPsi) {
  var now = new Date();
  // Create a new Date object without seconds (round down to the nearest minute)
  now.setSeconds(0, 0); // Set seconds and milliseconds to zero
  var localTime = now.getTime() - now.getTimezoneOffset() * 60000; // Adjust timezone

  console.log("chartP:", localTime, currentPressure, activeZoneNumber, activeZoneAvgPsi);

   // Calculate if the current pressure deviates by more than +/- 2.0 from avgpsi
  //if (Math.abs(currentPressure - activeZoneAvgPsi) > 2.0) {
  if ((activeZoneNumber != Number(0)) && (Math.abs(currentPressure - activeZoneAvgPsi) > 2.0)) {
    pointColor = '#FF0000';
  } else {
    pointColor = '#87bef2';  // Default color is blue
  }

  // Add new points to the chart with specific marker and line color for PSI
  chartP.series[0].addPoint({
    x: localTime,
    y: Number(currentPressure),
    color: pointColor,  // This color applies to the point
    marker: {
      enabled: true,
      symbol: "circle",
      radius: 3,  // Ensure the radius is always set
      fillColor: pointColor,  // Ensure the marker fill color is applied
    },
  }, false, false, false); // PSI
  
  chartP.series[1].addPoint({
    x: localTime, 
    y: Number(activeZoneNumber),
    color: "#f28f43",
    marker: {
      enabled: true,
      symbol: "diamond",
      radius: 3,
      fillColor: "#f28f43",
    },
  }, false, false, false); // Zone

  // Set the xAxis range to show the last 2 hours
  //var twoHoursAgo = localTime - 2 * 3600 * 1000; // Calculate timestamp 2 hours ago
  //chartP.xAxis[0].setExtremes(twoHoursAgo, localTime);

  chartP.redraw();
}

async function loadCurrentDayData() {
  // Display a loading message
  const loadingMessage = document.getElementById("loadingMessage");
  if (loadingMessage) {
    loadingMessage.textContent = "Loading data, please wait...";
    loadingMessage.style.display = "block"; // Show the message
  }

  try {
    // Fetch the current day's filename from the server
    const response = await fetch("/get-daily-filename");
    const dailyFileName = await response.text();

    // Fetch the current day's SD file data
    const dataResponse = await fetch(
      `/get-data-file?filename=${encodeURIComponent(dailyFileName)}`
    );
    if (!dataResponse.ok) {
      throw new Error(`HTTP error! Status: ${dataResponse.status}`);
    }

    const textData = await dataResponse.text();

    // Clear the series data to start fresh
    chartP.series[0].setData([], false); // Clear PSI series
    chartP.series[1].setData([], false); // Clear Zone series

    // Parse the fetched data and remove empty or whitespace-only lines
    const lines = textData.split("\n").filter((line) => line.trim() !== "");

    lines.forEach((line) => {
      const parts = line.split(",");
      if (parts.length >= 5) {
        // Ensure there are enough parts in each line
        const timestampUTC = Date.parse(parts[1] + "T" + parts[2] + "Z");
        const y1 = parseFloat(parts[3]);
        const z1 = parseInt(parts[4], 10); // activeZoneNumber is an integer
        const avgpsi = parseFloat(parts[5]); // average psi

        if ((z1 != 0) && (Math.abs(y1 - avgpsi) > 2.0)) {
        //if ((Math.abs(y1 - avgpsi) > 2.0)) {
          pointColor = '#FF0000';
        } else {
          pointColor = '#87bef2';  // Default color is blue
        }

        // Add points to the chart using addPoint
        //chartP.series[0].addPoint([timestampUTC, y1], false, false, false); // Add PSI point
        //chartP.series[1].addPoint([timestampUTC, z1], false, false, false); // Add Zone point
        // Add new points to the chart with specific marker and line color for PSI
        chartP.series[0].addPoint({
          x: timestampUTC,
          y: y1,
          color: pointColor,  // This color applies to the point
          marker: {
            enabled: true,
            symbol: "circle",
            radius: 3,  // Ensure the radius is always set
            fillColor: pointColor,  // Ensure the marker fill color is applied
          },
        }, false, false, false); // PSI
        
        chartP.series[1].addPoint({
          x: timestampUTC, 
          y: z1,
          color: "#f28f43",
          marker: {
            enabled: true,
            symbol: "diamond",
            radius: 3,
            fillColor: "#f28f43",
          },
        }, false, false, false); // Zone
      }
    });

    // Update the chart title with the filename
    chartP.setTitle({ text: `File: ${dailyFileName}` });
    chartP.update({
      title: {
        text: `File: ${dailyFileName}`,
      },
    });

    // Redraw the chart after all points are added
    chartP.redraw();
  } catch (error) {
    console.error("Error loading daily data:", error);
    alert("Failed to load the current day's data. Please try again.");
  } finally {
    // Hide the loading message after data is loaded or in case of an error
    if (loadingMessage) {
      loadingMessage.style.display = "none";
    }
  }
}

function loadHistoricalData(fileName) {
  // Display a loading message or spinner
  const loadingMessage = document.getElementById("loadingMessage");
  if (loadingMessage) {
    loadingMessage.textContent = "Loading historical data, please wait...";
    loadingMessage.style.display = "block"; // Show the message
  }

  fetch(`/get-data-file?filename=${encodeURIComponent(fileName)}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.text(); // Get the raw text of the response
    })
    .then((textData) => {
      try {
        // Log the received text data to check if it's being fetched properly
        //console.log("Received text data:", textData);

        // Parse the fetched data
        const lines = textData.split("\n");
        console.log("Number of lines:", lines.length);

        lines.forEach((line, index) => {
          // Trim the line to remove any leading/trailing whitespace or hidden characters
          const trimmedLine = line.trim();

          // Skip empty or invalid lines
          if (!trimmedLine || trimmedLine.length === 0) {
            //console.log(`Skipping empty line at index ${index}`);
            return; // Skip processing for this line
          }

          const parts = trimmedLine.split(",");

          // Log the parts and their length
          //console.log(`Parts length for line ${index + 1}:`, parts.length, parts);

          if (parts.length >= 5) {
            // Ensure there are enough parts in each line
            const timestampUTC = Date.parse(parts[1] + "T" + parts[2] + "Z");
            const y1 = parseFloat(parts[3]);
            const z1 = parseInt(parts[4], 10); // activeZoneNumber is an integer
            const avgpsi = parseFloat(parts[5]); // average psi

        if ((z1 != 0) && (Math.abs(y1 - avgpsi) > 2.0)) {
        //if ((Math.abs(y1 - avgpsi) > 2.0)) {
          pointColor = '#FF0000'; // red
        } else {
          pointColor = '#87bef2';  // Default color is blue
        }

        // Add points to the chart using addPoint
        // Add new points to the chart with specific marker and line color for PSI
        chartH.series[0].addPoint({
          x: timestampUTC,
          y: y1,
          color: pointColor,  // This color applies to the point
          marker: {
            enabled: true,
            symbol: "circle",
            radius: 3,  // Ensure the radius is always set
            fillColor: pointColor,  // Ensure the marker fill color is applied
          },
        }, false, false, false); // PSI
        
        chartH.series[1].addPoint({
          x: timestampUTC, 
          y: z1,
          color: "#f28f43",
          marker: {
            enabled: true,
            symbol: "diamond",
            radius: 3,
            fillColor: "#f28f43",
          },
        }, false, false, false); // Zone

            // Log the parsed data before adding to the chart
            //console.log(`Adding point: timestamp=${timestampUTC}, y1=${y1}, z1=${z1}`);

            // Add points to the chart using addPoint
            //chartH.series[0].addPoint([timestampUTC, y1], false, false); // Add PSI point
            //chartH.series[1].addPoint([timestampUTC, z1], false, false); // Add Zone point
          } else {
            console.log("Skipping line due to insufficient parts:", line);
          }
        });

        // Update the chart title and redraw the chart
        chartH.setTitle({ text: `Historical File: ${fileName}` });
        chartH.redraw(); // Force the chart to redraw after adding points
      } catch (error) {
        console.error("Error processing CSV data:", error);
        alert("Failed to load historical data. Please try again.");
      }
    })
    .then(() => {
      // Hide the loading message after data is loaded and chart is rendered
      if (loadingMessage) {
        loadingMessage.style.display = "none"; // Hide the message
      }
    })
    .catch((error) => {
      console.error("Error loading historical data:", error);
      alert("Failed to load historical data. Please try again.");

      // Hide the loading message in case of an error
      if (loadingMessage) {
        loadingMessage.style.display = "none";
      }
    });
}

// Function to populate a specific file selector dropdown
function populateFileSelector(selectorId, files) {
  const fileSelector = document.getElementById(selectorId);
  if (!fileSelector) {
    console.error(`Element with id "${selectorId}" not found.`);
    return;
  }

  fileSelector.options.length = 0; // Clear existing options
  //console.log("Files to populate selector:", files);

  // Optional: Sort files by date (assuming filenames follow the format
  // 'dDDMMYY.txt')
  files.sort();

  files.forEach((file) => {
    //console.log("Adding file to selector:", file);
    let option = document.createElement("option");
    option.value = file;

    // Optionally format the display text to show day range for better readability
    option.text = file;

    fileSelector.add(option);
  });
}

// Function to load Location data
function loadLocation() {
  fetch("/get-location")
    .then((response) => response.text())
    .then((data) => {
      // Assuming 'data' is the fetched location value
      const locationElement = document.getElementById("loc-input");
      locationElement.textContent = `Location: ${data}`;
      console.log("Loaded Location:", data);
    })
    .catch((error) => console.error("Error loading location:", error));
}

window.onload = function () {
  // wait for load
};

document.addEventListener("DOMContentLoaded", function () {
  ///// EventSource and listeners /////
  if (!!window.EventSource) {
    var source = new EventSource("/events");

    source.addEventListener(
      "open",
      function (e) {
        console.log("Events Connected");
      },
      false
    );

    source.addEventListener(
      "error",
      function (e) {
        if (e.target.readyState != EventSource.OPEN) {
          console.log("Events Disconnected");
        }
      },
      false
    );

    source.addEventListener(
      "message",
      function (e) {
        console.log("message", e.data);
      },
      false
    );

    if (window.EventSource) {
      const source = new EventSource("/events");

      source.addEventListener(
        "server-log",
        function (event) {
          const logMessage = event.data;
          console.log("Log from server:", logMessage);

          const newLog = document.createElement("li");
          newLog.textContent = logMessage;
        },
        false
      );
    }
  }

  const loadHistoryBtn = document.getElementById("loadHistoryBtn");
  const dateFileSelector = document.getElementById("dateFileSelector");

  // Initialize real-time updates
  setupRealTimeUpdates();
  loadLocation();

  // Event listener for the Refresh Chart button
  document
    .getElementById("refreshChartBtn")
    .addEventListener("click", function () {
      loadCurrentDayData();
    });

  fetch("/get-daily-filename")
    .then((response) => response.text())
    .then((dailyFileName) => {
      console.log("Loading: ", dailyFileName);
      fetch(`/get-data-file?filename=${encodeURIComponent(dailyFileName)}`)
        .then((response) => {
          if (response.ok) {
            console.log("File exists and is being loaded.");

            // Load the current day's data if the file exists
            loadCurrentDayData();
          } else {
            console.log("Current day's data file does not exist yet.");
            // No need to generate an error, just log the information
          }
        })
        .catch((error) => {
          console.error("Error checking current day's data file:", error);
        });
    })
    .catch((error) => {
      console.error("Error fetching daily filename:", error);
    });

  // Load historical data files into the selector if files exist
  fetch("/list-sd-card-files")
    .then((response) => {
      if (!response.ok) {
        console.log("No SD card files found or failed to fetch.");
        return null;
      }
      return response.json();
    })
    .then((files) => {
      if (files && files.length > 0) {
        console.log("Files received for historical data:", files);
        populateFileSelector("dateFileSelector", files);
      } else {
        console.log("No historical data files to populate.");
      }
    })
    .catch((error) => {
      console.error("Error fetching SD card files:", error);
    });

  // Event listener for the button to load historical data
  loadHistoryBtn.addEventListener("click", function () {
    const selectedFile = dateFileSelector.value;
    if (selectedFile) {
      console.log("Loading historical data for file:", selectedFile);
      loadHistoricalData(selectedFile); // Load and display historical data
    } else {
      alert("Please select a file to load.");
    }
  });
});
