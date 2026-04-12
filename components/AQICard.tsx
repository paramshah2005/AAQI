import React from 'react';
import { Wind, Info } from 'lucide-react';
import { motion } from 'framer-motion';

interface AQICardProps {
  aqi: number; 
  pm25: number;
}

export const AQICard: React.FC<AQICardProps> = ({ aqi, pm25 }) => {
  const getAQIInfo = (val: number) => {
    switch (val) {
      case 1:
        return { label: 'Good', color: 'bg-green-500', text: 'text-green-500', bg: 'bg-green-500/20' };
      case 2:
      case 3:
        return { label: 'Moderate', color: 'bg-yellow-500', text: 'text-yellow-500', bg: 'bg-yellow-500/20' };
      case 4:
      case 5:
        return { label: 'Unhealthy', color: 'bg-red-500', text: 'text-red-500', bg: 'bg-red-500/20' };
      default:
        return { label: 'Unknown', color: 'bg-gray-500', text: 'text-gray-500', bg: 'bg-gray-500/20' };
    }
  };

  const info = getAQIInfo(aqi);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="bg-white/10 backdrop-blur-md border border-white/20 p-6 rounded-3xl shadow-2xl text-white w-full max-w-sm h-full flex flex-col"
    >
      <div className="flex items-center gap-2 mb-6 text-white/70">
        <Wind size={18} />
        <span className="text-sm font-medium tracking-wide uppercase">Air Quality Index</span>
      </div>

      <div className="flex flex-col gap-8 flex-1 justify-between">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className={`px-3 py-1 rounded-full ${info.bg} ${info.text} text-xs font-bold uppercase w-fit mb-2`}>
              {info.label}
            </div>
            <span className="text-6xl font-bold tracking-tighter">{aqi}</span>
            <span className="text-white/50 text-sm mt-1">OpenWeather AQI (1-5)</span>
          </div>
          <div className={`p-4 ${info.bg} rounded-2xl`}>
            <Wind className={info.text} size={32} />
          </div>
        </div>

        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-3xl font-semibold tracking-tight">{pm25.toFixed(1)} <span className="text-sm font-normal text-white/50">µg/m³</span></span>
            <span className="text-white/50 text-sm mt-1">PM2.5 Concentration</span>
          </div>
          <div className="p-4 bg-purple-500/20 rounded-2xl">
            <Info className="text-purple-500" size={32} />
          </div>
        </div>
      </div>
    </motion.div>
  );
};
