import React from 'react';
import { Thermometer, Droplets, MapPin } from 'lucide-react';
import { motion } from 'framer-motion';

interface WeatherCardProps {
  temp: number;
  humidity: number;
  location: string;
}

export const WeatherCard: React.FC<WeatherCardProps> = ({ temp, humidity, location }) => {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl text-white w-full h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-6 text-white/70">
        <MapPin size={18} />
        <span className="text-sm font-medium tracking-wide uppercase">{location || 'Your Location'}</span>
      </div>

      <div className="flex flex-col gap-12 flex-1 justify-around">
        <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-7xl font-black tracking-tighter">{temp}°</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Temperature</span>
          </div>
          <div className="p-4 bg-orange-500/20 rounded-2xl border border-orange-500/10">
            <Thermometer className="text-orange-500" size={32} />
          </div>
        </div>
        
        <div className="flex justify-between items-center bg-white/5 p-6 rounded-2xl border border-white/5">
          <div className="flex flex-col">
            <span className="text-5xl font-black tracking-tight">{humidity}%</span>
            <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest mt-1">Humidity</span>
          </div>
          <div className="p-4 bg-blue-500/20 rounded-2xl border border-blue-500/10">
            <Droplets className="text-blue-500" size={32} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
