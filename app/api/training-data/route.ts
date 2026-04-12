import { NextResponse } from 'next/server';
import { pm25ToUSAQI } from '@/lib/aqiUtils';

/**
 * Fetches 30 days of hourly historical weather + AQI data for ML training.
 * Uses Open-Meteo (free, no key needed).
 * 
 * Returns paired (features, label) rows:
 *   X = [wind_speed, humidity, temperature, pressure] at time t
 *   Y = AQI at time t+1 (next hour)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    const now = new Date();
    const endDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // yesterday
    const startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000); // 30 days before

    const startStr = startDate.toISOString().split('T')[0];
    const endStr = endDate.toISOString().split('T')[0];

    // Fetch historical weather + AQI in parallel
    const [weatherRes, aqiRes] = await Promise.all([
      fetch(
        `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure` +
        `&start_date=${startStr}&end_date=${endStr}&timezone=auto`
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
        `&hourly=pm2_5` +
        `&start_date=${startStr}&end_date=${endStr}&timezone=auto`
      ),
    ]);

    if (!weatherRes.ok) {
      const errText = await weatherRes.text();
      throw new Error(`Weather API failed: ${errText}`);
    }
    if (!aqiRes.ok) {
      const errText = await aqiRes.text();
      throw new Error(`AQI API failed: ${errText}`);
    }

    const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);

    const weatherTimes = weatherData.hourly?.time || [];
    const aqiTimes = aqiData.hourly?.time || [];

    // Build paired training rows
    // For each hour t: features = weather(t), label = AQI(t+1)
    const trainingData: Array<{
      wind_speed: number;
      humidity: number;
      temperature: number;
      pressure: number;
      aqi_current: number;  // AQI at time t (also a feature)
      aqi_next: number;     // AQI at time t+1 (label)
    }> = [];

    const minLen = Math.min(weatherTimes.length, aqiTimes.length);

    for (let i = 0; i < minLen - 1; i++) {
      const pm25_current = aqiData.hourly?.pm2_5?.[i];
      const pm25_next = aqiData.hourly?.pm2_5?.[i + 1];
      const temp = weatherData.hourly?.temperature_2m?.[i];
      const humidity = weatherData.hourly?.relative_humidity_2m?.[i];
      const wind_kmh = weatherData.hourly?.wind_speed_10m?.[i];
      const pressure = weatherData.hourly?.surface_pressure?.[i];

      // Skip rows with missing data
      if (
        pm25_current == null || pm25_next == null ||
        temp == null || humidity == null ||
        wind_kmh == null || pressure == null ||
        isNaN(pm25_current) || isNaN(pm25_next)
      ) continue;

      trainingData.push({
        wind_speed: Number((wind_kmh / 3.6).toFixed(2)), // km/h → m/s
        humidity: Math.round(humidity),
        temperature: Math.round(temp),
        pressure: Math.round(pressure),
        aqi_current: pm25ToUSAQI(pm25_current),
        aqi_next: pm25ToUSAQI(pm25_next),
      });
    }

    return NextResponse.json({
      training_rows: trainingData.length,
      date_range: { start: startStr, end: endStr },
      data: trainingData,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Training data error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
