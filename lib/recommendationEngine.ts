export interface Pollutants {
  pm25: number;
  pm10: number;
  co: number;
  no2: number;
  o3: number;
  so2: number;
}

export interface RecommendationResult {
  overall: string;
  alerts: string[];
  severity: "low" | "moderate" | "high";
}

export function generateHealthRecommendations(pollutants: Pollutants): RecommendationResult {
  const alerts: string[] = [];

  if (pollutants.pm25 > 35) {
    alerts.push("High fine particulate matter (PM2.5). May cause breathing discomfort.");
  }
  if (pollutants.pm10 > 100) {
    alerts.push("High coarse particles (PM10). Avoid dusty environments.");
  }
  if (pollutants.no2 > 100) {
    alerts.push("Elevated NO2 levels. Traffic pollution is high.");
  }
  if (pollutants.o3 > 100) {
    alerts.push("High ozone levels. Avoid outdoor activity during midday.");
  }
  if (pollutants.co > 10000) {
    alerts.push("High carbon monoxide levels. Avoid enclosed polluted areas.");
  }
  if (pollutants.so2 > 75) {
    alerts.push("Elevated SO2 levels. May irritate lungs and throat.");
  }

  const ruleAlertCount = alerts.length;

  let overall = "Air quality is safe for normal outdoor activities.";
  let severity: "low" | "moderate" | "high" = "low";

  if (ruleAlertCount >= 3) {
    overall = "High pollution levels. Limit outdoor activity and consider protective measures.";
    severity = "high";
  } else if (ruleAlertCount >= 1) {
    overall = "Moderate pollution detected. Sensitive individuals should take precautions.";
    severity = "moderate";
  }

  // Add positive suggestions if no pollution alerts were triggered
  if (ruleAlertCount === 0) {
    alerts.push("Ideal for outdoor exercise and deep breathing.");
    alerts.push("Keep windows open to welcome fresh natural air.");
    alerts.push("Good day for park visits or outdoor activities.");
  }

  return {
    overall,
    alerts,
    severity
  };
}
