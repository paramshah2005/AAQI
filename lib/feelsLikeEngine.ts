/**
 * Feels Like AQI Engine — Uses ML-Trained Coefficients
 * 
 * Training Pipeline:
 *   1. Fetch 30 days of hourly (weather, AQI) from Open-Meteo  
 *   2. Features X = [wind_speed, humidity, temp, pressure, current_aqi]
 *   3. Label Y = AQI measured 1 hour later
 *   4. Train OLS Linear Regression → learn coefficients
 *   5. Predict: given current weather + AQI → what will AQI become?
 *   6. That prediction IS the "Feels Like AQI"
 */

import { TrainedModel, predict } from './mlRegression';

const HISTORY_KEY = 'eco_pulse_aqi_history_v4';
const MAX_HISTORY = 200;

export interface AQIHistoryPoint {
  timestamp: number;
  aqi: number;
  feelsLike: number;
  temp: number;
  humidity: number;
  wind_speed: number;
}

export interface FeelsLikeFactor {
  name: string;
  impact: 'positive' | 'negative' | 'neutral';
  value: number;
  unit: string;
  description: string;
  aqiEffect: number;
}

export interface FeelsLikeResult {
  feelsLikeAQI: number;
  currentAQI: number;
  trend: 'better' | 'worse' | 'similar';
  trendDelta: number;
  factors: FeelsLikeFactor[];
  history: AQIHistoryPoint[];
  model: TrainedModel | null;
}

// ═══ History Management ═══

export function getAQIHistory(): AQIHistoryPoint[] {
  if (typeof window === 'undefined') return [];
  try {
    const saved = localStorage.getItem(HISTORY_KEY);
    if (!saved) return [];
    return JSON.parse(saved);
  } catch {
    return [];
  }
}

export function setAQIHistory(history: AQIHistoryPoint[]): void {
  if (typeof window === 'undefined') return;
  const trimmed = history.slice(-MAX_HISTORY);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(trimmed));
}

function appendToHistory(point: AQIHistoryPoint): AQIHistoryPoint[] {
  const history = getAQIHistory();
  if (history.length > 0) {
    const lastPoint = history[history.length - 1];
    if (Math.abs(point.timestamp - lastPoint.timestamp) < 2 * 60 * 1000) {
      history[history.length - 1] = point;
      setAQIHistory(history);
      return history;
    }
  }
  history.push(point);
  setAQIHistory(history);
  return history;
}

/**
 * Computes Feels Like AQI for historical data points using the trained model.
 */
export function computeFeelsLike(model: TrainedModel, params: {
  aqi: number;
  temp: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
}): number {
  return predict(model, {
    wind_speed: params.wind_speed,
    humidity: params.humidity,
    temperature: params.temp,
    pressure: params.pressure,
    aqi_current: params.aqi,
  });
}

/**
 * Main prediction function using the trained ML model.
 */
export function predictFeelsLikeAQI(params: {
  currentAQI: number;
  temp: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
  pm25: number;
  model: TrainedModel;
  pollutionScore?: number;
}): FeelsLikeResult {
  const { currentAQI, temp, humidity, wind_speed, pressure, model, pollutionScore = 0 } = params;

  // Use the trained model to predict
  const feelsLikeAQI = predict(model, {
    wind_speed,
    humidity,
    temperature: temp,
    pressure,
    aqi_current: currentAQI,
  });

  // Apply pollution score adjustment on top of ML prediction.
  // User-reported local pollution activity is directly added to Feels Like AQI.
  const pollutionEffect = Math.round(pollutionScore);
  const adjustedFeelsLike = Math.max(0, Math.min(500, feelsLikeAQI + pollutionEffect));

  const delta = adjustedFeelsLike - currentAQI;
  let trend: 'better' | 'worse' | 'similar' = 'similar';
  if (delta > 5) trend = 'worse';
  else if (delta < -5) trend = 'better';

  // Build factor explanations using MARGINAL EFFECTS:
  // Contribution = coefficient × (current_value - training_mean)
  // This shows how much each factor's DEVIATION from typical causes the AQI shift.
  const factors: FeelsLikeFactor[] = [];
  const means = model.feature_means || {
    wind_speed: 3, humidity: 60, temperature: 28, pressure: 1010, aqi_current: 80,
  };

  const windDev = wind_speed - means.wind_speed;
  const windContrib = Math.round(model.coefficients.wind_speed * windDev);
  factors.push({
    name: 'Wind Speed',
    impact: windContrib < -2 ? 'positive' : windContrib > 2 ? 'negative' : 'neutral',
    value: Number(wind_speed.toFixed(1)),
    unit: 'm/s',
    description: wind_speed > 4
      ? `Higher than avg (${means.wind_speed} m/s) — extra dispersal reducing AQI`
      : wind_speed < 1
        ? `Lower than avg (${means.wind_speed} m/s) — less dispersal`
        : `Near average wind speed (avg: ${means.wind_speed} m/s)`,
    aqiEffect: windContrib,
  });

  const humidDev = humidity - means.humidity;
  const humidContrib = Math.round(model.coefficients.humidity * humidDev);
  factors.push({
    name: 'Humidity',
    impact: humidContrib > 2 ? 'negative' : humidContrib < -2 ? 'positive' : 'neutral',
    value: humidity,
    unit: '%',
    description: humidity > 70
      ? `Higher than avg (${means.humidity}%) — more PM2.5 moisture absorption`
      : humidity < 35
        ? `Lower than avg (${means.humidity}%) — particles disperse easier`
        : `Near average humidity (avg: ${means.humidity}%)`,
    aqiEffect: humidContrib,
  });

  const tempDev = temp - means.temperature;
  const tempContrib = Math.round(model.coefficients.temperature * tempDev);
  factors.push({
    name: 'Temperature',
    impact: tempContrib > 2 ? 'negative' : tempContrib < -2 ? 'positive' : 'neutral',
    value: temp,
    unit: '°C',
    description: temp > means.temperature + 5
      ? `${tempDev.toFixed(0)}°C above avg — elevated emissions and aerosol formation`
      : temp < means.temperature - 5
        ? `${Math.abs(tempDev).toFixed(0)}°C below avg — reduced pollutant formation`
        : `Near average temperature (avg: ${means.temperature}°C)`,
    aqiEffect: tempContrib,
  });

  const pressDev = pressure - means.pressure;
  const pressContrib = Math.round(model.coefficients.pressure * pressDev);
  factors.push({
    name: 'Atm. Pressure',
    impact: pressContrib > 2 ? 'negative' : pressContrib < -2 ? 'positive' : 'neutral',
    value: Math.round(pressure),
    unit: 'hPa',
    description: pressure < means.pressure - 5
      ? `Below avg (${means.pressure} hPa) — lower mixing height traps pollutants`
      : pressure > means.pressure + 5
        ? `Above avg (${means.pressure} hPa) — better vertical mixing`
        : `Near average pressure (avg: ${means.pressure} hPa)`,
    aqiEffect: pressContrib,
  });

  // Always show pollution score factor so users can verify community signal is included.
  factors.push({
    name: 'Local Pollution Activity',
    impact: pollutionEffect > 2 ? 'negative' : pollutionEffect < -2 ? 'positive' : 'neutral',
    value: pollutionScore,
    unit: 'pts',
    description: pollutionScore > 50
      ? `High crowdsourced pollution reports — significant local emission activity`
      : pollutionScore > 20
        ? `Moderate crowdsourced reports — some local pollution sources detected`
        : pollutionScore > 0
          ? `Low crowdsourced activity — minimal additional pollution reported`
          : `No validated crowdsourced reports yet (needs at least 3 in the last 20 minutes per area)`,
    aqiEffect: pollutionEffect,
  });

  // Sort by absolute impact
  factors.sort((a, b) => Math.abs(b.aqiEffect) - Math.abs(a.aqiEffect));

  // Save to history
  const newPoint: AQIHistoryPoint = {
    timestamp: Date.now(),
    aqi: currentAQI,
    feelsLike: adjustedFeelsLike,
    temp, humidity, wind_speed,
  };
  const updatedHistory = appendToHistory(newPoint);

  return {
    feelsLikeAQI: adjustedFeelsLike,
    currentAQI,
    trend,
    trendDelta: delta,
    factors,
    history: updatedHistory,
    model,
  };
}
