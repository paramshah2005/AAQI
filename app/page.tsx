'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { WeatherCard } from '@/components/WeatherCard';
import { AQICard } from '@/components/AQICard';
import { FeelsLikeAQI } from '@/components/FeelsLikeAQI';
import { TimeSeriesChart } from '@/components/TimeSeriesChart';
import { Loader2, RefreshCw, AlertCircle, Database, Clock, ChevronDown, CheckCircle2, XCircle, Shield, Sparkles, AlertTriangle, Info, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { computeFinalAQI, ValidationResult, NormalizedAQIData, SourceAQIInfo } from '@/lib/aqiValidation';
import { HealthInsights } from '@/components/HealthInsights';
import { generateHealthRecommendations, RecommendationResult } from '@/lib/recommendationEngine';
import { predictFeelsLikeAQI, FeelsLikeResult, AQIHistoryPoint, computeFeelsLike, getAQIHistory, setAQIHistory } from '@/lib/feelsLikeEngine';
import { trainModel, TrainedModel } from '@/lib/mlRegression';
import { ReportModal } from '@/components/ReportModal';
import { GlobeBackground } from '@/components/GlobeBackground';

const CACHE_KEY = 'eco_pulse_cache_v4';
const MODEL_CACHE_KEY = 'eco_pulse_trained_model_v2';
const HISTORY_CACHE_KEY = 'eco_pulse_history_fetched_at';
const CACHE_TTL = 5 * 60 * 1000;
const MODEL_TTL = 24 * 60 * 60 * 1000; // Re-train once per day (30 days of data barely changes with 1 extra hour)
const HISTORY_TTL = 10 * 60 * 1000;

interface WeatherData {
  temp: number;
  humidity: number;
  wind_speed: number;
  pressure: number;
  aqi: number;
  pm25: number;
  pm10?: number;
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  location: string;
  provider: string;
}

interface CacheData {
  timestamp: number;
  providers: Record<string, WeatherData>;
  validated?: ValidationResult;
  recommendations?: RecommendationResult;
  pollutionScore?: number;
  feelsLike?: FeelsLikeResult;
}

interface CrowdsourceReportPayload {
  areaName: string;
  lat: number;
  lon: number;
  category: string;
  sources: Record<string, number>;
}

const PROVIDERS = [
  { id: 'validated', name: 'Validated Engine' },
  { id: 'openweather', name: 'OpenWeather' },
  { id: 'weatherapi', name: 'WeatherAPI.com' },
  { id: 'openmeteo', name: 'Open-Meteo' },
  { id: 'waqi', name: 'WAQI' },
  { id: 'apininjas', name: 'API-Ninjas' },
  { id: 'openaq', name: 'OpenAQ' },
  { id: 'datagovin', name: 'India Govt (CPCB)' },
];

export default function Home() {
  const [cache, setCache] = useState<CacheData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('validated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCoords, setLastCoords] = useState<{lat: number, lon: number} | null>(null);
  const [trendHistory, setTrendHistory] = useState<AQIHistoryPoint[]>([]);
  const [trainedModel, setTrainedModel] = useState<TrainedModel | null>(null);
  const [isTraining, setIsTraining] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [globeOpacity, setGlobeOpacity] = useState(0);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const isInitialLoading = loading && !cache;

  /**
   * ML Training Pipeline:
   * 1. Fetch 30 days of hourly (weather, AQI) from Open-Meteo
   * 2. Train OLS Linear Regression
   * 3. Cache the model
   */
  const trainMLModel = useCallback(async (lat: number, lon: number): Promise<TrainedModel | null> => {
    // Check cached model
    try {
      const cached = localStorage.getItem(MODEL_CACHE_KEY);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - parsed.trained_at < MODEL_TTL) {
          setTrainedModel(parsed.model);
          return parsed.model;
        }
      }
    } catch {}

    try {
      setIsTraining(true);
      const rLat = Math.round(lat * 10000) / 10000;
      const rLon = Math.round(lon * 10000) / 10000;

      const res = await fetch(`/api/training-data?lat=${rLat}&lon=${rLon}`);
      if (!res.ok) throw new Error('Failed to fetch training data');

      const { data, training_rows } = await res.json();
      if (!data || data.length < 50) {
        console.warn('Not enough training data:', training_rows);
        return null;
      }

      const model = trainModel(data);
      if (!model) {
        console.error('Model training failed');
        return null;
      }

      console.log('✅ Model trained:', {
        rows: model.training_rows,
        r2: model.r_squared,
        mae: model.mae,
        coefficients: model.coefficients,
      });

      // Cache the model
      localStorage.setItem(MODEL_CACHE_KEY, JSON.stringify({
        model,
        trained_at: Date.now(),
      }));

      setTrainedModel(model);
      return model;
    } catch (err) {
      console.error('ML training error:', err);
      return null;
    } finally {
      setIsTraining(false);
    }
  }, []);

  /**
   * Fetches 24hr historical data and computes Feels Like using trained model.
   */
  const fetchHistoricalData = useCallback(async (lat: number, lon: number, model: TrainedModel | null) => {
    if (!model) return;
    try {
      const lastFetch = localStorage.getItem(HISTORY_CACHE_KEY);
      const existingHistory = getAQIHistory();
      if (lastFetch && Date.now() - Number(lastFetch) < HISTORY_TTL && existingHistory.length > 10) {
        setTrendHistory(existingHistory);
        return;
      }

      const rLat = Math.round(lat * 10000) / 10000;
      const rLon = Math.round(lon * 10000) / 10000;

      const res = await fetch(`/api/history?lat=${rLat}&lon=${rLon}`);
      if (!res.ok) return;

      const { history } = await res.json();
      if (!history || history.length === 0) return;

      const historicalPoints: AQIHistoryPoint[] = history.map((h: {
        timestamp: number;
        aqi: number;
        temp: number;
        humidity: number;
        wind_speed: number;
        pressure: number;
      }) => ({
        timestamp: h.timestamp,
        aqi: h.aqi,
        feelsLike: computeFeelsLike(model, {
          aqi: h.aqi,
          temp: h.temp,
          humidity: h.humidity,
          wind_speed: h.wind_speed,
          pressure: h.pressure,
        }),
        temp: h.temp,
        humidity: h.humidity,
        wind_speed: h.wind_speed,
      }));

      setAQIHistory(historicalPoints);
      localStorage.setItem(HISTORY_CACHE_KEY, String(Date.now()));
      setTrendHistory(historicalPoints);
    } catch (err) {
      console.error('Failed to fetch historical data:', err);
    }
  }, []);

  const fetchAllData = useCallback(async (lat: number, lon: number, model: TrainedModel | null) => {
    try {
      setIsRefreshing(true);
      
      // Round coordinates to 4 decimal places to stabilize fetches
      const rLat = Math.round(lat * 10000) / 10000;
      const rLon = Math.round(lon * 10000) / 10000;

      const res = await fetch(`/api/data?lat=${rLat}&lon=${rLon}&provider=all`);
      if (!res.ok) throw new Error('Bulk fetch failed');

      const results = await res.json();
      
      // Filter out providers that returned errors
      const validResults: Record<string, WeatherData> = {};
      Object.entries(results as Record<string, WeatherData & { error?: string }>).forEach(([id, data]) => {
        if (id !== 'feels_like_penalty' && id !== 'pollution_score' && !data.error) {
          validResults[id] = data;
        }
      });

      const normalizedData: NormalizedAQIData[] = Object.entries(validResults).map(([id, data]) => ({
        source: id,
        aqi: data.aqi,
        pm25: data.pm25,
        pm10: data.pm10,
        co: data.co,
        no2: data.no2,
        o3: data.o3,
        so2: data.so2,
      }));

      const validatedResult = computeFinalAQI(normalizedData);

      const recommendations = generateHealthRecommendations({
        pm25: validatedResult.final_pm25,
        pm10: validatedResult.final_pm10 || 0,
        co: validatedResult.final_co || 0,
        no2: validatedResult.final_no2 || 0,
        o3: validatedResult.final_o3 || 0,
        so2: validatedResult.final_so2 || 0,
      });

      // Average weather from all APIs
      const allWindSpeeds = Object.values(validResults).map(d => d.wind_speed || 0);
      const avgWindSpeed = allWindSpeeds.reduce((a, b) => a + b, 0) / allWindSpeeds.length;
      const allPressures = Object.values(validResults).map(d => d.pressure || 1013);
      const avgPressure = allPressures.reduce((a, b) => a + b, 0) / allPressures.length;

      const primaryId = validatedResult.sources_used[0] || Object.keys(validResults)[0];
      const primaryWeather = validResults[primaryId];

      const pollutionScore = Number(results.pollution_score) || 0;

      let feelsLikeResult: FeelsLikeResult | undefined;

      if (model) {
        feelsLikeResult = predictFeelsLikeAQI({
          currentAQI: validatedResult.final_aqi,
          temp: primaryWeather?.temp || 0,
          humidity: primaryWeather?.humidity || 0,
          wind_speed: avgWindSpeed,
          pressure: avgPressure,
          pm25: validatedResult.final_pm25,
          model,
          pollutionScore,
        });
        setTrendHistory(feelsLikeResult.history);
      }

      const newCache: CacheData = {
        timestamp: Date.now(),
        providers: validResults,
        validated: validatedResult,
        recommendations,
        pollutionScore,
        feelsLike: feelsLikeResult,
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      setCache(newCache);
      setError(null);
      setGlobeOpacity(1);
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An unknown error occurred';
      setError(errorMessage);
      setGlobeOpacity(1);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  const getLocationAndFetch = useCallback((force = false) => {
    if (force && lastCoords) {
      // Re-train + re-fetch
      trainMLModel(lastCoords.lat, lastCoords.lon).then(model => {
        fetchAllData(lastCoords.lat, lastCoords.lon, model);
        fetchHistoricalData(lastCoords.lat, lastCoords.lon, model);
      });
      return;
    }

    setLoading(true);
    
    // Check cache for quick load
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved && !force) {
      try {
        const parsed: CacheData = JSON.parse(saved);
        if (Date.now() - parsed.timestamp < CACHE_TTL) {
          setCache(parsed);
          setTrendHistory(getAQIHistory());
          // Load cached model
          try {
            const modelCache = localStorage.getItem(MODEL_CACHE_KEY);
            if (modelCache) setTrainedModel(JSON.parse(modelCache).model);
          } catch {}
          setLoading(false);
          setGlobeOpacity(1);
          // Still get location silently so the globe can fly to the user's position
          navigator.geolocation?.getCurrentPosition((pos) => {
            setLastCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          });
          return;
        }
      } catch {}
    }

    if (!navigator.geolocation) {
      setError('Geolocation is not supported');
      setLoading(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = { lat: position.coords.latitude, lon: position.coords.longitude };
        setLastCoords(coords);

        // Pipeline: Train model → Fetch current data → Fetch history
        trainMLModel(coords.lat, coords.lon).then(model => {
          fetchAllData(coords.lat, coords.lon, model);
          fetchHistoricalData(coords.lat, coords.lon, model);
        });
      },
      () => {
        setError('Location access denied. Please enable location services.');
        setLoading(false);
      }
    );
  }, [lastCoords, fetchAllData, fetchHistoricalData, trainMLModel]);

  // Grab location immediately on mount so the globe can spin → fly right away,
  // completely independent of the API data fetch timeline.
  useEffect(() => {
    navigator.geolocation?.getCurrentPosition((pos) => {
      setLastCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
    });
  }, []);

  useEffect(() => {
    getLocationAndFetch();

    refreshIntervalRef.current = setInterval(() => {
      if (lastCoords && trainedModel) {
        fetchAllData(lastCoords.lat, lastCoords.lon, trainedModel);
      }
    }, CACHE_TTL);

    return () => {
      if (refreshIntervalRef.current) clearInterval(refreshIntervalRef.current);
    };
  }, []);

  const handleReportSubmit = async (payload: CrowdsourceReportPayload) => {
    const res = await fetch('/api/crowdsource', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Failed to submit report' }));
      throw new Error(err.error || 'Failed to submit report');
    }

    // Re-fetch data immediately when a new report is submitted
    getLocationAndFetch(true);
  };

  // Active data based on provider selection
  let activeData: WeatherData | null = null;

  if (selectedProvider === 'validated' && cache?.validated) {
    const primaryId = cache.validated.sources_used[0] || Object.keys(cache.providers)[0];
    const primary = cache.providers[primaryId];
    activeData = {
      ...primary,
      aqi: cache.validated.final_aqi,
      pm25: cache.validated.final_pm25,
      pm10: cache.validated.final_pm10 || 0,
      co: cache.validated.final_co || 0,
      no2: cache.validated.final_no2 || 0,
      o3: cache.validated.final_o3 || 0,
      so2: cache.validated.final_so2 || 0,
      provider: 'Validated Consensus'
    };
  } else {
    activeData = cache?.providers[selectedProvider] || (cache ? Object.values(cache.providers)[0] : null);
  }
  const lastUpdated = cache ? new Date(cache.timestamp).toLocaleTimeString() : '';
  const isFromCache = cache ? (Date.now() - cache.timestamp < CACHE_TTL) : false;

  return (
    <main className="flex flex-col items-center justify-center min-h-screen p-6 md:p-24 overflow-hidden relative">
      {/* Persistent globe – always rendered, never blocked */}
      <GlobeBackground opacity={globeOpacity} coords={lastCoords} />

      {/* Small unobtrusive loading badge – doesn't cover the globe */}
      {isInitialLoading && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 40,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1.25rem',
          borderRadius: '999px',
          background: 'rgba(15,23,42,0.75)',
          backdropFilter: 'blur(12px)',
          border: '1px solid rgba(255,255,255,0.1)',
          color: 'rgba(255,255,255,0.6)',
          fontSize: '0.75rem',
          fontWeight: 600,
          letterSpacing: '0.05em',
          pointerEvents: 'none',
        }}>
          <Loader2 className="animate-spin" size={14} style={{ color: '#60a5fa' }} />
          Syncing data sources...
        </div>
      )}

      {/* Decorative blobs */}
      <div className="absolute top-[-10%] right-[-10%] w-[400px] h-[400px] bg-blue-600/20 blur-[100px] rounded-full" />
      <div className="absolute bottom-[-10%] left-[-10%] w-[400px] h-[400px] bg-purple-600/20 blur-[100px] rounded-full" />

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="z-10 w-full max-w-4xl"
      >
        <header className="flex flex-col md:flex-row items-center justify-between mb-12 gap-6 bg-white/5 p-6 rounded-3xl border border-white/10 backdrop-blur-sm">
          <div className="text-left">
            <h1 className="text-3xl font-black tracking-tighter bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
              Apna AQI
            </h1>
            <p className="text-white/40 text-sm font-medium">Multi-Source Intelligence</p>
          </div>

          <div className="flex flex-wrap items-center gap-4">
            {(isTraining) && (
              <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-amber-400/70 animate-pulse">
                <Loader2 className="animate-spin w-3 h-3" />
                Training ML Model...
              </div>
            )}
            {cache && (
              <div className="flex flex-col items-end mr-2">
                <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-widest text-white/30 mb-1">
                  {isRefreshing ? <Loader2 className="animate-spin w-3 h-3" /> : <Clock className="w-3 h-3" />}
                  {isRefreshing ? 'Updating...' : isFromCache ? 'Live Cache' : 'Fetched'}
                </div>
                <span className="text-xs text-white/60 font-medium">Last: {lastUpdated}</span>
              </div>
            )}

            <div className="relative group">
              <select
                value={selectedProvider}
                onChange={(e) => setSelectedProvider(e.target.value)}
                className="appearance-none bg-white/10 border border-white/20 text-white text-sm rounded-2xl px-5 py-3 pr-10 hover:bg-white/20 transition-all cursor-pointer outline-none focus:ring-2 focus:ring-blue-500/50"
              >
                {PROVIDERS.map(p => (
                  <option key={p.id} value={p.id} className="bg-slate-900">{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 text-white/40 pointer-events-none group-hover:text-white/70 transition-colors" size={16} />
            </div>

            <button
              onClick={() => getLocationAndFetch(true)}
              disabled={isRefreshing || isTraining}
              className="p-3 bg-white text-slate-900 rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50 shadow-lg shadow-white/5"
            >
              <RefreshCw className={`${isRefreshing || isTraining ? 'animate-spin' : ''}`} size={20} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading && !cache ? (
            <motion.div key="loading" className="flex flex-col items-center justify-center gap-4 min-h-[400px]">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              <p className="text-white/40 font-medium animate-pulse">
                {isTraining ? 'Training ML model on 30 days of data...' : 'Syncing atmospheric & validation data...'}
              </p>
            </motion.div>
          ) : error && !cache ? (
            <motion.div key="error" className="flex flex-col items-center justify-center gap-6 glass p-10 rounded-3xl border-red-500/20 max-w-md mx-auto text-center">
              <AlertCircle className="text-red-400 w-16 h-16" />
              <p className="text-white/60">{error}</p>
              <button onClick={() => getLocationAndFetch(true)} className="px-8 py-3 bg-white text-slate-900 rounded-full font-bold">Retry</button>
            </motion.div>
          ) : activeData ? (
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8 items-center w-full">
              <div className="flex flex-col lg:flex-row gap-8 w-full items-stretch justify-center h-full">
                <div className="flex-1">
                  <WeatherCard 
                    temp={activeData.temp} 
                    humidity={activeData.humidity} 
                    aqi={activeData.aqi}
                    location={activeData.location || 'Unknown'} 
                  />
                </div>
                <div className="flex-[1.5]">
                  <AQICard
                    aqi={activeData.aqi}
                    pm25={activeData.pm25}
                    pm10={activeData.pm10}
                    co={activeData.co}
                    no2={activeData.no2}
                    o3={activeData.o3}
                    so2={activeData.so2}
                    isValidated={selectedProvider === 'validated'}
                  />
                </div>
              </div>

              {cache?.recommendations && (
                <HealthInsights data={cache.recommendations} />
              )}

              {/* ====== VALIDATION ENGINE ====== */}
              {selectedProvider === 'validated' && cache?.validated && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-4xl bg-white/5 border border-white/10 rounded-[2rem] p-8 backdrop-blur-sm"
                >
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-3 bg-indigo-500/10 text-indigo-400 rounded-2xl border border-indigo-500/20">
                      <Shield size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black tracking-tight text-white">Validation Engine</h2>
                      <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.15em]">
                        {cache.validated.validation_method}
                      </p>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/30">Confidence</span>
                      <span className={`text-sm font-black ${
                        cache.validated.confidence_score > 0.9 ? 'text-green-400' : 
                        cache.validated.confidence_score > 0.7 ? 'text-yellow-400' : 'text-red-400'
                      }`}>
                        {(cache.validated.confidence_score * 100).toFixed(0)}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-start gap-2 mb-6 p-3 bg-white/5 rounded-xl border border-white/5">
                    <Info size={14} className="text-white/30 mt-0.5 shrink-0" />
                    <p className="text-[11px] text-white/40 leading-relaxed">
                      We fetch AQI from <strong className="text-white/60">multiple independent APIs</strong> and compute each source&apos;s US AQI from PM2.5 concentration. 
                      Then we run <strong className="text-white/60">IQR (Interquartile Range)</strong> to remove statistical outliers and 
                      <strong className="text-white/60"> Cosine Similarity</strong> to check if each source&apos;s pollutant pattern matches the group consensus. 
                      Sources that fail either check are discarded. The final AQI is the mean of the remaining trusted sources.
                    </p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-5">
                    {cache.validated.per_source_info.map((source: SourceAQIInfo) => {
                      const providerName = PROVIDERS.find(p => p.id === source.source)?.name || source.source;
                      return (
                        <div 
                          key={source.source}
                          className={`relative p-5 rounded-2xl border transition-all ${
                            source.used ? 'bg-green-500/5 border-green-500/20' : 'bg-red-500/5 border-red-500/20 opacity-50'
                          }`}
                        >
                          <div className={`absolute top-3 right-3 flex items-center gap-1 text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${
                            source.used ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'
                          }`}>
                            {source.used ? <CheckCircle2 size={8} /> : <XCircle size={8} />}
                            {source.used ? 'Used' : 'Discarded'}
                          </div>
                          <span className="text-[10px] font-bold text-white/40 uppercase tracking-wider">{providerName}</span>
                          <div className="mt-2 mb-3">
                            <span className={`text-3xl font-black ${source.used ? 'text-white' : 'text-white/30 line-through'}`}>{source.aqi}</span>
                            <span className="text-[10px] text-white/20 ml-1 font-bold">US AQI</span>
                          </div>
                          <div className="flex flex-col gap-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-white/30 font-medium">IQR Check</span>
                              <span className={`text-[9px] font-bold ${source.iqr_passed ? 'text-green-400' : 'text-red-400'}`}>
                                {source.iqr_passed ? '✓ Passed' : '✗ Outlier'}
                              </span>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-[9px] text-white/30 font-medium">Cosine Similarity</span>
                              <span className={`text-[9px] font-bold ${source.cosine_passed ? 'text-green-400' : 'text-red-400'}`}>
                                {source.cosine_passed ? '✓' : '✗'} {(source.similarity_score * 100).toFixed(0)}%
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  <div className="flex items-center justify-center gap-4 pt-4 border-t border-white/5">
                    <Sparkles size={16} className="text-amber-400" />
                    <span className="text-xs font-bold uppercase tracking-widest text-white/40">Final Validated AQI:</span>
                    <span className="text-2xl font-black text-white">{cache.validated.final_aqi}</span>
                    <span className="text-[10px] text-white/30 font-medium">
                      (from {cache.validated.sources_used.length} of {cache.validated.per_source_info.length} sources)
                    </span>
                  </div>
                </motion.div>
              )}

              {/* ====== FEELS LIKE AQI ====== */}
              {cache?.feelsLike && (
                <FeelsLikeAQI data={cache.feelsLike} />
              )}

              {/* ====== POLLUTION SCORE BADGE ====== */}
              {cache?.pollutionScore !== undefined && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-4xl flex items-center gap-4 p-5 bg-white/5 border border-white/10 rounded-2xl backdrop-blur-sm"
                >
                  <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl border border-orange-500/20">
                    <Users size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold text-white/70">Crowdsourced Pollution Score</div>
                    <p className="text-[10px] text-white/30 mt-0.5">Based on recent local condition reports from users in your area</p>
                  </div>
                  <div className="text-right">
                    <span className={`text-2xl font-black ${cache.pollutionScore > 50 ? 'text-red-400' : cache.pollutionScore > 20 ? 'text-orange-400' : 'text-yellow-400'}`}>
                      {cache.pollutionScore}
                    </span>
                    <span className="text-[10px] text-white/30 ml-1 font-bold">/100</span>
                  </div>
                </motion.div>
              )}

              {/* ====== TIME SERIES CHART ====== */}
              <TimeSeriesChart history={trendHistory} />

              <div className="flex items-center gap-2 px-4 py-2 bg-white/5 rounded-full border border-white/10 backdrop-blur-sm">
                <Database size={14} className="text-blue-400" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-white/40">
                  Data Engine: <span className="text-white/80">{activeData.provider}</span>
                </span>
              </div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </motion.div>

      {/* FAB */}
      {lastCoords && (
        <button
          onClick={() => setIsModalOpen(true)}
          className="fixed bottom-6 right-6 md:bottom-12 md:right-12 bg-gradient-to-tr from-blue-600 to-purple-600 text-white px-6 py-4 rounded-full shadow-2xl shadow-blue-500/30 font-bold z-40 transition-transform hover:scale-105 flex items-center gap-2 border border-white/20 backdrop-blur-md"
        >
          <AlertTriangle size={18} />
          <span className="hidden md:inline">Report Conditions</span>
          <span className="md:hidden">Report</span>
        </button>
      )}

      {lastCoords && (
        <ReportModal
          isOpen={isModalOpen}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleReportSubmit}
          lat={lastCoords.lat}
          lon={lastCoords.lon}
        />
      )}
    </main>
  );
}
