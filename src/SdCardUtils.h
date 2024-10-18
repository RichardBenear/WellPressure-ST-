#ifndef SD_CARD_UTILS_H
#define SD_CARD_UTILS_H

#include "FS.h"
#include "SD.h"

// Function prototypes
void initSdCard();
String readFile(fs::FS &fs, const char * path);
void appendFile(fs::FS &fs, const char * path, const char * message);
void writeFile(fs::FS &fs, const char * path, const char * message);
void deleteFile(fs::FS &fs, const char * path);

#endif // SD_CARD_UTILS_H
