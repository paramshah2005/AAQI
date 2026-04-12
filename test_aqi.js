
interface NormalizedAQIData {
  source: string;
  aqi: number;
  pm25: number;
  pm10?: number;
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
}

interface SourceAQIInfo {
  source: string;
  aqi: number;
  used: boolean;
  similarity_score: number;
  iqr_passed: boolean;
  cosine_passed: boolean;
}

interface ValidationResult {
  final_aqi: number;
  final_pm25: number;
  final_pm10: number | null;
  final_co: number | null;
  final_no2: number | null;
  final_o3: number | null;
  final_so2: number | null;
  sources_used: string[];
  sources_discarded: string[];
  per_source_info: SourceAQIInfo[];
  confidence_score: number;
  validation_method: string;
}

/**
 * Calculates Q1, Q3 and IQR from a sorted array of numbers
 */
function calculateIQR(values: number[]): { q1: number; q3: number; iqr: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  return { q1, q3, iqr: q3 - q1 };
}

/**
 * Computes Cosine Similarity between two pollutant vectors.
 * Returns value between 0 (completely different) and 1 (identical pattern).
 */
function cosineSimilarity(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let magA = 0;
  let magB = 0;

  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }

  magA = Math.sqrt(magA);
  magB = Math.sqrt(magB);

  const cosSim = (magA === 0 || magB === 0) ? 0 : dotProduct / (magA * magB);
  
  // Apply a magnitude penalty.
  // Because AQI vectors are often 1-dimensional (only PM2.5 available from API), 
  // their angle is always 0, giving a 100% cosine similarity even if PM2.5 values are 50 vs 150.
  // Multiplying by the ratio of their magnitudes resolves this flaw.
  const magSim = (magA === 0 && magB === 0) ? 1 : Math.min(magA, magB) / Math.max(magA, magB);
  
  return cosSim * magSim;
}

function euclideanDistance(vecA: number[], vecB: number[]): number {
  if (vecA.length !== vecB.length || vecA.length === 0) return Number.POSITIVE_INFINITY;

  let sumSq = 0;
  for (let i = 0; i < vecA.length; i++) {
    const diff = vecA[i] - vecB[i];
    sumSq += diff * diff;
  }
  return Math.sqrt(sumSq);
}

function standardizeVectors(vectors: number[][]): number[][] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const means = new Array(dim).fill(0);
  const stds = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      means[i] += vec[i];
    }
  }
  for (let i = 0; i < dim; i++) {
    means[i] /= vectors.length;
  }

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      const delta = vec[i] - means[i];
      stds[i] += delta * delta;
    }
  }
  for (let i = 0; i < dim; i++) {
    stds[i] = Math.sqrt(stds[i] / vectors.length);
  }

  return vectors.map(vec =>
    vec.map((value, i) => {
      if (stds[i] === 0) return 0;
      return (value - means[i]) / stds[i];
    })
  );
}

function median(values: number[]): number {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 !== 0 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/**
 * Builds a pollutant vector from a data source for cosine similarity comparison.
 * Normalizes values to prevent any single pollutant from dominating.
 */
function buildPollutantVector(data: NormalizedAQIData): number[] {
  return [
    data.pm25 || 0,
    (data.pm10 || 0) * 0.5,    // Scale down PM10 (typically larger values)
    (data.no2 || 0),
    (data.o3 || 0),
    (data.co || 0) * 0.01,     // Scale down CO (µg/m³ can be very large)
    (data.so2 || 0),
  ];
}

/**
 * Computes the centroid (element-wise mean) of multiple pollutant vectors.
 */
function computeCentroid(vectors: number[][]): number[] {
  if (vectors.length === 0) return [];
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);

  for (const vec of vectors) {
    for (let i = 0; i < dim; i++) {
      centroid[i] += vec[i];
    }
  }

  for (let i = 0; i < dim; i++) {
    centroid[i] /= vectors.length;
  }

  return centroid;
}

/**
 * Generic pollutant validation logic (IQR + Consistency Check)
 */
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

  // Fallback to original dataset if fewer than 2 remain after outlier removal
  const finalSet = remaining.length < 2 ? validEntries : remaining;
  const discardedNames = remaining.length < 2 ? [] : discarded.map(d => d.source);

  const finalValues = finalSet.map(d => d[key] as number);
  const maxDiff = Math.max(...finalValues) - Math.min(...finalValues);

  // Consistency check: use median if spread > 100 (for AQI) or a scaled threshold for others
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

/**
 * Computes the final validated result using IQR + Cosine Similarity.
 * 
 * Pipeline:
 * 1. IQR outlier removal on AQI values
 * 2. Cosine similarity on multi-pollutant vectors against group centroid
 * 3. Sources failing either check are discarded (if enough remain)
 * 4. Final values computed from remaining trusted sources
 */
function computeFinalAQI(data: NormalizedAQIData[]): ValidationResult {
  const COSINE_THRESHOLD = 0.7;

  // === Step 1: IQR on AQI values ===
  const aqiValues = data.map(d => d.aqi);
  const { q1, q3, iqr } = calculateIQR(aqiValues);
  const lb = q1 - 1.5 * iqr;
  const ub = q3 + 1.5 * iqr;

  const iqrResults: Record<string, boolean> = {};
  data.forEach(d => {
    iqrResults[d.source] = d.aqi >= lb && d.aqi <= ub;
  });

  // === Step 1b: AQI consensus gate using deviation from median ===
  const aqiMedian = median(aqiValues);
  const maxAllowedAqiDeviation = Math.max(12, aqiMedian * 0.2);
  const aqiConsensusResults: Record<string, boolean> = {};
  data.forEach(d => {
    aqiConsensusResults[d.source] = Math.abs(d.aqi - aqiMedian) <= maxAllowedAqiDeviation;
  });

  // === Step 2: Cosine Similarity on pollutant vectors ===
  const vectors = data.map(d => ({
    source: d.source,
    vector: buildPollutantVector(d),
  }));

  const centroid = computeCentroid(vectors.map(v => v.vector));

  const similarityScores: Record<string, number> = {};
  const cosineResults: Record<string, boolean> = {};

  vectors.forEach(v => {
    const composite = cosineSimilarity(v.vector, centroid);

    similarityScores[v.source] = Number(composite.toFixed(4));
    cosineResults[v.source] = composite >= COSINE_THRESHOLD;
  });

  // === Step 3: Combine both checks ===
  const passedBoth = data.filter(d => iqrResults[d.source] && cosineResults[d.source] && aqiConsensusResults[d.source]);
  const failedSources = data.filter(d => !iqrResults[d.source] || !cosineResults[d.source] || !aqiConsensusResults[d.source]);

  // Fallback: if fewer than 2 pass both, use all sources
  const trustedSources = passedBoth.length >= 2 ? passedBoth : data;
  const discardedSources = passedBoth.length >= 2 ? failedSources : [];

  // Build per-source info for UI display
  const perSourceInfo: SourceAQIInfo[] = data.map(d => ({
    source: d.source,
    aqi: d.aqi,
    used: trustedSources.some(t => t.source === d.source),
    similarity_score: similarityScores[d.source] || 0,
    iqr_passed: iqrResults[d.source],
    cosine_passed: cosineResults[d.source] && aqiConsensusResults[d.source],
  }));

  // === Step 4: Compute final values from trusted sources ===
  const aqiVal = validatePollutant(trustedSources, 'aqi');
  const pm25Val = validatePollutant(trustedSources, 'pm25');
  const pm10Val = validatePollutant(trustedSources, 'pm10');
  const coVal = validatePollutant(trustedSources, 'co');
  const no2Val = validatePollutant(trustedSources, 'no2');
  const o3Val = validatePollutant(trustedSources, 'o3');
  const so2Val = validatePollutant(trustedSources, 'so2');

  // Confidence: based on agreement between sources & number of sources
  const avgSimilarity = Object.values(similarityScores).reduce((a, b) => a + b, 0) / Object.values(similarityScores).length;
  const sourceRatio = trustedSources.length / data.length;
  const agreementScore = Object.values(aqiConsensusResults).filter(Boolean).length / data.length;
  const confidence = Number((avgSimilarity * 0.45 + sourceRatio * 0.35 + agreementScore * 0.2).toFixed(2));

  // Determine which validation methods were decisive
  const methods: string[] = ['IQR Outlier Removal'];
  if (Object.values(cosineResults).some(v => !v)) {
    methods.push('Cosine Similarity Filtering');
  }
  if (Object.values(aqiConsensusResults).some(v => !v)) {
    methods.push('AQI Consensus Check');
  }

  return {
    final_aqi: aqiVal.value || 0,
    final_pm25: pm25Val.value || 0,
    final_pm10: pm10Val.value,
    final_co: coVal.value,
    final_no2: no2Val.value,
    final_o3: o3Val.value,
    final_so2: so2Val.value,
    sources_used: trustedSources.map(d => d.source),
    sources_discarded: discardedSources.map(d => d.source),
    per_source_info: perSourceInfo,
    confidence_score: confidence,
    validation_method: methods.join(' + '),
  };
}

const data = [{"source":"openweather","aqi":59,"pm25":15.6},{"source":"weatherapi","aqi":109,"pm25":38.3},{"source":"openmeteo","aqi":96,"pm25":33.2}];
console.log(JSON.stringify(computeFinalAQI(data).per_source_info, null, 2));
