-- CreateTable
CREATE TABLE "AqiReport" (
    "id" SERIAL NOT NULL,
    "areaName" TEXT NOT NULL,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "category" TEXT NOT NULL,
    "sources" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AqiReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WeatherLog" (
    "id" SERIAL NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lat" DOUBLE PRECISION NOT NULL,
    "lon" DOUBLE PRECISION NOT NULL,
    "temp" DOUBLE PRECISION,
    "humidity" DOUBLE PRECISION,
    "aqi" INTEGER,
    "provider" TEXT,
    "location" TEXT,
    "pm25" DOUBLE PRECISION,
    "pm10" DOUBLE PRECISION,
    "co" DOUBLE PRECISION,
    "no2" DOUBLE PRECISION,
    "o3" DOUBLE PRECISION,
    "so2" DOUBLE PRECISION,

    CONSTRAINT "WeatherLog_pkey" PRIMARY KEY ("id")
);
