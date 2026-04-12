/**
 * Converts PM2.5 concentration (µg/m³) to US EPA AQI (0-500 scale).
 * Based on the official EPA breakpoints table.
 */
export function pm25ToUSAQI(pm25: number): number {
  const breakpoints = [
    { cLow: 0.0, cHigh: 12.0, iLow: 0, iHigh: 50 },
    { cLow: 12.1, cHigh: 35.4, iLow: 51, iHigh: 100 },
    { cLow: 35.5, cHigh: 55.4, iLow: 101, iHigh: 150 },
    { cLow: 55.5, cHigh: 150.4, iLow: 151, iHigh: 200 },
    { cLow: 150.5, cHigh: 250.4, iLow: 201, iHigh: 300 },
    { cLow: 250.5, cHigh: 350.4, iLow: 301, iHigh: 400 },
    { cLow: 350.5, cHigh: 500.4, iLow: 401, iHigh: 500 },
  ];

  if (pm25 < 0) return 0;
  if (pm25 > 500.4) return 500;

  for (const bp of breakpoints) {
    if (pm25 >= bp.cLow && pm25 <= bp.cHigh) {
      return Math.round(
        ((bp.iHigh - bp.iLow) / (bp.cHigh - bp.cLow)) * (pm25 - bp.cLow) + bp.iLow
      );
    }
  }

  return Math.round(pm25); // fallback
}

/**
 * Returns a human-readable AQI category label and color info
 * based on US AQI (0-500) scale.
 */
export function getAQICategory(aqi: number): {
  label: string;
  color: string;
  bg: string;
  border: string;
  iconBg: string;
} {
  if (aqi <= 50) return { label: 'Good', color: 'text-green-400', bg: 'bg-green-500/20', border: 'border-green-500/10', iconBg: 'bg-green-500/20' };
  if (aqi <= 100) return { label: 'Moderate', color: 'text-yellow-400', bg: 'bg-yellow-500/20', border: 'border-yellow-500/10', iconBg: 'bg-yellow-500/20' };
  if (aqi <= 150) return { label: 'Unhealthy (SG)', color: 'text-orange-400', bg: 'bg-orange-500/20', border: 'border-orange-500/10', iconBg: 'bg-orange-500/20' };
  if (aqi <= 200) return { label: 'Unhealthy', color: 'text-red-400', bg: 'bg-red-500/20', border: 'border-red-500/10', iconBg: 'bg-red-500/20' };
  if (aqi <= 300) return { label: 'Very Unhealthy', color: 'text-purple-400', bg: 'bg-purple-500/20', border: 'border-purple-500/10', iconBg: 'bg-purple-500/20' };
  return { label: 'Hazardous', color: 'text-rose-400', bg: 'bg-rose-500/20', border: 'border-rose-500/10', iconBg: 'bg-rose-500/20' };
}
