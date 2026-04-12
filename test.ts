import { computeFinalAQI } from './lib/aqiValidation';

const data = [
  { source: 'openweather', aqi: 59, pm25: 59 },
  { source: 'weatherapi', aqi: 109, pm25: 109 },
  { source: 'openmeteo', aqi: 96, pm25: 96 }
];

console.log(JSON.stringify(computeFinalAQI(data), null, 2));
