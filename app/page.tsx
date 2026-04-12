'use client';

import { useState, useEffect } from 'react';
import { WeatherCard } from '@/components/WeatherCard';
import { AQICard } from '@/components/AQICard';
import { Loader2, RefreshCw, AlertCircle, Database, Clock, ChevronDown, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { computeFinalAQI, ValidationResult, NormalizedAQIData } from '@/lib/aqiValidation';
import { HealthInsights } from '@/components/HealthInsights';
import { generateHealthRecommendations, RecommendationResult } from '@/lib/recommendationEngine';

const CACHE_KEY = 'apna_aqi_cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes in ms

interface WeatherData {
  temp: number;
  humidity: number;
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
}

const PROVIDERS = [
  { id: 'validated', name: 'Validated Engine' },
  { id: 'openweather', name: 'OpenWeather' },
  { id: 'weatherapi', name: 'WeatherAPI.com' },
  { id: 'openmeteo', name: 'Open-Meteo' },
];

export default function Home() {
  const [cache, setCache] = useState<CacheData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('validated');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastCoords, setLastCoords] = useState<{lat: number, lon: number} | null>(null);

  const fetchAllData = async (lat: number, lon: number) => {
    try {
      setIsRefreshing(true);
      const results: Record<string, WeatherData> = {};
      
      // Fetch all providers in parallel (skipping 'validated' which is client-side only)
      const fetchPromises = PROVIDERS
        .filter(p => p.id !== 'validated')
        .map(async (p) => {
        try {
          const res = await fetch(`/api/data?lat=${lat}&lon=${lon}&provider=${p.id}`);
          if (!res.ok) return null;
          return { id: p.id, data: await res.json() };
        } catch {
          return null;
        }
      });

      const responses = await Promise.all(fetchPromises);
      responses.forEach((r) => {
        if (r && !r.data.error) {
          results[r.id] = r.data;
        }
      });

      // Perform Multi-Pollutant Validation
      const normalizedData: NormalizedAQIData[] = Object.entries(results).map(([id, data]) => ({
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

      const newCache: CacheData = {
        timestamp: Date.now(),
        providers: results,
        validated: validatedResult,
        recommendations
      };

      localStorage.setItem(CACHE_KEY, JSON.stringify(newCache));
      setCache(newCache);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
      setIsRefreshing(false);
    }
  };

  const getLocationAndFetch = (force = false) => {
    // If we have coords and it's a forced refresh, fetch immediately
    if (force && lastCoords) {
      fetchAllData(lastCoords.lat, lastCoords.lon);
      return;
    }

    setLoading(true);
    
    // Check Cache first
    const saved = localStorage.getItem(CACHE_KEY);
    if (saved && !force) {
      const parsed: CacheData = JSON.parse(saved);
      if (Date.now() - parsed.timestamp < CACHE_TTL) {
        setCache(parsed);
        setLoading(false);
        return;
      }
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
        fetchAllData(coords.lat, coords.lon);
      },
      (err) => {
        setError('Location access denied. Please enable location services.');
        setLoading(false);
      }
    );
  };

  useEffect(() => {
    getLocationAndFetch();
  }, []);

  // Handle displayed data based on selection
  let activeData: WeatherData | null = null;
  
  if (selectedProvider === 'validated' && cache?.validated) {
    // For validated engine, we use its consensus pollutants but need temp/humidity/location from a primary provider
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
              disabled={isRefreshing}
              className="p-3 bg-white text-slate-900 rounded-xl hover:bg-blue-50 transition-all disabled:opacity-50 shadow-lg shadow-white/5"
            >
              <RefreshCw className={`${isRefreshing ? 'animate-spin' : ''}`} size={20} />
            </button>
          </div>
        </header>

        <AnimatePresence mode="wait">
          {loading && !cache ? (
            <motion.div key="loading" className="flex flex-col items-center justify-center gap-4 min-h-[400px]">
              <Loader2 className="w-12 h-12 text-blue-400 animate-spin" />
              <p className="text-white/40 font-medium animate-pulse">Syncing satellite data...</p>
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

              {selectedProvider === 'validated' && cache?.validated && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-2xl bg-white/5 border border-white/10 rounded-2xl p-4 backdrop-blur-sm"
                >
                  <div className="flex flex-wrap items-center justify-center gap-6">
                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Sources Included:</span>
                      <div className="flex gap-2">
                        {cache.validated.sources_used.map(s => (
                          <div key={s} className="flex items-center gap-1 bg-green-500/10 text-green-400 text-[10px] px-2 py-1 rounded-md border border-green-500/20 uppercase font-bold">
                            <CheckCircle2 size={10} />
                            {s}
                          </div>
                        ))}
                      </div>
                    </div>
                    
                    {cache.validated.sources_discarded.length > 0 && (
                      <div className="flex items-center gap-3 border-l border-white/10 pl-6">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-white/40">Outliers Removed:</span>
                        <div className="flex gap-2">
                          {cache.validated.sources_discarded.map(s => (
                            <div key={s} className="flex items-center gap-1 bg-red-500/10 text-red-400 text-[10px] px-2 py-1 rounded-md border border-red-500/20 uppercase font-bold">
                              <XCircle size={10} />
                              {s}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

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
    </main>
  );
}
