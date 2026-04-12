'use client';

import React, { useState } from 'react';
import { Thermometer, Droplets, MapPin, Wind } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAQICategory } from '@/lib/aqiUtils';

interface WeatherCardProps {
  temp: number;
  humidity: number;
  aqi: number;
  location: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ temp, humidity, aqi, location }) => {
  const [isFahrenheit, setIsFahrenheit] = useState(false);

  const displayTemp = isFahrenheit ? Math.round(temp * 9 / 5 + 32) : temp;
  const unit = isFahrenheit ? '°F' : '°C';

  const aqiInfo = getAQICategory(aqi);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-slate-900/40 backdrop-blur-xl border border-white/10 p-6 rounded-3xl shadow-2xl text-white w-full h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-6 text-white/90">
        <MapPin size={18} />
        <span className="text-sm font-medium tracking-wide uppercase">{location || 'Your Location'}</span>
      </div>

      <div className="flex flex-col gap-5 flex-1 justify-around">
        {/* Temperature with C/F toggle */}
        <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <div className="flex items-baseline gap-1">
              <span className="text-7xl font-black tracking-tighter">{displayTemp}</span>
              <span className="text-2xl font-bold text-white/50">{unit}</span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">Temperature</span>
              <button
                onClick={() => setIsFahrenheit(!isFahrenheit)}
                className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-white/50 hover:bg-white/20 hover:text-white/80 transition-all"
              >
                {isFahrenheit ? '°C' : '°F'}
              </button>
            </div>
          </div>
          <div className="p-4 bg-orange-500/20 rounded-2xl border border-orange-500/10">
            <Thermometer className="text-orange-500" size={32} />
          </div>
        </div>

        {/* AQI — Real US AQI value */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15 }}
          className={`flex justify-between items-center ${aqiInfo.bg} p-6 rounded-2xl border ${aqiInfo.border}`}
        >
          <div className="flex flex-col">
            <span className={`text-6xl font-black tracking-tighter ${aqiInfo.color}`}>{aqi}</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">US AQI</span>
              <span className={`text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${aqiInfo.bg} ${aqiInfo.color} border ${aqiInfo.border}`}>
                {aqiInfo.label}
              </span>
            </div>
          </div>
          <div className={`p-4 ${aqiInfo.iconBg} rounded-2xl border ${aqiInfo.border}`}>
            <Wind className={aqiInfo.color} size={32} />
          </div>
        </motion.div>

        {/* Humidity */}
        <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-5xl font-black tracking-tight">{humidity}%</span>
            <span className="text-white/70 text-[10px] font-bold uppercase tracking-widest mt-1">Humidity</span>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/10">
            <Droplets className="text-blue-500" size={32} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
