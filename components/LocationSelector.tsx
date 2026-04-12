'use client';

import { useState, useEffect, useRef } from 'react';
import { Search, MapPin, Loader2, X, Navigation } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface LocationResult {
  name: string;
  lat: number;
  lon: number;
}

interface LocationSelectorProps {
  onSelect: (lat: number, lon: number, name: string) => void;
  onReset?: () => void;
  isManual: boolean;
}

export function LocationSelector({ onSelect, onReset, isManual }: LocationSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 3) {
      setResults([]);
      setIsOpen(false);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/location-search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setResults(data.results || []);
        if (data.results?.length > 0) setIsOpen(true);
      } catch (err) {
        console.error('Search failed:', err);
      } finally {
        setLoading(false);
      }
    }, 600);

    return () => clearTimeout(timer);
  }, [query]);

  return (
    <div className="relative z-[60] w-full min-w-[200px] md:min-w-[300px]" ref={containerRef}>
      <div className="relative group">
        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-white/30 group-focus-within:text-blue-400 transition-colors pointer-events-none">
          {loading ? <Loader2 size={16} className="animate-spin" /> : <Search size={16} />}
        </div>
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            if (e.target.value.length >= 3) setIsOpen(true);
          }}
          onFocus={() => {
            if (results.length > 0) setIsOpen(true);
          }}
          placeholder="Search global cities..."
          className="w-full bg-white/5 border border-white/10 text-white text-sm rounded-2xl pl-11 pr-10 py-3 hover:bg-white/10 transition-all outline-none focus:ring-2 focus:ring-blue-500/50 backdrop-blur-md placeholder:text-white/20"
        />
        {isManual && (
           <button 
             onClick={() => {
               setQuery('');
               onReset?.();
             }}
             className="absolute right-3 top-1/2 -translate-y-1/2 p-1.5 bg-blue-500/10 hover:bg-blue-500/20 rounded-lg text-blue-400 transition-all flex items-center gap-1.5"
             title="Reset to current location"
           >
             <Navigation size={12} fill="currentColor" />
             <span className="text-[10px] font-bold uppercase tracking-wider hidden sm:inline">Auto</span>
           </button>
        )}
      </div>

      <AnimatePresence>
        {isOpen && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            className="absolute top-full left-0 w-full mt-3 bg-slate-900/90 border border-white/10 rounded-2xl shadow-2xl backdrop-blur-xl overflow-hidden z-[70]"
          >
            <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
              {results.map((r, i) => (
                <button
                  key={i}
                  onClick={() => {
                    onSelect(r.lat, r.lon, r.name);
                    const cleanName = r.name.split(',')[0];
                    setQuery(cleanName);
                    setIsOpen(false);
                    setResults([]);
                  }}
                  className="w-full flex items-start gap-3 p-4 hover:bg-white/10 text-left border-b border-white/5 last:border-0 transition-colors group/item"
                >
                  <div className="p-2 bg-blue-500/10 text-blue-400 rounded-lg group-hover/item:bg-blue-500/20 transition-colors mt-0.5">
                    <MapPin size={14} />
                  </div>
                  <div className="flex-1 overflow-hidden">
                    <p className="text-sm font-bold text-white line-clamp-1">{r.name.split(',')[0]}</p>
                    <p className="text-[10px] text-white/30 line-clamp-1 mt-0.5">{r.name.split(',').slice(1).join(',').trim()}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="p-2 bg-white/[0.02] border-t border-white/5 text-center">
               <p className="text-[8px] font-bold uppercase tracking-[0.2em] text-white/20">Powered by OpenStreetMap</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
