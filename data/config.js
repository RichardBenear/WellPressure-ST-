document.addEventListener("DOMContentLoaded", function () {
  const zoneTable = document.getElementById("zone-table-body");

  // Function to load sensor sample rate
  function loadSensorRate() {
    fetch("/get-sensor-rate")
      .then((response) => response.text())
      .then((data) => {
        document.getElementById("sensor-rate-input").value = data;
        console.log("Loaded Sensor Sample Rate:", data);
      })
      .catch((error) => console.error("Error loading Sensor Sample Rate:", error));
  }

  // Function to load Location data
  function loadLocation() {
    fetch("/get-location")
      .then((response) => response.text())
      .then((data) => {
        document.getElementById("loc-input").value = data;
        console.log("Loaded Location:", data);
      })
      .catch((error) => console.error("Error loading location:", error));
  }

  // Function to load Calibration offset data
  function loadCalibOffset() {
    fetch("/get-calib-offset")
      .then((response) => response.text())
      .then((data) => {
        const calibOffElement = document.getElementById("calib-offset");
        calibOffElement.textContent = `Calibration Offset: ${data}`;
        console.log("Loaded Calibration Offset:", data);
      })
      .catch((error) => console.error("Error loading calib offset:", error));
  }

  // Function to populate the zone table with the loaded JSON data
  function loadZoneTableData(data) {
    const zoneTable = document.getElementById("zone-table-body");
    zoneTable.innerHTML = ""; // Clear the existing rows in tbody

    data.forEach((zone) => {
      const row = zoneTable.insertRow(-1); // Insert row directly into tbody
      const znumber = row.insertCell(0);
      const zname = row.insertCell(1);
      const controller = row.insertCell(2);
      const days = row.insertCell(3);
      const avgpsi = row.insertCell(4);
      const start = row.insertCell(5);
      const run = row.insertCell(6);
      const addedit = row.insertCell(7);

      znumber.textContent = zone.znumber;
      zname.textContent = zone.zname;
      controller.textContent = zone.controller;
      days.textContent = zone.days;
      avgpsi.textContent = zone.avgpsi;
      start.textContent = zone.start;
      run.textContent = zone.run;
      addedit.innerHTML =
        '<a class="add" title="Add" data-toggle="tooltip"><i class="material-icons md-28">&#xE03B;</i></a>' +
        '<a class="edit" title="Edit" data-toggle="tooltip"><i class="material-icons md-28">&#xE254;</i></a>' +
        '<a class="delete" title="Delete" data-toggle="tooltip"><i class="material-icons md-28">&#xE872;</i></a>';
    });

    //console.log(`Loaded Zone Table from the selected JSON file:`, data);
    selectedRowToInput(); // Ensure row click to input works
  }

  function loadZoneTable(endpoint) {
    fetch(endpoint)
      .then((response) => {
        if (!response.ok) {
          // Handle non-200 responses
          return response.text().then((text) => {
            throw new Error(text);
          });
        }
        return response.json(); // Try parsing JSON
      })
      .then((data) => {
        zoneTable.innerHTML = ""; // Clear the existing rows in tbody

        data.forEach((zone) => {
          const row = zoneTable.insertRow(-1); // Insert row directly into tbody
          const znumber = row.insertCell(0);
          const zname = row.insertCell(1);
          const controller = row.insertCell(2);
          const days = row.insertCell(3);
          const avgpsi = row.insertCell(4);
          const start = row.insertCell(5);
          const run = row.insertCell(6);
          const addedit = row.insertCell(7);

          znumber.textContent = zone.znumber;
          zname.textContent = zone.zname;
          controller.textContent = zone.controller;
          days.textContent = zone.days;
          avgpsi.textContent = zone.avgpsi;
          start.textContent = zone.start;
          run.textContent = zone.run;
          addedit.innerHTML =
            '<a class="add" title="Add" data-toggle="tooltip"><i class="material-icons md-28">&#xE03B;</i></a>' +
            '<a class="edit" title="Edit" data-toggle="tooltip"><i class="material-icons md-28">&#xE254;</i></a>' +
            '<a class="delete" title="Delete" data-toggle="tooltip"><i class="material-icons md-28">&#xE872;</i></a>';
        });

        console.log(`Loaded Zone Table from ${endpoint}:`, data);
        selectedRowToInput(); // Ensure row click to input works
      })
      .catch((error) => {
        console.error(`Error loading zone table from ${endpoint}:`, error);
        alert(`Error loading zone table: ${error.message}`);
      });
  }

  // Submit Sensor Sample Rate data
  function submitSensorRate() {
    const sensorRateData = document.getElementById("sensor-rate-input").value;
    fetch("/sensor-rate-input", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: sensorRateData,
    })
      .then((response) => response.text())
      .then((result) => {
        console.log("Sensor Rate submitted:", result);
        alert("Sensor Rate submitted successfully!");
      })
      .catch((error) => console.error("Error submitting Sensor Rate:", error));
  }

  // Submit Location data
  function submitLocation() {
    const locData = document.getElementById("loc-input").value;
    fetch("/loc-input", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: locData,
    })
      .then((response) => response.text())
      .then((result) => {
        console.log("Location submitted:", result);
        alert("Location submitted successfully!");
      })
      .catch((error) => console.error("Error submitting location:", error));
  }

  // Submit Calibration data
  function submitCalibration() {
    const calibData = document.getElementById("calib-input").value;
    fetch("/calib-input", {
      method: "POST",
      headers: {
        "Content-Type": "text/plain",
      },
      body: calibData,
    })
      .then((response) => response.text())
      .then((result) => {
        console.log("Calibration submitted:", result);
        alert("Calibration submitted successfully!");

        //loadCalibOffset();
      })
      .catch((error) => console.error("Error submitting calibration:", error));
  }

  function submitZoneForm() {
    const rows = zoneTable.querySelectorAll("tbody tr");
    const data = [];

    rows.forEach((row) => {
      const znumberElement = row.querySelector('input[name="znumber[]"]');
      const znameElement = row.querySelector('input[name="zname[]"]');
      const controllerElement = row.querySelector('input[name="controller[]"]');
      const daysElement = row.querySelector('input[name="days[]"]');
      const avgpsiElement = row.querySelector('input[name="avgpsi[]"]');
      const startElement = row.querySelector('input[name="start[]"]');
      const runElement = row.querySelector('input[name="run[]"]');

      const znumber = znumberElement
        ? znumberElement.value
        : row.cells[0].innerText;
      const zname = znameElement ? znameElement.value : row.cells[1].innerText;
      const controller = controllerElement
        ? controllerElement.value
        : row.cells[2].innerText;
      const days = daysElement ? daysElement.value : row.cells[3].innerText;
      const avgpsi = avgpsiElement
        ? avgpsiElement.value
        : row.cells[4].innerText;
      const start = startElement ? startElement.value : row.cells[5].innerText;
      const run = runElement ? runElement.value : row.cells[6].innerText;

      console.log(`Processing row: znumber=${znumber}, zname=${zname}, controller=${controller}, 
            days=${days}, avgpsi=${avgpsi}, start=${start}, run=${run}`);

      if (znumber && zname && controller && days && avgpsi && start && run) {
        data.push({ znumber, zname, controller, days, avgpsi, start, run });
      }
    });

    console.log("Data being sent:", JSON.stringify(data));

    fetch("/submit-zone-form", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    })
      .then((response) => response.text())
      .then((data) => {
        console.log("Success:", data);
        alert("Data submitted successfully!");
      })
      .catch((error) => {
        console.error("Error:", error);
      });
  }

  function selectedRowToInput() {
    for (let i = 0; i < zoneTable.rows.length; i++) {
      zoneTable.rows[i].onclick = function () {
        const cells = this.cells;

        // Function to get the value from a cell, whether it contains an input or plain text
        function getCellValue(cell) {
          const inputElement = cell.querySelector('input[type="text"]');
          if (inputElement) {
            return inputElement.value;
          } else {
            return cell.textContent.trim();
          }
        }

        document.getElementById("znumber").value = getCellValue(cells[0]);
        document.getElementById("zname").value = getCellValue(cells[1]);
        document.getElementById("controller").value = getCellValue(cells[2]);
        document.getElementById("days").value = getCellValue(cells[3]);
        document.getElementById("avgpsi").value = getCellValue(cells[4]);
        document.getElementById("start").value = getCellValue(cells[5]);
        document.getElementById("run").value = getCellValue(cells[6]);
      };
    }
  }

  // Add row function
  function addRow() {
    const input = $(this).parents("tr").find('input[type="text"]');
    let empty = input.toArray().some((el) => !$(el).val());

    if (empty) {
      input.addClass("error").first().focus();
    } else {
      input.each(function () {
        // Add a unique class to the td element when switching to text mode
        $(this).parent("td").html($(this).val());
      });

      // Ensure all action buttons (add, edit, delete) are visible after adding the row
      $(this).parents("tr").find(".add, .edit, .delete").show();
      $(".add-new").removeAttr("disabled");
    }
  }

  $(".add-new").click(function () {
    $(this).attr("disabled", "disabled");
    const actions =
      '<a class="add" title="Add" data-toggle="tooltip"><i class="material-icons md-28">&#xE03B;</i></a>' +
      '<a class="edit" title="Edit" data-toggle="tooltip"><i class="material-icons md-28">&#xE254;</i></a>' +
      '<a class="delete" title="Delete" data-toggle="tooltip"><i class="material-icons md-28">&#xE872;</i></a>';
    const row = `<tr>
          <td class="znumber"><input type="text" class="znumber" name="znumber[]"></td>
          <td class="zname"><input type="text" class="zname" name="zname[]"></td>
          <td class="controller"><input type="text" class="controller" name="controller[]"></td>
          <td class="days"><input type="text" class="days" name="days[]"></td>
		      <td class="avgpsi"><input type="text" class="avgpsi" name="avgpsi[]"></td>
          <td class="start"><input type="text" class="start" name="start[]"></td>
          <td class="run"><input type="text" class="run" name="run[]"></td>
          <td class="icons">${actions}</td>
        </tr>`;
    zoneTable.insertAdjacentHTML("beforeend", row); // Add row directly to tbody
    $('[data-toggle="tooltip"]').tooltip();
    selectedRowToInput(); // Make sure the new row is clickable
  });

  $(document).on("click", ".add", addRow);

  $(document).on("click", ".delete", function () {
    $(this).parents("tr").remove();
    $(".add-new").removeAttr("disabled");
  });

  $(document).on("click", ".edit", function () {
    $(this)
      .parents("tr")
      .find("td:not(:last-child)") // Exclude the last cell (action buttons)
      .each(function () {
        const currentText = $(this).text().trim(); // Safely get the text value
        $(this).html(`<input type="text" value="${currentText}">`); // Add the input field with the current value
      });

    // Ensure all action buttons (add, edit, delete) are visible after adding the row
    $(this).parents("tr").find(".add, .edit, .delete").show();
    $(".add-new").removeAttr("disabled");
  });

  // Function to populate a specific file selector dropdown
  function populateFileSelector(selectorId, files) {
    const fileSelector = document.getElementById(selectorId);
    if (!fileSelector) {
      console.error(`Element with id "${selectorId}" not found.`);
      return;
    }

    fileSelector.options.length = 0; // Clear existing options
    console.log("Files to populate selector:", files); // Debugging line

    // Optional: Sort files by date (assuming filenames follow the format 'dDDMMYY.txt')
    files.sort();

    files.forEach((file) => {
      console.log("Adding file to selector:", file); // Debugging line
      let option = document.createElement("option");
      option.value = file;

      // Optionally format the display text to show week range for better readability
      option.text = file; // You can modify this to a more user-friendly format if needed

      fileSelector.add(option);
    });
  }

  // Display JSON Files in the dropdown
  function displayJsonFiles(files) {
    populateFileSelector("jsonFileSelector", files);
  }

  // Function to load a selected file from the dropdown
  function loadSelectedFile() {
    const fileSelector = document.getElementById("jsonFileSelector");
    if (!fileSelector) {
      console.error("File selector not found.");
      return;
    }

    const selectedFile = fileSelector.value; // Get selected file name from the dropdown
    if (selectedFile) {
      fetch(
        `/load-spiffs-zone-table?filename=${encodeURIComponent(selectedFile)}`
      )
        .then((response) => {
          if (!response.ok) {
            return response.text().then((text) => {
              throw new Error(text);
            });
          }
          return response.json(); // Parse JSON data from the response
        })
        .then((data) => {
          console.log("Loaded zone data from selected file:", data);

          // Populate the zone table directly with the fetched data
          loadZoneTableData(data); // Use a separate function to update the zone table
        })
        .catch((error) =>
          console.error("Error loading selected JSON file:", error)
        );
    } else {
      alert("Please select a file first.");
    }
  }

  // Fetch and display JSON files on load
  fetch("/list-json-files")
    .then((response) => response.json())
    .then((files) => {
      console.log("JSON Files received:", files); // Debugging output
      displayJsonFiles(files); // Display SPIFFS files
    })
    .catch((error) => {
      console.error("Error fetching JSON files:", error);
      alert("Failed to fetch JSON files. Please try again.");
    });

  // EventSource and listeners
  const loadZoneTableButton = document.getElementById("load-sd-zone-table");
  if (loadZoneTableButton) {
    loadZoneTableButton.addEventListener("click", function () {
      loadZoneTable("/load-sd-zone-table"); // Load the internal zone table
    });
  } else {
    console.error("Button with ID 'load-sd-zone-table' not found.");
  }

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

  // Event listener for loading the selected JSON file
  document.getElementById("load-spiffs-zone-table").addEventListener("click", loadSelectedFile);

  // Attach event listeners to buttons
  document.getElementById("zone-form-submit").addEventListener("click", submitZoneForm);
  document.getElementById("calib-submit").addEventListener("click", submitCalibration);
  document.getElementById("sensor-rate-submit").addEventListener("click", submitSensorRate);
  document.getElementById("loc-submit").addEventListener("click", submitLocation);

  // Call the functions to load the data when the page loads
  loadSensorRate();
  loadLocation();
  loadZoneTable("/load-sd-zone-table");
  loadCalibOffset();
});
