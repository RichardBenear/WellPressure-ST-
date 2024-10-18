/***************
	** Wireless Well Pressure Monitor **
	This App uses an ESP32C3, a water pressure sensor, and small 1.3" OLED display for the hardware.
	Water pressure from a well is wirelessly transmitted to a local internet adresss where it is
	displayed in Chart form. The data for each day is stored in a micro SD card. The history for
	these days can be shown in another Chart. There is zoom and pan capability. Highcharts.com 
	provides the Javascript library for the charts graphics and rendering. 

	There is a Configuration page where the Name of the the Location can be set. Also, there
	is a Zone Table that can be created, edited, and then saved in a micro SD card in the ESP32C3.
	Zone Tables can also be created as text JSON files and compiled into SPIFFS along with
	the rest of the code. From the Config Page, the JSON zone table can then be loaded then 
	saved in SD where it is used to detect and display which zone is running and flagging
	any deviations from the Average PSI. Deviations from average should indicate if there 
	are broken or leaking irrigation components and is shown in Red in the charts.
	
	Each day starts at 6:00 A.M. till 5:59 A.M (24 hours) the next day. Each days data is stored
	in the Micro SD card.

	On the Config page, the pressure sample rate can be changed from the default 30 sec. Also, 
	the pressure sensor can be calibrated to the actual pressure if there is a gauge that
	shows a deviation between them.

	There is a Files page that provides a way to inspect all the SD and SPIFFS files and
	to delete them if desired. You can also remotely reset the ESP32C3 processor here.

	ElegantOTA is used to wirelessly update the code.

	A 3D printed case is used to house the electronics.

	Author: Richard Benear 9/22/23
****************
MIT License

Copyright (c) 2024 Richard Benear

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*********/

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <Arduino.h>
#include <Arduino_JSON.h>
#include <ESPAsyncWebServer.h>
#include <ElegantOTA.h>
#include <NTPClient.h>
#include <SPI.h>
#include <WiFi.h>
#include <WiFiUdp.h>
#include <Wire.h>
#include <time.h>
#include <cmath>	// For fabs()
#include <vector>
#include "FS.h"
#include "OledDisplay.h"
#include "SD.h"
#include "SPIFFS.h"

#define SD_CS 5					// Define CS pin for the SD card module
#define ADC_SAMPLES 10			// number of sensor ADC samples to average
#define SAMPLE_RATE 30000		// PSI sample rate 30 sec in msec
#define ZONES_ALL_OFF_PSI 59	// All Zones off if above this value
#define SENSOR_PIN 36	 		// Water Pressure sensor on pin GPIO36, ADC0, pin 3
#define TIME_ZONE -3600 * 6		// Mountain Time
#define BUFFER_SIZE 256			// Buffer size for streaming file contents to client in chunks

// Since this pressure sensor is designed to run on 5.0 volts but is running
// on 3.3v here, then scale: Pressure Sensor specification:
//    Output 4.5v = 100 PSI
//    Output 0.5v = 0 PSI
//    Slope = 4.0 volts/100 PSI = 0.04 volts/PSI
// Pressure Sensor Scaled:
//    Scaled PSI Range = (3.3v-0.5v)/(5.0v-0.5v) * 100 = 62.2 PSI full range
//    Slope = delta x / delta y: 3.3-0.5-0.5/62.2 = .037 volts/PSI
#define NOMINAL_VOLTS_PER_PSI 0.037
// nominal slope in volts/PSI, based on one point calibration at 48 psi
// measured from analog gauge

// Create AsyncWebServer object on port 80
AsyncWebServer server(80);

// Create an Event Source on /events
AsyncEventSource events("/events");

// Timer variables
unsigned long lastTime = 0;
unsigned long timerDelay = SAMPLE_RATE;

// ============ constants ================
// Replace with your network credentials
const char* ssid = "REPLACE_WITH_YOUR_SSID";
const char* password = "REPLACE_WITH_YOUR_PASSWORD";

const float sensorMinPressure = 0.8;
const float sensorMaxPressure = 63.0;

// 4.5/5.0 = .9 * 0.5 = 0.45
const float sensorMinVoltage = 0.8;
// 4.5/5.0 = .9 * 3.3 = 2.97
const float sensorMaxVoltage = 3.1;	 // this value was experimentally determined
																		 // to match actual pressure (calibrated)
// delta V = 2.97 - .45 = 2.52
// delta P = 2.97-0.45/4.5-0.5 * 100 = 63

// variables
float slope = NOMINAL_VOLTS_PER_PSI;
float currentPressure = 0.0;
float prevCalib = 0.0;
float calibOffset = 0.0;
float calibFloat = 0.0;
int sensorRateSec = 30; 

int lastActiveZoneIndex = 0;	// To track the last active zone
int zoneStartHour = 0;
int zoneStartMinute = 0;
int runTime = 0;
bool connected = false;

bool sdCardLock = false;

uint8_t activeZoneNumber = 0;	 // 0 = all off
uint32_t adcReading = 0;

// Define NTP Client to get time
WiFiUDP ntpUDP;
NTPClient timeClient(ntpUDP, "pool.ntp.org", TIME_ZONE, 60000);	 // Synchronize time every minute

// Variables to save date and time
String formattedDate = "";
String currentDayStamp = "";
String currentTimeStamp = "";
String currentDailyFilename = "";

IPAddress IPmessage;
size_t fileSize = 0;

// Save reading number on RTC memory
RTC_DATA_ATTR int readingID = 0;

/***********************************************/
// Function to send log messages to the client
void logMsg(const char *logMessage) {
	// Print to Serial Monitor
	Serial.println(logMessage);

	// Send the log message to all connected clients via SSE
	events.send(logMessage, "server-log", millis());
}

// Map floating point numbers
// mapFLoat is from https://github.com/radishlogic/MapFloat
float mapFloat(float value, float fromLow, float fromHigh, float toLow, float toHigh) {
	return (value - fromLow) * (toHigh - toLow) / (fromHigh - fromLow) + toLow;
}

void getTimeStamp(String &day, String &time) {
	timeClient.update();

	// Get the epoch time adjusted for the timezone offset
	unsigned long epochTime = timeClient.getEpochTime();

	// Convert epoch time to local time
	struct tm *ptm = gmtime((time_t *)&epochTime);

	// Extract date and time components
	char dateBuffer[11];
	char timeBuffer[9];
	strftime(dateBuffer, sizeof(dateBuffer), "%Y-%m-%d", ptm);
	strftime(timeBuffer, sizeof(timeBuffer), "%H:%M:%S", ptm);

	day = String(dateBuffer);
	time = String(timeBuffer);

	// Serial.println("DayStamp: " + day);
	// Serial.println("TimeStamp: " + time);
}

String loadZoneTable(fs::FS &fs, const char *filePath) {
	File file = fs.open(filePath, FILE_READ);
	if (!file) {
		Serial.printf("Failed to open zone data file %s for reading\n", filePath);
		return "[]";	// Return empty JSON array if the file doesn't exist
	}

	fileSize = file.size();
	String zoneData = "";
	zoneData = file.readString();  // Using readString() to get the entire file content
	file.close();

	// Debugging: Check if the zoneData is correctly loaded
	Serial.println("Loaded Zone Data: " + zoneData);

	return zoneData;
}

int calculateDayOfWeek(int year, int month, int day) {
	// Adjust months for Zeller's Congruence (March = 3, ..., December = 12, January = 13, February = 14)
	if (month < 3) {
		month += 12;
		year -= 1;
	}

	int k = year % 100;	 // The year within the century
	int j = year / 100;	 // The zero-based century

	// Zeller's formula to calculate the day of the week
	int dayOfWeek = (day + ((13 * (month + 1)) / 5) + k + (k / 4) + (j / 4) + (5 * j)) % 7;

	// Zeller's Congruence gives 0 = Saturday, adjust to match 0 = Sunday
	dayOfWeek = (dayOfWeek + 6) % 7;

	return dayOfWeek;
}

bool isDayMatching(String days, int currentDay) {
	// Convert currentDay to a string
	String currentDayStr = String(currentDay);
	// logMsg(("Checking days: " + days).c_str());
	// logMsg(("Current day: " + currentDayStr).c_str());

	// Iterate through each character in the days string
	for (int i = 0; i < days.length(); i++) {
		// logMsg(("Checking against day: " + String(days.charAt(i))).c_str());
		//   If any character in the days string matches the current day, return true
		if (days.charAt(i) == currentDayStr.charAt(0)) {
			// logMsg("Matched day");
			return true;
		}
	}
	// If no match was found, return false
	// logMsg("No day matched");
	return false;
}

bool programRunning = false;
String checkActiveZone() {
	// Extract the date part from currentTimeStamp (assumed format: "HH:MM:SS")
	// CurrentDayStamp: "YYYY-MM-DD"
	// Not using Seconds
	int year = currentDayStamp.substring(0, 4).toInt();
	int month = currentDayStamp.substring(5, 7).toInt();
	int day = currentDayStamp.substring(8, 10).toInt();
	int currentHourInt = currentTimeStamp.substring(0, 2).toInt();
	int currentMinuteInt = currentTimeStamp.substring(3, 5).toInt();
	// logMsg(("Current Year: " + String(year)).c_str());
	// logMsg(("Current Month: " + String(month)).c_str());
	// logMsg(("Current Day: " + String(day)).c_str());
	// logMsg(("Current Hour: " + String(currentHourInt)).c_str());
	// logMsg(("Current Minute: " + String(currentMinuteInt)).c_str());

	// Calculate the day of the week based on the date (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
	int currentDay = calculateDayOfWeek(year, month, day);

	// Load zone data from the file system
	String zoneData = loadZoneTable(SD, "/zone_data.json");

	// Parse the JSON data
	JSONVar zones = JSON.parse(zoneData);
	if (JSON.typeof(zones) == "undefined") {
		logMsg("Failed to parse JSON");
		return "{}";	// Return empty JSON if parsing fails
	}

	// Check if there are zones available
	if (zones.length() == 0) {
		logMsg("No zones available");
		return "{}";	// Return empty JSON if no zones are available
	}

	JSONVar activeZone;

	if (programRunning) {
		// If zone has no specific start time and is already selected, consider the runtime
		logMsg(("Cur Min: " + String(currentMinuteInt)).c_str());
		logMsg(("Cur Hour: " + String(currentHourInt)).c_str());
		logMsg(("St Min: " + String(zoneStartMinute)).c_str());
		logMsg(("St Hour: " + String(zoneStartHour)).c_str());
		int elapsedMinutes = (currentHourInt * 60 + currentMinuteInt) - (zoneStartHour * 60 + zoneStartMinute);
		logMsg(("Elapsed Minutes: " + String(elapsedMinutes)).c_str());

		// If the current zone has finished running
		if (elapsedMinutes >= runTime) {
			// Move to the next zone
			lastActiveZoneIndex += 1;

			// Check if the next zone exists
			if (lastActiveZoneIndex >= zones.length()) {
				logMsg("No more zones, resetting to zone 0");
				lastActiveZoneIndex = 0;
				programRunning = false;
				return JSON.stringify(zones[0]);
			}

			// Load the next zone
			String startTime = String((const char *)zones[lastActiveZoneIndex]["start"]);
			int runMinutes = String((const char *)zones[lastActiveZoneIndex]["run"]).toInt();

			// If the next zone has an empty start time ("") and programRunning is true, start it immediately
			if (startTime == "00:00" && programRunning) {
				logMsg("Next zone has no start time, starting immediately");
				activeZone = zones[lastActiveZoneIndex];
				programRunning = true;
				runTime = runMinutes;
				zoneStartHour = currentHourInt;	 // Set current time as the start time
				zoneStartMinute = currentMinuteInt;
			} else if (startTime != "00:00") {
				// If the next zone has a valid start time, check if it matches
				zoneStartHour = startTime.substring(0, 2).toInt();
				zoneStartMinute = startTime.substring(3, 5).toInt();

				if (currentHourInt == zoneStartHour && currentMinuteInt == zoneStartMinute) {
					logMsg("Next zone start time matches, starting");
					activeZone = zones[lastActiveZoneIndex];
					programRunning = true;
					runTime = runMinutes;
				} else {
					// If the start time does not match, end the program and return to zone 0
					logMsg("Next zone start time does not match, returning to zone 0");
					lastActiveZoneIndex = 0;
					programRunning = false;
					return JSON.stringify(zones[0]);
				}
			}
		}
	} else {
		// Iterate through zones to find a match
		for (int i = lastActiveZoneIndex; i < zones.length(); i++) {
			String znumber = String((const char *)zones[i]["znumber"]);
			String zname = String((const char *)zones[i]["zname"]);
			String controller = String((const char *)zones[i]["controller"]);
			String days = String((const char *)zones[i]["days"]);
			String startTime = String((const char *)zones[i]["start"]);
			int runMinutes = String((const char *)zones[i]["run"]).toInt();

			// Check if the current day is in the zone's days
			if (isDayMatching(days, currentDay)) {
				//logMsg("Day Matches");
				// Check if the start time matches if it's provided
				if (startTime != "00:00") {
					// If start time is provided, check if it matches the current time
					zoneStartHour = startTime.substring(0, 2).toInt();
					zoneStartMinute = startTime.substring(3, 5).toInt();

					if (currentHourInt == zoneStartHour && currentMinuteInt == zoneStartMinute) {
						logMsg("Matched start time, starting zone");
						activeZone = zones[i];
						lastActiveZoneIndex = i;
						programRunning = true;
						runTime = runMinutes;
						break;
					}
				}
			}
		}
	}

	// If no zone matches, reset to zone 0
	if (!programRunning) {
		logMsg("No zone matched, returning to zone 0");
		lastActiveZoneIndex = 0;
		return JSON.stringify(zones[0]);
	}

	// Return the active zone
	return JSON.stringify(activeZone);
}

void notFound(AsyncWebServerRequest *request) {
	request->send(404, "text/plain", "Not found");
}

// Initialize WiFi
void initWiFi() {
	WiFi.mode(WIFI_STA);
	WiFi.begin(ssid, password);
	Serial.print("Connecting to WiFi ..");
	unsigned long startAttemptTime = millis();

	while (WiFi.status() != WL_CONNECTED &&
				 millis() - startAttemptTime < 10000) {	 // 10 seconds timeout
		Serial.print('.');
		delay(500);
	}

	if (WiFi.status() == WL_CONNECTED) {
		Serial.println("NOW Connected to WiFi");
		connected = true;
	} else {
		Serial.println("Failed to connect to WiFi");
		connected = false;
	}
}

// Function to read the stored calibration offset value from SD
String loadCalibOffset() {
	File file = SD.open("/caliboffset.txt", FILE_READ);
	if (!file) {
		Serial.println("Failed to open calibration file for reading");
		return "";
	}

	fileSize = file.size();
	String calibOffsetValue = file.readStringUntil('\n');
	file.close();
	return calibOffsetValue;
}

// Function to store the calibration offset value in SD
bool saveCalibOffset(float calibOffsetValue) {
	File file = SD.open("/caliboffset.txt", FILE_WRITE);
	if (!file) {
		logMsg("Failed to open calibration file for writing");
		Serial.println("Failed to open calibration file for writing");
		return false;
	}

	file.printf("%.1f", calibOffsetValue);	// Save the value with up to 1 decimal places
	file.close();
	logMsg("Calibration value saved");
	Serial.println("Calibration value saved: " + String(calibOffsetValue));
	return true;
}

void handleSetCalibration(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
	String body = "";
	for (size_t i = 0; i < len; i++) {
		body += (char)data[i];
	}

	// Validate the conversion
	if (body.toFloat() == 0.0) {
		// Don't set calibFloat if value is 0.0
		calibOffset = 0.0;	// reset calibOffset
		request->send(200, "text/plain", "0.0");
		saveCalibOffset(calibOffset);
	} else {
		calibFloat = body.toFloat();

		// Update calibration offset if necessary
		if (prevCalib != calibFloat) {
			calibOffset = currentPressure - calibFloat;
			prevCalib = calibFloat;
		}

		String currentPressureStr = JSON.stringify(currentPressure - calibOffset);

		request->send(200, "text/plain", currentPressureStr);	 // send back adjusted pressure
		saveCalibOffset(calibOffset);
	}
}

// Function to read the stored location from SD
String loadLocation() {
	File file = SD.open("/location.txt", FILE_READ);
	if (!file) {
		Serial.println("Failed to open location file for reading");
		return "";
	}

	fileSize = file.size();
	String locationValue = file.readStringUntil('\n');
	file.close();
	return locationValue;
}

// Function to store the Location in SD
bool saveLocation(String locationValue) {
	File file = SD.open("/location.txt", FILE_WRITE);
	if (!file) {
		logMsg("Failed to open location file for writing");
		Serial.println("Failed to open location file for writing");
		return false;
	}

	file.printf("%s", locationValue);
	file.close();
	logMsg("Location value saved");
	Serial.println("Location value saved: " + String(locationValue));
	return true;
}

// Function to handle the POST request for setting the location
void handleSetLocation(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
	String body = "";
	for (size_t i = 0; i < len; i++) {
		body += (char)data[i];
	}

	if (saveLocation(body)) {
		request->send(200, "text/plain", body);
	} else {
		request->send(500, "text/plain", "Failed to save location value");
	}
}

// Function to read the stored Sensor Sample Rate from SD
String loadSensorRate() {
	File file = SD.open("/sensor_rate.txt", FILE_READ);
	if (!file) {
		Serial.println("Failed to open Senssor Rate file for reading");
		return "";
	}

	fileSize = file.size();
	String sensorRateValue = file.readStringUntil('\n');
	file.close();
	return sensorRateValue;
}

// Function to store the Sensor Sample Rate in SD
bool saveSensorRate(String sensorRateValue) {
	File file = SD.open("/sensor_rate.txt", FILE_WRITE);
	if (!file) {
		logMsg("Failed to open location file for writing");
		Serial.println("Failed to open sensor rate file for writing");
		return false;
	}

	file.printf("%s", sensorRateValue);
	file.close();
	logMsg("Sensor rate value saved");
	Serial.println("Sensor rate value saved: " + String(sensorRateValue));
	return true;
}

// Function to handle the POST request for setting the location
void handleSetSensorRate(AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
	String body = "";
	for (size_t i = 0; i < len; i++) {
		body += (char)data[i];
	}

	sensorRateSec = (unsigned long)body.toInt();

	if (saveSensorRate(body)) {
		request->send(200, "text/plain", body);
	} else {
		request->send(500, "text/plain", "Failed to save sensor rate");
	}
	timerDelay = sensorRateSec * 1000; // convert to msec
}

String generateDailyFilename() {
	getTimeStamp(currentDayStamp, currentTimeStamp);

	// Get the current epoch time
	unsigned long epochTime = timeClient.getEpochTime();

	// Extract the hour from the time string
	int currentHour = currentTimeStamp.substring(0, 2).toInt();

	// Extract the day, month, and year from the date string
	int year = currentDayStamp.substring(2, 4).toInt();	 // last two digits of the year
	int month = currentDayStamp.substring(5, 7).toInt();
	int dayOfMonth = currentDayStamp.substring(8, 10).toInt();

	// If the time is before 6:00 AM, use the previous day's date for the filename
	if (currentHour < 6) {
		time_t previousDayEpoch = epochTime - 86400;	// subtract one day (86400 seconds)
		struct tm *ptm = gmtime(&previousDayEpoch);

		year = ptm->tm_year % 100;
		month = ptm->tm_mon + 1;
		dayOfMonth = ptm->tm_mday;
	}

	// Format the filename as DDMMYY.txt
	char filename[12];
	snprintf(filename, sizeof(filename), "%02d%02d%02d.txt", dayOfMonth, month, year);

	return String(filename);
}

void updateDailyFilename() {
	// Get the current time from NTP
	timeClient.update();
	time_t now = timeClient.getEpochTime();
	struct tm *timeinfo = localtime(&now);

	// Check if it is 6:00 AM
	if (timeinfo->tm_hour == 6 && timeinfo->tm_min == 0) {
		// Update the daily filename
		currentDailyFilename = generateDailyFilename();
		Serial.println("Daily filename updated: " + currentDailyFilename);
	}
}

// Declare readingsJson as a global variable
JSONVar readingsJson;

String getSensorReading() {
	adcReading = analogRead(SENSOR_PIN);

	// Get an average of XX samples from ADC
	for (unsigned int i = 0U; i < ADC_SAMPLES; ++i) {
		adcReading = adcReading + analogRead(SENSOR_PIN);
	}
	adcReading = adcReading / ADC_SAMPLES;

	// Apply ADC correction and calculate voltage and pressure
	double voltage = -0.000000000000016 * pow(adcReading, 4) +
									 0.000000000118171 * pow(adcReading, 3) -
									 0.000000301211691 * pow(adcReading, 2) +
									 0.001109019271794 * adcReading + 0.034143524634089;

	currentPressure = mapFloat(voltage, sensorMinVoltage, sensorMaxVoltage, sensorMinPressure, sensorMaxPressure);

	// Update calibration offset if necessary
	if (prevCalib != calibFloat) {
		calibOffset = currentPressure - calibFloat;
		prevCalib = calibFloat;
	}
	currentPressure = currentPressure - calibOffset;	// currentPressure is global variable

	// Create the JSON object with current pressure and active zone details
	// Call checkActiveZone to get the active zone details
	String activeZoneJsonString = checkActiveZone();

	// Parse the activeZoneJsonString into JSONVar
	JSONVar activeZoneJson = JSON.parse(activeZoneJsonString);
	readingsJson["Current Pressure"] = String((int)currentPressure);
	readingsJson["Active Zone"] = activeZoneJson;	 // Add the active zone details to the JSON

	// Convert to a JSON string and return
	return JSON.stringify(readingsJson);
}

void logData() {
	if (sdCardLock) {
		Serial.println("SD card is busy");
		return;
	}

	// Lock the SD card
	sdCardLock = true;

	// Get the current timestamp
	getTimeStamp(currentDayStamp, currentTimeStamp);
	//int currentHourInt = currentTimeStamp.substring(0, 2).toInt();
	//int currentMinuteInt = currentTimeStamp.substring(3, 5).toInt();

	// Extract the znumber field from the JSON
	String activeZoneNum = String((const char *)readingsJson["Active Zone"]["znumber"]);
	String activeZoneAvg = String((const char *)readingsJson["Active Zone"]["avgpsi"]);

	// Create the data message to be logged
	String dataMessage = String(readingID) + "," + 
								currentDayStamp + "," +
								currentTimeStamp + "," + 
								String(currentPressure) + "," +
								activeZoneNum + "," +
								activeZoneAvg + "\r\n";

	Serial.print("Saved data: ");
	Serial.println(dataMessage);

	// Open or create the daily log file in append mode
	String fileName = "/" + currentDailyFilename;
	File file = SD.open(fileName.c_str(), FILE_APPEND);

	if (!file) {
		logMsg("Failed to open file for appending");
		sdCardLock = false;
		return;
	}

	// Append the data to the file
	if (!file.print(dataMessage)) {
		logMsg("Failed to append data");
	}

	file.close();

	// Increment the reading ID
	readingID++;

	// Unlock the SD card
	sdCardLock = false;
}

void deleteFileHandler(AsyncWebServerRequest *request) {
	if (request->hasParam("filename")) {
		String filename = request->getParam("filename")->value();

		// Log the filename received
		Serial.println("Requested file for deletion: " + filename);

		if (!filename.startsWith("/")) {
			filename = "/" + filename;
		}

		bool success = false;

		// Check if the file exists on SPIFFS and try to delete it
		if (SPIFFS.exists(filename)) {
			Serial.println("File found on SPIFFS. Attempting to delete...");
			success = SPIFFS.remove(filename);
		}
		// Check if the file exists on SD card and try to delete it
		else if (SD.exists(filename)) {
			Serial.println("File found on SD card. Attempting to delete...");
			success = SD.remove(filename);
		} else {
			Serial.println("File not found on either SPIFFS or SD card.");
		}

		// Log the result of the deletion attempt
		if (success) {
			Serial.println("File deleted successfully.");
			request->send(200, "text/plain", "File deleted successfully");
		} else {
			Serial.println("Failed to delete file.");
			request->send(500, "text/plain", "Failed to delete file");
		}
	} else {
		Serial.println("File not found on either SPIFFS or SD card.");
		request->send(404, "text/plain",
									"File not found on either SPIFFS or SD card.");
	}
}

// -------------------- SETUP ----------------------
void setup() {
	Serial.begin(9600);
	initOledDisplay();

	// Set up the WiFi
	initWiFi();
	IPmessage = WiFi.localIP();
	Serial.println(IPmessage);
	delay(1000);

	// Initialize SPIFFs
	if (!SPIFFS.begin(true)) {
		Serial.println("An Error occurred while mounting SPIFFS");
		return;
	}

	if (!SD.begin(SD_CS)) {
		Serial.println("Card Mount Failed");
		return;
	}
	uint8_t cardType = SD.cardType();
	if (cardType == CARD_NONE) {
		Serial.println("No SD card attached");
		return;
	}
	Serial.println("SD Card initialized.");

	// Initialize a NTPClient to get time
	timeClient.begin();
	timeClient.update();

	currentDailyFilename = generateDailyFilename();	 // Initialize global variable

	// Only open or create the daily log file if it doesn't exist (avoid
	// overwriting)
	String fileName = "/" + currentDailyFilename;
	if (!SD.exists(fileName.c_str())) {
		// Open in write mode only if it doesn't exist
		File file = SD.open(fileName.c_str(), FILE_WRITE);
		if (!file) {
			logMsg("Failed to create the daily log file");
		} else {
			Serial.println("Created new daily log file");
			logMsg("Created new daily log file");
			file.close();
		}
	}

	saveSensorRate(String(timerDelay/1000));

	////// Server Endpoints //////
	// Web Server Root URL
	server.on("/", HTTP_GET, [](AsyncWebServerRequest *request) {
		if (SPIFFS.exists("/index.html")) {
			request->send(SPIFFS, "/index.html", "text/html");
		} else {
			request->send(404, "text/plain", "File not found");
		}
	});

	server.serveStatic("/", SPIFFS, "/");

	server.on("/get-daily-filename", HTTP_GET, [](AsyncWebServerRequest *request) {
		String fileName = currentDailyFilename;
		request->send(200, "text/plain", fileName);
	});

	server.on("/get-data-file", HTTP_GET, [](AsyncWebServerRequest *request) {
		if (request->hasParam("filename")) {
			String fileName = request->getParam("filename")->value();
			fileName.trim();	// Trim any whitespace

			if (fileName.indexOf("..") != -1) {
				logMsg("Invalid filename.");
				request->send(400, "text/plain", "Invalid filename.");
				return;
			}

			if (!fileName.startsWith("/")) {
				fileName = "/" + fileName;
			}

			// Check if the SD card is locked
			if (sdCardLock) {
				request->send(500, "text/plain", "SD card is busy");
				logMsg("SD card is busy");
				return;
			}

			// Lock the SD card
			sdCardLock = true;

			File file = SD.open(fileName.c_str(), FILE_READ);
			if (!file) {
				String errorMessage = "Failed to open file or file does not exist. Filename: " + fileName;
				logMsg(errorMessage.c_str());
				request->send(500, "text/plain", errorMessage);
			} else {
				fileSize = file.size();
				char buffer[BUFFER_SIZE];	 // Create a buffer for reading the file

				// Create a custom response to stream the file content
				AsyncWebServerResponse *response = request->beginChunkedResponse("text/plain", [file, buffer](uint8_t *data, size_t len, size_t index) mutable -> size_t {
					if (file.available()) {
						memset(buffer, 0, BUFFER_SIZE);													 // Clear the buffer to avoid leftover data
						size_t bytesRead = file.readBytes(buffer, BUFFER_SIZE);	 // Read a chunk of the file
						memcpy(data, buffer, bytesRead);												 // Copy the exact chunk into the response data buffer
						return bytesRead;																				 // Return the exact number of bytes read
					} else {
						file.close();	 // Close the file when done
						return 0;			 // Indicate that we're done sending data
					}
				});
				request->send(response);
			}

			// Unlock the SD card
			sdCardLock = false;
		} else {
			logMsg("Filename not specified.");
			request->send(400, "text/plain", "Filename not specified.");
		}
	});

	server.on("/list-sd-card-files", HTTP_GET, [](AsyncWebServerRequest *request) {
		String fileList = "[";
		File root = SD.open("/");
		File file = root.openNextFile();
		bool first = true;
		while (file) {
			if (!first) {
				fileList += ",";
			}
			fileList += "\"" + String(file.name()) + "\"";
			first = false;
			file = root.openNextFile();
		}
		fileList += "]";
		request->send(200, "application/json", fileList);
	});

	server.on("/list-spiffs-files", HTTP_GET, [](AsyncWebServerRequest *request) {
		String fileList = "[";
		File root = SPIFFS.open("/");
		File file = root.openNextFile();
		bool first = true;
		while (file) {
			if (!first) {
				fileList += ",";
			}
			fileList += "\"" + String(file.name()) + "\"";
			first = false;
			file = root.openNextFile();
		}
		fileList += "]";
		request->send(200, "application/json", fileList);
	});

	server.on("/list-json-files", HTTP_GET, [](AsyncWebServerRequest *request) {
    String fileList = "[";
    File root = SPIFFS.open("/");
    File file = root.openNextFile();
    bool first = true;

    while (file) {
        // Check if the file name ends with ".json"
        String fileName = String(file.name());
        if (fileName.endsWith(".json")) {
            if (!first) {
                fileList += ",";
            }
            fileList += "\"" + fileName + "\"";
            first = false;
        }
        file = root.openNextFile();
    }

    fileList += "]";
    request->send(200, "application/json", fileList);
});

	server.on("/submit-zone-form", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, [](AsyncWebServerRequest *request, uint8_t *data, size_t len, size_t index, size_t total) {
    static String body = "";  // Declare body as static within the lambda

    if (index == 0) {  // First chunk
        body = "";  // Clear the body string at the start of a new request
    }

    for (size_t i = 0; i < len; i++) {
        body += (char)data[i];
    }

    if (index + len == total) {  // Last chunk
        // Parse JSON using Arduino_JSON
        JSONVar jsonData = JSON.parse(body);

        // Check if the parsing succeeded
        if (JSON.typeof(jsonData) == "undefined") {
            request->send(400, "text/plain", "Bad Request - JSON Parsing Failed");
            return;
        }

        // Write to SD
        File file = SD.open("/zone_data.json", FILE_WRITE);
        if (!file) {
            request->send(500, "text/plain", "Failed to open file for writing");
            return;
        }

        if (file.print(JSON.stringify(jsonData))) {
            request->send(200, "text/plain", "Data stored successfully");
        } else {
            request->send(500, "text/plain", "Failed to write data to file");
        }

        file.close();
    } });

	// Endpoint to serve the sensor sample rate data
	server.on("/get-sensor-rate", HTTP_GET, [](AsyncWebServerRequest *request) {
		String sampleRateData = loadSensorRate();
		request->send(200, "text/plain", sampleRateData);
	});

	// Endpoint to serve the location data
	server.on("/get-location", HTTP_GET, [](AsyncWebServerRequest *request) {
		String locationData = loadLocation();
		request->send(200, "text/plain", locationData);
	});

	// Endpoint to serve the calibration offset data
	server.on("/get-calib-offset", HTTP_GET, [](AsyncWebServerRequest *request) {
		String calibOffsetData = loadCalibOffset();
		request->send(200, "text/plain", calibOffsetData);
	});

	// Endpoint to serve the SD zone table data
	server.on("/load-sd-zone-table", HTTP_GET, [](AsyncWebServerRequest *request) {
		String zoneData = loadZoneTable(SD, "/zone_data.json");
		request->send(200, "application/json", zoneData);
	});

	// External zone data placed in SPIFFS file based on client selection
	server.on("/load-spiffs-zone-table", HTTP_GET, [](AsyncWebServerRequest *request) {
    // Check if the "filename" parameter is provided
    if (request->hasParam("filename")) {
        // Get the filename from the request
        String filename = request->getParam("filename")->value();
        
        // Ensure the file ends with .json for safety
        if (!filename.endsWith(".json")) {
            request->send(400, "text/plain", "Invalid file type. Only .json files are allowed.");
            return;
        }

        // Load the selected file from SPIFFS
       // Concatenate the root directory with the filename
        String fullPath = String("/") + filename;

        // Load the selected file from SPIFFS
        String zoneData = loadZoneTable(SPIFFS, fullPath.c_str()); // Use c_str() to pass const char*

        // If the file was loaded successfully, send the content
        if (zoneData.length() > 2) {
            request->send(200, "application/json", zoneData);
        } else {
            // If the file could not be loaded, return an error
            request->send(404, "text/plain", "File not found or empty.");
        }
    } else {
        // If the filename parameter is missing, return a bad request error
        request->send(400, "text/plain", "Filename parameter missing.");
    }
});

	server.on("/delete-file", HTTP_GET, deleteFileHandler);

	// Endpoint to trigger reset
	server.on("/reset", HTTP_GET, [](AsyncWebServerRequest *request) {
		request->send(200, "text/plain", "Resetting ESP32...");
		delay(1000);		// Allow time for the response to be sent
		ESP.restart();	// Reset the ESP32
	});

	server.onNotFound(notFound);
	server.addHandler(&events);

	// Route to handle the POST request to set the sensor sample rate
	server.on("/sensor-rate-input", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, handleSetSensorRate);

	// Route to handle the POST request to set the calibration value
	server.on("/calib-input", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, handleSetCalibration);

	// Route to handle the POST request to set the location value
	server.on("/loc-input", HTTP_POST, [](AsyncWebServerRequest *request) {}, NULL, handleSetLocation);

	// Start ElegantOTA (Over The Air) updating
	// To access, use <IPaddress/update> then send the firmware.bin compiled image
	// file To upload data directory use spiffs.bin
	ElegantOTA.begin(&server);

	// Start server
	server.begin();
}

// ----------------- LOOP ----------------------
void loop() {
	ElegantOTA.loop();

	if ((millis() - lastTime) > timerDelay) {
		lastTime = millis();

		// Check if it's time to update the daily filename
		updateDailyFilename();

		// Send Events to the client with the Sensor Readings Every 30 seconds
		// events.send("ping", NULL, millis());
		events.send(getSensorReading().c_str(), "new-readings", millis());
		updateOledDisplay(currentPressure, IPmessage);
		logData();
	}
	delay(100);
}