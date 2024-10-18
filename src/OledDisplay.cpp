#include "OledDisplay.h"

#define SCREEN_ADDRESS      0x3C 
#define SCREEN_WIDTH         128 // OLED display width, in pixels
#define SCREEN_HEIGHT         64 // OLED display height, in pixels
#define OLED_RESET            -1 // Reset pin # (or -1 if sharing Arduino reset pin)
#define WIFI_HEIGHT           16 // icon size
#define WIFI_WIDTH            16 // icon size

// ============ constants ================
// WiFi ICON, 16x16px
const unsigned char wifi_bmp [] PROGMEM = {
	0x00, 0x00, 0x00, 0x00, 0x0f, 0xf0, 0x3f, 0xfc, 0x70, 0x0e, 0xc7, 0xe3, 0x9f, 0xf9, 0x38, 0x1c, 
	0x33, 0xcc, 0x07, 0xe0, 0x0c, 0x30, 0x01, 0x80, 0x01, 0x80, 0x01, 0x80, 0x00, 0x00, 0x00, 0x00
};

// OLED Display object
Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

// Initialize the OLED display
void initOledDisplay() {
    if(!display.begin(SSD1306_SWITCHCAPVCC, SCREEN_ADDRESS)) {
        Serial.println(F("SSD1306 allocation failed"));
        for(;;); // Don't proceed, loop forever
    }
    
    display.clearDisplay();
    display.setTextColor(WHITE); // need this
    display.setTextSize(2);
    display.setCursor(35, 0);
    display.printf("Water");
    display.setCursor(20, 16);
    display.printf("Pressure");
    display.setCursor(31, 32);
    display.printf("Sensor");
    
    display.display();
}

// Update the OLED display with current pressure and IP Address
void updateOledDisplay(float currentPressure, IPAddress IPmessage) {
    display.clearDisplay();

    display.drawBitmap(0, 0, wifi_bmp, WIFI_WIDTH, WIFI_HEIGHT, 1);
 
    // OLED display the Pressure
    display.setTextSize(2);
    display.setCursor(20, 0);
    display.print(F("Pressure"));
    display.setTextSize(1);
    display.setCursor(30, 18);
    display.print(IPmessage);
    display.setTextSize(3);
    display.setCursor(23, 43);
    display.println(currentPressure);

    display.display();
}
