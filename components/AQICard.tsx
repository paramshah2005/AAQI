import React from 'react';
import { Wind, Activity, Zap, Beaker, Cloud, Thermometer } from 'lucide-react';
import { motion } from 'framer-motion';
import { getAQICategory } from '@/lib/aqiUtils';

interface AQICardProps {
  aqi: number;
  pm25: number;
  pm10?: number;
  co?: number;
  no2?: number;
  o3?: number;
  so2?: number;
  isValidated?: boolean;
}

export const AQICard: React.FC<AQICardProps> = ({ 
  aqi, 
  pm25, 
  pm10, 
  co, 
  no2, 
  o3, 
  so2,
  isValidated = true
}) => {
  const getAQIInfo = (val: number) => {
    if (val <= 1) return { label: 'Good', color: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-500/20' };
    if (val <= 3) return { label: 'Moderate', color: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500/20' };
    return { label: 'Unhealthy', color: 'bg-red-500', text: 'text-red-500', bg: 'bg-red-500/20' };
  };

  const info = getAQIInfo(aqi);

  const pollutants = [
    { label: 'PM2.5', value: pm25, unit: 'µg/m³', icon: Activity, color: 'text-blue-400' },
    { label: 'PM10', value: pm10, unit: 'µg/m³', icon: Cloud, color: 'text-purple-400' },
    { label: 'NO2', value: no2, unit: 'ppb', icon: Zap, color: 'text-orange-400' },
    { label: 'O3', value: o3, unit: 'ppb', icon: Beaker, color: 'text-emerald-400' },
    { label: 'CO', value: co, unit: 'mg/m³', icon: Thermometer, color: 'text-rose-400' },
    { label: 'SO2', value: so2, unit: 'ppb', icon: Wind, color: 'text-cyan-400' },
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl text-white w-full max-w-2xl h-full flex flex-col"
    >
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-2 text-white/70">
          <Wind size={18} />
          <span className="text-sm font-medium tracking-wide uppercase">Pollutant Analysis</span>
        </div>
        <div className={`px-4 py-1.5 rounded-full ${info.bg} ${info.color} text-[10px] font-black uppercase tracking-[0.2em] border border-white/5`}>
          {info.label}
        </div>
      </div>

      {/* Pollutant Grid (3x2) */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 flex-1 w-full">
          {pollutants.map((p) => (
            <div key={p.label} className="flex flex-col gap-2 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all group">
              <div className="flex items-center justify-between">
                <div className={`p-1.5 rounded-lg bg-white/5`}>
                  <p.icon size={16} className={`${p.color} opacity-70 group-hover:opacity-100 transition-opacity`} />
                </div>
                <span className="text-xs font-bold text-white/30 uppercase tracking-widest">{p.label}</span>
              </div>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-2xl font-black tracking-tight">{p.value !== undefined && p.value !== null ? p.value : '--'}</span>
                <span className="text-xs text-white/20 font-bold uppercase">{p.unit}</span>
              </div>
            </div>
          ))}
      </div>
    </motion.div>
  );
};
