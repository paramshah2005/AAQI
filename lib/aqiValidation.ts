export interface NormalizedAQIData {
  source: string;
  aqi: number;
  pm25: number;
}

export interface ValidationResult {
  final_aqi: number;
  final_pm25: number;
  sources_used: string[];
  sources_discarded: string[];
}


export function calculateIQR(values: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
}


export function filterOutliers(data: NormalizedAQIData[]): { remaining: NormalizedAQIData[]; discarded: NormalizedAQIData[] } {
  if (data.length < 2) return { remaining: data, discarded: [] };

  const aqiValues = data.map(d => d.aqi);
  const { q1, q3, iqr } = calculateIQR(aqiValues);

  const lowerBound = q1 - 1.5 * iqr;
  const upperBound = q3 + 1.5 * iqr;

  const remaining = data.filter(d => d.aqi >= lowerBound && d.aqi <= upperBound);
  const discarded = data.filter(d => d.aqi < lowerBound || d.aqi > upperBound);

  
  if (remaining.length < 2) {
    return { remaining: data, discarded: [] };
  }

  return { remaining, discarded };
}


export function computeFinalAQI(data: NormalizedAQIData[]): ValidationResult {
  const { remaining, discarded } = filterOutliers(data);
  const aqiValues = remaining.map(d => d.aqi);
  const pm25Values = remaining.map(d => d.pm25);

  const maxDiff = Math.max(...aqiValues) - Math.min(...aqiValues);
  const isInconsistent = maxDiff > 100;

  const calculateMedian = (values: number[]) => {
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
  };

  const calculateMean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;

  const final_aqi = isInconsistent ? calculateMedian(aqiValues) : calculateMean(aqiValues);
  const final_pm25 = calculateMean(pm25Values); // Requirements don't specify median for PM2.5, but mean is standard

  return {
    final_aqi: Math.round(final_aqi),
    final_pm25: Number(final_pm25.toFixed(2)),
    sources_used: remaining.map(d => d.source),
    sources_discarded: discarded.map(d => d.source)
  };
}
