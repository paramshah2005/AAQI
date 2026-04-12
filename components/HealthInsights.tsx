import React from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, CheckCircle, Info, Activity } from 'lucide-react';
import { RecommendationResult } from '@/lib/recommendationEngine';

interface HealthInsightsProps {
  data: RecommendationResult;
}

export const HealthInsights: React.FC<HealthInsightsProps> = ({ data }) => {
  const { overall, alerts, severity } = data;

  const severityConfig = {
    low: {
      color: 'text-green-400',
      bg: 'bg-green-500/10',
      border: 'border-green-500/20',
      icon: CheckCircle,
      label: 'Optimal'
    },
    moderate: {
      color: 'text-yellow-400',
      bg: 'bg-yellow-500/10',
      border: 'border-yellow-500/20',
      icon: Info,
      label: 'Caution'
    },
    high: {
      color: 'text-red-400',
      bg: 'bg-red-500/10',
      border: 'border-red-500/20',
      icon: AlertTriangle,
      label: 'Critical'
    }
  };

  const config = severityConfig[severity];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[2rem] shadow-2xl mt-12 overflow-hidden relative"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${config.bg} blur-[60px] rounded-full`} />
      
      <div className="flex flex-col md:flex-row items-center justify-between mb-8 gap-6 z-10 relative">
        <div className="flex items-center gap-4">
          <div className={`p-4 ${config.bg} ${config.color} rounded-2xl border ${config.border}`}>
            <config.icon size={28} />
          </div>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-white mb-1">Health Insights</h2>
            <div className={`flex items-center gap-2 ${config.color} text-[10px] font-black uppercase tracking-[0.2em]`}>
              <Activity size={12} />
              {config.label} Status
            </div>
          </div>
        </div>
        
        <div className="flex-1 md:max-w-md text-center md:text-right">
          <p className="text-white/80 font-medium leading-relaxed italic">
            "{overall}"
          </p>
        </div>
      </div>

      {alerts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6 z-10 relative">
          {alerts.map((alert, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              className="flex items-start gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-colors group"
            >
              <div className={`mt-1 p-1.5 ${config.bg} ${config.color} rounded-lg`}>
                <AlertTriangle size={14} />
              </div>
              <p className="text-sm text-white/60 leading-relaxed group-hover:text-white/80 transition-colors">
                {alert}
              </p>
            </motion.div>
          ))}
        </div>
      )}

      {alerts.length === 0 && (
        <div className="flex items-center justify-center p-12 bg-white/5 border border-white/5 border-dashed rounded-[2rem] z-10 relative">
          <div className="flex flex-col items-center gap-3 text-white/20">
            <CheckCircle size={48} />
            <span className="text-sm font-bold uppercase tracking-widest">No Active Alerts</span>
          </div>
        </div>
      )}
    </motion.div>
  );
};
