import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const lat = searchParams.get('lat');
  const lon = searchParams.get('lon');
  const provider = searchParams.get('provider') || 'openweather';

  if (!lat || !lon) {
    return NextResponse.json({ error: 'Missing coordinates' }, { status: 400 });
  }

  try {
    switch (provider) {
      case 'openweather':
        return await handleOpenWeather(lat, lon);
      case 'weatherapi':
        return await handleWeatherAPI(lat, lon);
      case 'openmeteo':
        return await handleOpenMeteo(lat, lon);
      default:
        return NextResponse.json({ error: 'Invalid provider' }, { status: 400 });
    }
  } catch (error: any) {
    console.error(`API Error (${provider}):`, error);
    return NextResponse.json({ error: error.message || 'Failed to fetch weather data' }, { status: 500 });
  }
}

async function handleOpenWeather(lat: string, lon: string) {
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

  return NextResponse.json({
    temp: Math.round(weatherData.main.temp),
    humidity: weatherData.main.humidity,
    aqi: aqiData.list[0].main.aqi,
    pm25: aqiData.list[0].components.pm2_5,
    pm10: aqiData.list[0].components.pm10,
    co: aqiData.list[0].components.co,
    no2: aqiData.list[0].components.no2,
    o3: aqiData.list[0].components.o3,
    so2: aqiData.list[0].components.so2,
    location: weatherData.name,
    provider: 'OpenWeather'
  });
}

async function handleWeatherAPI(lat: string, lon: string) {
  const apiKey = process.env.WEATHERAPI_API_KEY;
  if (!apiKey || apiKey === 'YOUR_WEATHERAPI_KEY_HERE') {
    throw new Error('WeatherAPI.com Key not configured');
  }

  const res = await fetch(`https://api.weatherapi.com/v1/current.json?key=${apiKey}&q=${lat},${lon}&aqi=yes`);
  if (!res.ok) throw new Error('WeatherAPI.com failed');

  const data = await res.json();

  return NextResponse.json({
    temp: Math.round(data.current.temp_c),
    humidity: data.current.humidity,
    aqi: data.current.air_quality['us-epa-index'], // 1-6 scale
    pm25: data.current.air_quality.pm2_5,
    pm10: data.current.air_quality.pm10,
    co: data.current.air_quality.co,
    no2: data.current.air_quality.no2,
    o3: data.current.air_quality.o3,
    so2: data.current.air_quality.so2,
    location: data.location.name,
    provider: 'WeatherAPI.com'
  });
}

async function handleOpenMeteo(lat: string, lon: string) {
  const [weatherRes, aqiRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m`),
    fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10,carbon_monoxide,nitrogen_dioxide,ozone,sulphur_dioxide`)
  ]);

  if (!weatherRes.ok || !aqiRes.ok) throw new Error('Open-Meteo API failed');

  const [weatherData, aqiData] = await Promise.all([weatherRes.json(), aqiRes.json()]);

  return NextResponse.json({
    temp: Math.round(weatherData.current.temperature_2m),
    humidity: weatherData.current.relative_humidity_2m,
    aqi: aqiData.current.european_aqi > 100 ? 5 : aqiData.current.european_aqi > 75 ? 4 : aqiData.current.european_aqi > 50 ? 3 : aqiData.current.european_aqi > 25 ? 2 : 1,
    pm25: aqiData.current.pm2_5,
    pm10: aqiData.current.pm10,
    co: aqiData.current.carbon_monoxide,
    no2: aqiData.current.nitrogen_dioxide,
    o3: aqiData.current.ozone,
    so2: aqiData.current.sulphur_dioxide,
    location: 'Calculated Coords',
    provider: 'Open-Meteo'
  });
}
