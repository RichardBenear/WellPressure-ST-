**Wireless Well Pressure Monitor**

This App uses an ESP32C3, a water pressure sensor, and a small 1.3" OLED display for the hardware. Water pressure from a well is wirelessly transmitted to a local internet address where it is displayed in chart form. The data for each day is stored in a micro SD card. The history for these days can be shown in another chart. There is zoom and pan capability.

Highcharts.com provides the JavaScript library for the chart graphics and rendering.

There is a **Configuration Page** where the name of the location can be set. Also, there is a **Zone Table** that can be created, edited, and then saved in a micro SD card in the ESP32C3. Zone Tables can also be created as text JSON files and compiled into SPIFFS along with the rest of the code. From the Config Page, the JSON zone table can then be loaded and saved in SD, where it is used to detect and display which zone is running and flag any deviations from the average PSI. Deviations from average should indicate if there are broken or leaking irrigation components and are shown in red in the charts.

Each day starts at 6:00 A.M. till 5:59 A.M. (24 hours) the next day. Each day's data is stored in the micro SD card.

On the **Config Page**, the pressure sample rate can be changed from the default 30 sec. Also, the pressure sensor can be calibrated to the actual pressure if there is a gauge that shows a deviation between them.

There is a **Files Page** that provides a way to inspect all the SD and SPIFFS files and to delete them if desired. You can also remotely reset the ESP32C3 processor here.

**ElegantOTA** is used to wirelessly update the code. A 3D-printed case is used to house the electronics.

**Author: Richard Benear 9/22/23**

![Title](./images/Water Pressure Chart-1.png)
