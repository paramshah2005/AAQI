'use client';

import { useState, useEffect } from 'react';
import { WeatherCard } from '@/components/WeatherCard';
import { AQICard } from '@/components/AQICard';
import { Loader2, RefreshCw, AlertCircle, Database, Clock, ChevronDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const CACHE_KEY = 'eco_pulse_cache';
const CACHE_TTL = 5 * 60 * 1000; 

interface WeatherData {
  temp: number;
  humidity: number;
  aqi: number;
  pm25: number;
  location: string;
  provider: string;
}

interface CacheData {
  timestamp: number;
  providers: Record<string, WeatherData>;
}

const PROVIDERS = [
  { id: 'openweather', name: 'OpenWeather' },
  { id: 'weatherapi', name: 'WeatherAPI.com' },
  { id: 'openmeteo', name: 'Open-Meteo' },
];

export default function Home() {
  const [cache, setCache] = useState<CacheData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState('openweather');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchAllData = async (lat: number, lon: number) => {
    try {
      setIsRefreshing(true);
      const results: Record<string, WeatherData> = {};
      
      const fetchPromises = PROVIDERS.map(async (p) => {
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

      if (Object.keys(results).length === 0) {
        throw new Error('All weather providers failed to fetch data');
      }

      const newCache = {
        timestamp: Date.now(),
        providers: results
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
    setLoading(true);
    
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
        fetchAllData(position.coords.latitude, position.coords.longitude);
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

  const activeData = cache?.providers[selectedProvider] || (cache ? Object.values(cache.providers)[0] : null);
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
              Eco Pulse
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
            <motion.div key="content" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-8 items-center">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full items-stretch justify-items-center">
                <WeatherCard 
                  temp={activeData.temp} 
                  humidity={activeData.humidity} 
                  location={activeData.location || 'Unknown'} 
                />
                <AQICard 
                  aqi={activeData.aqi} 
                  pm25={activeData.pm25} 
                />
              </div>

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
