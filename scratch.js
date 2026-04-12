const data = [
  { source: "openweather", aqi: 59, pm25: 15.6 },
  { source: "weatherapi", aqi: 109, pm25: 38.3 },
  { source: "openmeteo", aqi: 96, pm25: 33.2 }
];

function buildPollutantVector(data) {
  return [
    data.aqi,
    data.pm25 || (data.aqi / 3),
  ];
}
const vectors = data.map(d => ({ source: d.source, vector: buildPollutantVector(d) }));

function computeCentroid(vectors) {
  const dim = vectors[0].length;
  const centroid = new Array(dim).fill(0);
  for (const vec of vectors) for (let i = 0; i < dim; i++) centroid[i] += vec[i];
  for (let i = 0; i < dim; i++) centroid[i] /= vectors.length;
  return centroid;
}
const centroid = computeCentroid(vectors.map(v => v.vector));

function cosineSimilarity(vecA, vecB) {
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0; let magA = 0; let magB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    magA += vecA[i] * vecA[i];
    magB += vecB[i] * vecB[i];
  }
  magA = Math.sqrt(magA); magB = Math.sqrt(magB);
  const cosSim = (magA === 0 || magB === 0) ? 0 : dotProduct / (magA * magB);
  const magSim = (magA === 0 && magB === 0) ? 1 : Math.min(magA, magB) / Math.max(magA, magB);
  return cosSim * magSim;
}

vectors.forEach(v => {
  const score = cosineSimilarity(v.vector, centroid);
  console.log(v.source, (score * 100).toFixed(0) + "%");
});
