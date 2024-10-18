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

// Display SD Card Files
function displaySdCardFiles(files) {
  const sdCardFileList = document.getElementById("sdCardFileList");
  populateFileSelector("deleteSdFileSelector", files); // Populate the delete SD file selector
  populateFileSelector("sdFileSelector", files); // Populate the SD file selector for viewing contents
  sdCardFileList.textContent = files.join("\n"); // Display the list of SD card files
}

// Display SPIFFS Files
function displaySPIFFSFiles(files) {
  const spiffsFileList = document.getElementById("spiffsFileList");
  populateFileSelector("deleteSPIFFSFileSelector", files); // Populate the delete SPIFFS file selector
  spiffsFileList.textContent = files.join("\n"); // Display the list of SPIFFS files with formatted names
}

function showSdFileContents() {
  const SDfileSelector = document.getElementById("sdFileSelector");
  const fileContentsDiv = document.getElementById("sdFileContents");

  const selectedFile = SDfileSelector.value;
  if (selectedFile) {
    // Fetch the file contents directly
    fetch(`/get-data-file?filename=${encodeURIComponent(selectedFile)}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to fetch file contents");
        }
        return response.text();
      })
      .then((data) => {
        fileContentsDiv.textContent = data; // Display the file contents directly
      })
      .catch((error) => {
        console.error("Error fetching file contents:", error);
        alert("Failed to load file contents. Please try again.");
      });
  } else {
    alert("Please select a file.");
  }
}

document.addEventListener("DOMContentLoaded", function () {
  // Fetch and display SD card files on load
  fetch("/list-sd-card-files")
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok " + response.statusText);
      }
      return response.json();
    })
    .then((files) => {
      console.log("SD Card Files received:", files); // Debugging output
      displaySdCardFiles(files); // Display SD Card files
    })
    .catch((error) => {
      console.error("Error fetching SD card files:", error);
      alert("Failed to fetch SD card files. Please try again.");
    });

  // Fetch and display SPIFFS files on load
  fetch("/list-spiffs-files")
    .then((response) => response.json())
    .then((files) => {
      console.log("SPIFFS Files received:", files); // Debugging output
      displaySPIFFSFiles(files); // Display SPIFFS files
    })
    .catch((error) => {
      console.error("Error fetching SPIFFS files:", error);
      alert("Failed to fetch SPIFFS files. Please try again.");
    });

  // Event listener for the Show File Contents button
  const showSdFileContentsBtn = document.getElementById(
    "showSdFileContentsBtn"
  );
  showSdFileContentsBtn.addEventListener("click", showSdFileContents);

  // Handle SPIFFS file deletion
  document
    .getElementById("deleteSPIFFSFileBtn")
    .addEventListener("click", function () {
      const deleteSelectedFile = document.getElementById(
        "deleteSPIFFSFileSelector"
      ).value;
      if (deleteSelectedFile) {
        fetch(`/delete-file?filename=${encodeURIComponent(deleteSelectedFile)}`)
          .then((response) => response.text())
          .then((data) => {
            alert(data);
            // Refresh SPIFFS files after deletion
            fetch("/list-spiffs-files")
              .then((response) => response.json())
              .then((files) => {
                displaySPIFFSFiles(files);
              });
          })
          .catch((error) => {
            console.error("Error deleting SPIFFS file:", error);
            alert("Failed to delete SPIFFS file. Please try again.");
          });
      } else {
        alert("Please select a file to delete.");
      }
    });

  // Handle SD file deletion
  document
    .getElementById("deleteSdFileBtn")
    .addEventListener("click", function () {
      const deleteSelectedFile = document.getElementById(
        "deleteSdFileSelector"
      ).value;
      if (deleteSelectedFile) {
        fetch(`/delete-file?filename=${encodeURIComponent(deleteSelectedFile)}`)
          .then((response) => response.text())
          .then((data) => {
            alert(data);
            // Refresh SD Card files after deletion
            fetch("/list-sd-card-files")
              .then((response) => response.json())
              .then((files) => {
                displaySdCardFiles(files);
              });
          })
          .catch((error) => {
            console.error("Error deleting SD file:", error);
            alert("Failed to delete SD file. Please try again.");
          });
      } else {
        alert("Please select a file to delete.");
      }
    });

  // Handle ESP32 reset
  document.getElementById("resetBtn").addEventListener("click", function () {
    if (confirm("Are you sure you want to reset the ESP32?")) {
      fetch("/reset")
        .then((response) => response.text())
        .then((data) => {
          alert(data); // This will show "Resetting ESP32..." message
        })
        .catch((error) => {
          console.error("Error resetting ESP32:", error);
          alert("Failed to reset the ESP32. Please try again.");
        });
    }
  });
});

///// EventSource and listeners /////
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
