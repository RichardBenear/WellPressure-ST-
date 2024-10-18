#ifndef OLED_DISPLAY_H
#define OLED_DISPLAY_H

#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>
#include <IPAddress.h>

// Function prototypes
void initOledDisplay();
void updateOledDisplay(float currentPressure, IPAddress IPmessage);

#endif // OLED_DISPLAY_H
