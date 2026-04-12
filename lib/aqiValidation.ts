export interface NormalizedAQIData {
  source: string;
  aqi: number;
  pm25: number;
  pm10?: number;
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
}

export interface ValidationResult {
  final_aqi: number;
  final_pm25: number;
  final_pm10: number | null;
  final_co: number | null;
  final_no2: number | null;
  final_o3: number | null;
  final_so2: number | null;
  sources_used: string[];
  sources_discarded: string[];
}


export function calculateIQR(values: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
}


function validatePollutant(data: NormalizedAQIData[], key: keyof Omit<NormalizedAQIData, 'source'>): { value: number | null; discarded: string[] } {
  const validEntries = data.filter(d => d[key] !== undefined && d[key] !== null);
  if (validEntries.length === 0) return { value: null, discarded: [] };
  if (validEntries.length === 1) return { value: validEntries[0][key] as number, discarded: [] };

  const values = validEntries.map(d => d[key] as number);
  const { q1, q3, iqr } = calculateIQR(values);
  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const remaining = validEntries.filter(d => (d[key] as number) >= lowerBound && (d[key] as number) <= upperBound);
  const discarded = validEntries.filter(d => (d[key] as number) < lowerBound || (d[key] as number) > upperBound);

  
  const finalSet = remaining.length < 2 ? validEntries : remaining;
  const discardedNames = remaining.length < 2 ? [] : discarded.map(d => d.source);

  const finalValues = finalSet.map(d => d[key] as number);
  const maxDiff = Math.max(...finalValues) - Math.min(...finalValues);
  

  const threshold = 100; 

  const calculateMedian = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    const mid = Math.floor(s.length / 2);
    return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  };

  const calculateMean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

  const result = maxDiff > threshold ? calculateMedian(finalValues) : calculateMean(finalValues);

  return { 
    value: key === 'aqi' ? Math.round(result) : Number(result.toFixed(2)), 
    discarded: discardedNames 
  };
}


export function computeFinalAQI(data: NormalizedAQIData[]): ValidationResult {
  const aqiVal = validatePollutant(data, 'aqi');
  const pm25Val = validatePollutant(data, 'pm25');
  const pm10Val = validatePollutant(data, 'pm10');
  const coVal = validatePollutant(data, 'co');
  const no2Val = validatePollutant(data, 'no2');
  const o3Val = validatePollutant(data, 'o3');
  const so2Val = validatePollutant(data, 'so2');

  
  const aqiValidEntries = data.filter(d => d.aqi !== undefined && d.aqi !== null);
  const { q1, q3, iqr } = calculateIQR(aqiValidEntries.map(d => d.aqi));
  const lb = q1 - 1.5 * iqr;
  const ub = q3 + 1.5 * iqr;
  
  const remainingSources = aqiValidEntries.filter(d => d.aqi >= lb && d.aqi <= ub);
  const discardedSources = aqiValidEntries.filter(d => d.aqi < lb || d.aqi > ub);

  return {
    final_aqi: aqiVal.value || 0,
    final_pm25: pm25Val.value || 0,
    final_pm10: pm10Val.value,
    final_co: coVal.value,
    final_no2: no2Val.value,
    final_o3: o3Val.value,
    final_so2: so2Val.value,
    sources_used: (remainingSources.length < 2 ? aqiValidEntries : remainingSources).map(d => d.source),
    sources_discarded: (remainingSources.length < 2 ? [] : discardedSources).map(d => d.source)
  };
}
