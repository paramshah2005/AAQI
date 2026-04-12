import { NextResponse } from 'next/server';
import { pm25ToUSAQI } from '@/lib/aqiUtils';
import { prisma } from '@/lib/db';

interface WeatherData {
  temp: number;
  humidity: number;
  wind_speed?: number;
  pressure?: number;
  aqi: number;
  pm25?: number;
  pm10?: number;
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  location: string;
  provider: string;
  error?: string;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const provider = searchParams.get('provider') || 'openweather';

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    if (provider === 'all') {
      const results = await Promise.allSettled([
        getOpenWeatherData(lat, lon),
        getWeatherAPIData(lat, lon),
        getOpenMeteoData(lat, lon),
        getWAQIData(lat, lon),
        getAPINinjasData(lat, lon),
        getOpenAQData(lat, lon),
        getDataGovInData(lat, lon),
      ]);

      const data: Record<string, WeatherData | { error: string } | number> = {};
      results.forEach((res, idx) => {
        const id = ['openweather', 'weatherapi', 'openmeteo', 'waqi', 'apininjas', 'openaq', 'datagovin'][idx];
        if (res.status === 'fulfilled') {
          data[id] = res.value;
        } else {
          console.error(`Provider ${id} failed:`, res.reason);
          data[id] = { error: res.reason.message };
        }
      });

      // Magic Weather Fill-in: Borrow temp/humidity from the first available reliable source
      type WeatherObj = { temp: number; humidity: number; error?: string };
      const weatherProvider = (data['openweather'] as WeatherObj) || (data['weatherapi'] as WeatherObj) || (data['openmeteo'] as WeatherObj);
      
      if (weatherProvider && !('error' in weatherProvider)) {
        Object.values(data).forEach((entry) => {
          if (typeof entry === 'object' && entry !== null && 'temp' in entry && !('error' in entry)) {
            const e = entry as WeatherData;
            if (e.temp === 0 && e.humidity === 0) {
              e.temp = weatherProvider.temp;
              e.humidity = weatherProvider.humidity;
            }
          }
        });
      }

      try {
        const areaData = await getAreaPenalty();
        data.pollution_score = areaData.pollutionScore;
      } catch (e) {
        data.pollution_score = 0;
      }

      return NextResponse.json(data);
    }

    switch (provider) {
      case 'openweather':
        return NextResponse.json(await getOpenWeatherData(lat, lon));
      case 'weatherapi':
        return NextResponse.json(await getWeatherAPIData(lat, lon));
      case 'openmeteo':
        return NextResponse.json(await getOpenMeteoData(lat, lon));
      case 'waqi':
        return NextResponse.json(await getWAQIData(lat, lon));
      case 'apininjas':
        return NextResponse.json(await getAPINinjasData(lat, lon));
      case 'openaq':
        return NextResponse.json(await getOpenAQData(lat, lon));
      case 'datagovin':
        return NextResponse.json(await getDataGovInData(lat, lon));
      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Failed to fetch weather data';
    console.error(`API Error (${provider}):`, error);
    return NextResponse.json({ error: errorMessage }, { status: 500 });
  }
}

async function getOpenWeatherData(lat: string, lon: string) {
  const apiKey = process.env.OPENWEATHER_API_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('OpenWeather API Key not configured');
  }

  const [weatherRes, aqiRes] = await Promise.all([
    fetch(`https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${apiKey}&units=metric`),
    fetch(`https://api.openweathermap.org/data/2.5/air_pollution?lat=${lat}&lon=${lon}&appid=${apiKey}`)
  ]);

  if (!weatherRes.ok || !aqiRes.ok) throw new Error('OpenWeather API failed');

  const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);

  const pm25 = aqiData.list[0].components.pm2_5;

  return {
    temp: Math.round(weatherData.main.temp),
    humidity: weatherData.main.humidity,
    wind_speed: weatherData.wind?.speed || 0,
    pressure: weatherData.main.pressure || 1013,
    aqi: pm25ToUSAQI(pm25),
    pm25,
    pm10: aqiData.list[0].components.pm10,
    co: aqiData.list[0].components.co,
    no2: aqiData.list[0].components.no2,
    o3: aqiData.list[0].components.o3,
    so2: aqiData.list[0].components.so2,
    location: weatherData.name,
    provider: 'OpenWeather'
  };
}

async function getWeatherAPIData(lat: string, lon: string) {
  const apiKey = process.env.WEATHERAPI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_WEATHERAPI_KEY_HERE') {
    throw new Error('WeatherAPI.com Key not configured');
  }

  const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=yes`);
  if (!res.ok) throw new Error('WeatherAPI.com failed');

  const data = await res.json();
  const pm25 = data.current.air_quality.pm2_5;

  return {
    temp: Math.round(data.current.temp_c),
    humidity: data.current.humidity,
    wind_speed: data.current.wind_kph ? data.current.wind_kph / 3.6 : 0,
    pressure: data.current.pressure_mb || 1013,
    aqi: pm25ToUSAQI(pm25),
    pm25,
    pm10: data.current.air_quality.pm10,
    co: data.current.air_quality.co,
    no2: data.current.air_quality.no2,
    o3: data.current.air_quality.o3,
    so2: data.current.air_quality.so2,
    location: data.location.name,
    provider: 'WeatherAPI.com'
  };
}

async function getOpenMeteoData(lat: string, lon: string) {
  const [weatherRes, aqiRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,surface_pressure`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide`)
  ]);

  if (!weatherRes.ok || !aqiRes.ok) throw new Error('Open-Meteo API failed');

  const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);

  const pm25 = aqiData.current.pm2_5;

  return {
    temp: Math.round(weatherData.current.temperature_2m),
    humidity: weatherData.current.relative_humidity_2m,
    wind_speed: weatherData.current.wind_speed_10m ? weatherData.current.wind_speed_10m / 3.6 : 0,
    pressure: weatherData.current.surface_pressure || 1013,
    aqi: pm25ToUSAQI(pm25),
    pm25,
    pm10: aqiData.current.pm10,
    co: aqiData.current.carbon_monoxide,
    no2: aqiData.current.nitrogen_dioxide,
    o3: aqiData.current.ozone,
    so2: aqiData.current.sulphur_dioxide,
    location: 'Calculated Coords',
    provider: 'Open-Meteo'
  };
}


async function getAreaPenalty() {
  const twentyMinsAgo = new Date(Date.now() - 20 * 60 * 1000);
  
  const reports = await prisma.aqiReport.findMany({
    where: {
      createdAt: { gte: twentyMinsAgo }
    }
  });

  const grouped: Record<string, typeof reports> = {};
  for (const r of reports) {
    if (!grouped[r.areaName]) grouped[r.areaName] = [];
    grouped[r.areaName].push(r);
  }

  let maxScoreForRegion = 0;

  for (const [_, areaReports] of Object.entries(grouped)) {
    if (areaReports.length >= 3) {
      let totalAreaScore = 0;
      
      for (const r of areaReports) {
        let reportScore = 0;
        
        try {
          const sourcesObj = JSON.parse(r.sources);
          
          // Normalized weights based on CPCB health guidelines (Sum = 1.0)
          const WEIGHTS: Record<string, number> = {
            'Traffic Data': 0.28,
            'Industrial Smoke': 0.22,
            'Waste Burning': 0.22,
            'Construction Dust': 0.12,
            'Stubble Burning': 0.10,
            'Odor / Unknown': 0.06
          };
          
          Object.entries(sourcesObj as Record<string, number>).forEach(([key, val]) => {
             if (val >= 1 && val <= 5 && WEIGHTS[key]) {
               // score = sum(weight_i * presence_i)
               reportScore += (WEIGHTS[key] * val);
             }
          });
        } catch (e) {}

        totalAreaScore += reportScore;
      }

      // Max possible raw score = 1.0 * 5 = 5.0
      const avgRawScore = totalAreaScore / areaReports.length;
      
      // Scale to 0-100
      const normalizedScore = (avgRawScore / 5.0) * 100;
      
      if (normalizedScore > maxScoreForRegion) {
        maxScoreForRegion = normalizedScore;
      }
    }
  }

  // We map the normalized 0-100 pollution score
  const rounded = Math.round(maxScoreForRegion);
  return {
    pollutionScore: rounded
  };
}

async function getWAQIData(lat: string, lon: string) {
  const apiKey = process.env.WAQI_TOKEN;
  if (!apiKey || apiKey === 'YOUR_WAQI_TOKEN_HERE') {
    throw new Error('WAQI Token not configured');
  }

  const res = await fetch(`https://api.waqi.info/feed/geo:${lat};${lon}/?token=${apiKey}`);
  if (!res.ok) throw new Error('WAQI API failed');

  const data = await res.json();
  if (data.status !== 'ok') throw new Error(`WAQI Error: ${data.data}`);

  return {
    temp: Math.round(data.data.iaqi.t?.v || 0),
    humidity: data.data.iaqi.h?.v || 0,
    aqi: data.data.aqi,
    pm25: data.data.iaqi.pm25?.v,
    pm10: data.data.iaqi.pm10?.v,
    co: data.data.iaqi.co?.v,
    no2: data.data.iaqi.no2?.v,
    o3: data.data.iaqi.o3?.v,
    so2: data.data.iaqi.so2?.v,
    location: data.data.city.name,
    provider: 'WAQI'
  };
}

async function getAPINinjasData(lat: string, lon: string) {
  const apiKey = process.env.API_NIN_KEY || process.env.API_NINJAS_KEY;
  if (!apiKey || apiKey === 'YOUR_API_NINJAS_KEY_HERE') {
    throw new Error('API-Ninjas Key not configured');
  }

  const res = await fetch(`https://api.api-ninjas.com/v1/airquality?lat=${lat}&lon=${lon}`, {
    headers: { 'X-Api-Key': apiKey }
  });
  if (!res.ok) throw new Error('API-Ninjas failed');

  const data = await res.json();

  return {
    temp: 0, // API-Ninjas doesn't provide temp
    humidity: 0,
    aqi: data.overall_aqi,
    pm25: data['PM2.5']?.concentration,
    pm10: data.PM10?.concentration,
    co: data.CO?.concentration,
    no2: data.NO2?.concentration,
    o3: data.O3?.concentration,
    so2: data.SO2?.concentration,
    location: 'Nearby Station',
    provider: 'API-Ninjas'
  };
}

async function getOpenAQData(lat: string, lon: string) {
  const apiKey = process.env.OPENAQ_API_KEY;
  if (!apiKey) throw new Error('OpenAQ API Key missing - V3 requires authentication');
  
  const headers = { 'X-API-Key': apiKey };

  // Fetch 1: Find the nearest location and its Sensor Map
  const locRes = await fetch(`https://api.openaq.org/v3/locations?coordinates=${lat},${lon}&radius=25000&limit=1`, { headers });
  if (!locRes.ok) throw new Error('OpenAQ V3 Locations failed');
  const locData = await locRes.json();
  if (!locData.results || locData.results.length === 0) throw new Error('No OpenAQ stations nearby');

  const location = locData.results[0];
  const sensors = location.sensors; 
  
  // Map sensor IDs back to human-readable strings like 'pm25'
  interface OpenAQSensor { id: number; parameter?: { name: string, units?: string } }
  const sensorMap: Record<number, { name: string, units: string }> = {};
  if (sensors && Array.isArray(sensors)) {
    sensors.forEach((s: OpenAQSensor) => {
      if (s.parameter && s.parameter.name) {
        sensorMap[s.id] = {
          name: s.parameter.name.toLowerCase(),
          units: (s.parameter.units || '').toLowerCase()
        };
      }
    });
  }

  // Fetch 2: Get actual recent live measurements for that exact location
  const latestRes = await fetch(`https://api.openaq.org/v3/locations/${location.id}/latest`, { headers });
  if (!latestRes.ok) throw new Error('OpenAQ V3 Measurements failed');
  const latestData = await latestRes.json();

  interface OpenAQMeasurement { sensorsId: number; value: number }
  const measurements: Record<string, number> = {};
  
  if (latestData.results && Array.isArray(latestData.results)) {
    latestData.results.forEach((r: OpenAQMeasurement) => {
      const sensorInfo = sensorMap[r.sensorsId];
      if (sensorInfo && r.value > 0) { // Also protects against negative calib values
        const param = sensorInfo.name;
        const unit = sensorInfo.units;
        let val = r.value;

        // Perform strict unit matching/conversion to match the Dashboard's UI
        if (param === 'co') {
          // UI expects mg/m³
          if (unit === 'µg/m³' || unit === 'ug/m3') val = val / 1000;
          else if (unit === 'ppb') val = val * (1.145 / 1000); 
        } else if (param === 'no2') {
          // UI expects ppb
          if (unit.includes('g/m')) val = val / 1.88;
        } else if (param === 'o3') {
          // UI expects ppb
          if (unit.includes('g/m')) val = val / 1.96;
        } else if (param === 'so2') {
          // UI expects ppb
          if (unit.includes('g/m')) val = val / 2.62;
        }

        measurements[param] = parseFloat(val.toFixed(2));
      }
    });
  }

  // Convert PM2.5 concentration to US AQI using EPA breakpoints
  const pm25 = measurements['pm25'] || 0;
  const aqi = pm25ToUSAQI(pm25);

  return {
    temp: 0, 
    humidity: 0,
    aqi: aqi,
    pm25: measurements['pm25'],
    pm10: measurements['pm10'],
    co: measurements['co'],
    no2: measurements['no2'],
    o3: measurements['o3'],
    so2: measurements['so2'],
    location: location.name,
    provider: 'OpenAQ'
  };
}

// Geospatial Distance Function
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2)
    ; 
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a)); 
  const d = R * c; // Distance in km
  return d;
}

// Data.gov.in (CPCB) Fetcher
interface DataGovRecord {
  station: string;
  latitude: string;
  longitude: string;
  pollutant_id: string;
  avg_value?: string;
  pollutant_avg?: string;
  city: string;
  state: string;
}

async function getDataGovInData(lat: string, lon: string) {
  const apiKey = process.env.DATA_GOV_IN_KEY;
  if (!apiKey || apiKey === 'YOUR_API_KEY_HERE') {
    throw new Error('Data.gov.in Key not configured');
  }

  const res = await fetch(`https://api.data.gov.in/resource/3b01bcb8-0b14-4abf-b6f2-c1bfd384ba69?api-key=${apiKey}&format=json&limit=5000`);
  if (!res.ok) throw new Error('Data.gov.in API failed');

  const data = await res.json();
  if (!data.records || data.records.length === 0) throw new Error('No Data.gov.in stations found');

  const userLat = parseFloat(lat);
  const userLon = parseFloat(lon);

  // 1. Group records by station and keep track of valid readings
  const stationMap: Record<string, { lat: number; lon: number; validCount: number }> = {};

  data.records.forEach((record: DataGovRecord) => {
    if (!stationMap[record.station]) {
      stationMap[record.station] = {
        lat: parseFloat(record.latitude),
        lon: parseFloat(record.longitude),
        validCount: 0
      };
    }
    const val = parseFloat(record.avg_value || record.pollutant_avg || '');
    if (!isNaN(val)) {
      stationMap[record.station].validCount++;
    }
  });

  // 2. Find the absolutely closest station THAT HAS VALID DATA using Geospatial Math
  let closestStation = '';
  let minDistance = Infinity;

  Object.entries(stationMap).forEach(([stationName, stationData]) => {
    // Only consider stations that actually have numeric pollutant data
    if (stationData.validCount > 0 && !isNaN(stationData.lat) && !isNaN(stationData.lon)) {
      const dist = getDistanceFromLatLonInKm(userLat, userLon, stationData.lat, stationData.lon);
      if (dist < minDistance) {
        minDistance = dist;
        closestStation = stationName;
      }
    }
  });

  if (!closestStation || minDistance > 500) {
    // If nearest is more than 500km away, data is practically useless for AQI locally
    throw new Error('No relevant Indian CPCB stations nearby');
  }

  // 2. Filter all raw records to only exactly match the closest station
  const stationRecords = data.records.filter((r: DataGovRecord) => r.station === closestStation);

  const measurements: Record<string, number> = {};
  let locationLabel = closestStation;

  stationRecords.forEach((r: DataGovRecord) => {
    // Some measurements use NA or string text, so parse securely
    const val = parseFloat(r.avg_value || r.pollutant_avg || '');
    if (!isNaN(val)) {
      measurements[r.pollutant_id] = val;
    }
    // Clean up city/state formatting for display
    const cleanCity = r.city.replace(/_/g, ' ');
    const cleanState = r.state.replace(/_/g, ' ');
    locationLabel = `${cleanCity}, ${cleanState} (CPCB)`;
  });

  // Convert PM2.5 concentration to US AQI using EPA breakpoints
  const pm25 = measurements['PM2.5'] || measurements['PM25'] || 0;
  const aqiValue = pm25ToUSAQI(pm25);

  return {
    temp: 0, // Uses Magic Weather Fill-in
    humidity: 0,
    aqi: aqiValue,
    pm25: pm25 || undefined,
    pm10: measurements['PM10'],
    co: measurements['CO'],
    no2: measurements['NO2'],
    o3: measurements['OZONE'],
    so2: measurements['SO2'],
    location: locationLabel,
    provider: 'Data.gov.in'

  };
}
