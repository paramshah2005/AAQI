import { NextResponse } from 'next/server';
import { pm25ToUSAQI } from '@/lib/aqiUtils';

/**
 * Fetches historical hourly AQI + weather data for the past 24 hours.
 * Uses Open-Meteo APIs (free, no key needed, has hourly historical data).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    // Get past 24 hours + next few hours of hourly data
    const now = new Date();
    const past = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    const startDate = past.toISOString().split('T')[0];
    const endDate = now.toISOString().split('T')[0];

    const [weatherRes, aqiRes] = await Promise.all([
      fetch(
        `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
        `&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure` +
        `&start_date=${startDate}&end_date=${endDate}&timezone=auto`
      ),
      fetch(
        `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}` +
        `&hourly=pm2_5,pm10` +
        `&start_date=${startDate}&end_date=${endDate}&timezone=auto`
      ),
    ]);

    if (!weatherRes.ok || !aqiRes.ok) {
      throw new Error('Failed to fetch historical data');
    }

    const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);

    // Merge hourly data into time series
    const weatherTimes = weatherData.hourly?.time || [];
    const aqiTimes = aqiData.hourly?.time || [];

    const history: Array<{
      timestamp: number;
      temp: number;
      humidity: number;
      wind_speed: number;
      pressure: number;
      pm25: number;
      aqi: number;
    }> = [];

    // Use weather times as base (both APIs return same hourly slots)
    for (let i = 0; i < weatherTimes.length; i++) {
      const time = weatherTimes[i];
      const ts = new Date(time).getTime();
      
      // Only include past hours (not future)
      if (ts > now.getTime()) continue;

      const pm25 = aqiData.hourly?.pm2_5?.[i];
      if (pm25 === undefined || pm25 === null) continue;

      const temp = weatherData.hourly?.temperature_2m?.[i] ?? 25;
      const humidity = weatherData.hourly?.relative_humidity_2m?.[i] ?? 50;
      const wind_speed_kmh = weatherData.hourly?.wind_speed_10m?.[i] ?? 0;
      const pressure = weatherData.hourly?.surface_pressure?.[i] ?? 1013;

      history.push({
        timestamp: ts,
        temp: Math.round(temp),
        humidity: Math.round(humidity),
        wind_speed: Number((wind_speed_kmh / 3.6).toFixed(1)), // km/h to m/s
        pressure: Math.round(pressure),
        pm25: Number(pm25.toFixed(2)),
        aqi: pm25ToUSAQI(pm25),
      });
    }

    return NextResponse.json({ history });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    console.error('Historical data error:', error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}
