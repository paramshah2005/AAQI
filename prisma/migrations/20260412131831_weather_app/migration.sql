-- CreateTable
CREATE TABLE "AqiReport" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "areaName" TEXT NOT NULL,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "category" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "WeatherLog" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" REAL NOT NULL,
    "lon" REAL NOT NULL,
    "temp" REAL,
    "humidity" REAL,
    "aqi" INTEGER,
    "provider" TEXT,
    "location" TEXT,
    "pm25" REAL,
    "pm10" REAL,
    "co" REAL,
    "no2" REAL,
    "o3" REAL,
    "so2" REAL
);
