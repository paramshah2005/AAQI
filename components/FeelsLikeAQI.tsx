'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TrendingUp, TrendingDown, Equal, Brain, Wind, Droplets, Thermometer, Activity, Gauge, ChevronDown, ChevronUp, AlertTriangle } from 'lucide-react';
import { FeelsLikeResult } from '@/lib/feelsLikeEngine';
import { getAQICategory } from '@/lib/aqiUtils';

interface FeelsLikeAQIProps {
  data: FeelsLikeResult;
}

const factorIcons: Record<string, React.ElementType> = {
  'Wind Speed': Wind,
  'Humidity': Droplets,
  'Temperature': Thermometer,
  'Atm. Pressure': Gauge,
  'Local Pollution Activity': AlertTriangle,
};

export const FeelsLikeAQI: React.FC<FeelsLikeAQIProps> = ({ data }) => {
  const { feelsLikeAQI, currentAQI, trend, trendDelta, factors, model } = data;
  const [showMLDetails, setShowMLDetails] = useState(false);

  const TrendIcon = trend === 'better' ? TrendingDown : trend === 'worse' ? TrendingUp : Equal;
  const trendColor = trend === 'better' ? 'text-green-400' : trend === 'worse' ? 'text-red-400' : 'text-white/50';
  const trendBg = trend === 'better' ? 'bg-green-500/10 border-green-500/20' : trend === 'worse' ? 'bg-red-500/10 border-red-500/20' : 'bg-white/5 border-white/10';
  const trendLabel = trend === 'better' ? 'Feels Better' : trend === 'worse' ? 'Feels Worse' : 'Feels Similar';

  const currentCategory = getAQICategory(currentAQI);
  const feelsCategory = getAQICategory(feelsLikeAQI);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[2rem] shadow-2xl overflow-hidden relative"
    >
      <div className="absolute top-0 left-0 w-40 h-40 bg-amber-500/10 blur-[80px] rounded-full" />

      {/* Header */}
      <div className="flex items-center gap-4 mb-2 z-10 relative">
        <div className="p-4 bg-amber-500/10 text-amber-400 rounded-2xl border border-amber-500/20">
          <Brain size={28} />
        </div>
        <div className="flex-1">
          <h2 className="text-2xl font-black tracking-tight text-white mb-1">Feels Like AQI</h2>
          <p className="text-[10px] text-amber-400/70 font-bold uppercase tracking-[0.2em]">
            <Activity size={10} className="inline mr-1" />
            ML-Trained Linear Regression
            {model && (
              <span className="ml-2 text-green-400/70">
                • R² = {model.r_squared} • {model.training_rows} data points
              </span>
            )}
          </p>
        </div>
      </div>

      <p className="text-xs text-white/30 mb-6 z-10 relative leading-relaxed max-w-3xl">
        Feels Like AQI adjusts reported AQI based on meteorological conditions affecting pollutant dispersion and particle behavior.
        Coefficients are <strong className="text-white/50">trained on 30 days of hourly historical data</strong> from your location using OLS Linear Regression.
      </p>

      {/* Main Comparison */}
      <div className="flex flex-col sm:flex-row items-center justify-center gap-6 mb-8 z-10 relative">
        <div className={`flex-1 flex flex-col items-center p-6 rounded-2xl ${currentCategory.bg} border ${currentCategory.border}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Reported AQI</span>
          <span className={`text-5xl font-black ${currentCategory.color}`}>{currentAQI}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${currentCategory.color}`}>{currentCategory.label}</span>
        </div>

        <div className={`flex flex-col items-center gap-1 px-4 py-3 rounded-xl border ${trendBg}`}>
          <TrendIcon size={24} className={trendColor} />
          <span className={`text-[9px] font-bold uppercase tracking-wider ${trendColor}`}>{trendLabel}</span>
          <span className={`text-[9px] ${trendColor} opacity-70`}>
            {trendDelta > 0 ? '+' : ''}{trendDelta} pts
          </span>
        </div>

        <div className={`flex-1 flex flex-col items-center p-6 rounded-2xl ${feelsCategory.bg} border ${feelsCategory.border}`}>
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 mb-2">Feels Like</span>
          <span className={`text-5xl font-black ${feelsCategory.color}`}>{feelsLikeAQI}</span>
          <span className={`text-[10px] font-black uppercase tracking-widest mt-1 ${feelsCategory.color}`}>{feelsCategory.label}</span>
        </div>
      </div>

      {/* Contributing Factors */}
      <div className="z-10 relative mb-6">
        <div className="flex items-center gap-2 mb-4 text-white/40">
          <Activity size={14} />
          <span className="text-[10px] font-bold uppercase tracking-widest">Factor contributions (learned coefficients × current values)</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {factors.map((factor, index) => {
            const Icon = factorIcons[factor.name] || Activity;
            const impactColor = factor.impact === 'positive' ? 'text-green-400' : factor.impact === 'negative' ? 'text-red-400' : 'text-white/40';
            const impactBg = factor.impact === 'positive' ? 'bg-green-500/10' : factor.impact === 'negative' ? 'bg-red-500/10' : 'bg-white/5';
            const effectColor = factor.aqiEffect < 0 ? 'text-green-400' : factor.aqiEffect > 0 ? 'text-red-400' : 'text-white/40';

            return (
              <motion.div
                key={factor.name}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 + index * 0.08 }}
                className="flex flex-col gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl hover:bg-white/10 transition-all group"
              >
                <div className="flex items-center justify-between">
                  <div className={`p-2 ${impactBg} ${impactColor} rounded-xl`}>
                    <Icon size={16} />
                  </div>
                  <div className="text-right">
                    <span className="text-lg font-black text-white">{factor.value}</span>
                    <span className="text-[10px] text-white/30 ml-1">{factor.unit}</span>
                  </div>
                </div>
                <div>
                  <span className="text-xs font-bold text-white/70">{factor.name}</span>
                  <p className="text-[10px] text-white/30 mt-0.5 group-hover:text-white/50 transition-colors leading-relaxed">
                    {factor.description}
                  </p>
                </div>
                <div className={`text-[10px] font-black uppercase tracking-wider ${effectColor}`}>
                  {factor.aqiEffect > 0 ? '+' : ''}{factor.aqiEffect} AQI points
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* ML Model Details (Expandable) */}
      <div className="z-10 relative">
        <button
          onClick={() => setShowMLDetails(!showMLDetails)}
          className="flex items-center gap-2 w-full p-3 bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all text-left"
        >
          <Brain size={14} className="text-amber-400" />
          <span className="text-[10px] font-bold uppercase tracking-widest text-white/40 flex-1">
            Trained Model Details
          </span>
          {showMLDetails ? <ChevronUp size={14} className="text-white/30" /> : <ChevronDown size={14} className="text-white/30" />}
        </button>

        <AnimatePresence>
          {showMLDetails && model && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 p-5 bg-white/5 rounded-xl border border-white/5 text-[11px] text-white/40 leading-relaxed space-y-4">
                <div className="flex flex-wrap gap-3">
                  <span className="text-white/60 font-bold">Model:</span> OLS Linear Regression
                  <span className="mx-2 text-white/10">|</span>
                  <span className="text-white/60 font-bold">Architecture:</span> y = β₀ + Σ(βᵢ × xᵢ)
                </div>
                
                {/* Training metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-lg font-black text-green-400">{model.r_squared}</div>
                    <div className="text-[9px] text-white/30 font-bold uppercase">R² Score</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-lg font-black text-blue-400">{model.training_rows}</div>
                    <div className="text-[9px] text-white/30 font-bold uppercase">Training Rows</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-lg font-black text-amber-400">{model.mae}</div>
                    <div className="text-[9px] text-white/30 font-bold uppercase">MAE</div>
                  </div>
                  <div className="p-3 bg-black/20 rounded-lg text-center">
                    <div className="text-lg font-black text-purple-400">{model.rmse}</div>
                    <div className="text-[9px] text-white/30 font-bold uppercase">RMSE</div>
                  </div>
                </div>

                {/* Formula */}
                <div>
                  <span className="text-white/60 font-bold">Trained Formula:</span>
                  <div className="mt-1 p-3 bg-black/20 rounded-lg font-mono text-[10px] text-amber-400/80">
                    AQI_feels = {model.intercept} + ({model.coefficients.wind_speed})·wind + ({model.coefficients.humidity})·humidity + ({model.coefficients.temperature})·temp + ({model.coefficients.pressure})·pressure + ({model.coefficients.aqi_current})·current_aqi
                  </div>
                </div>

                {/* Learned Coefficients */}
                <div className="space-y-2">
                  <span className="text-white/60 font-bold">Learned Coefficients (from training):</span>
                  <div className="space-y-2 mt-1">
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₀ (Intercept)</span>
                      <span className="text-white/70 font-bold">{model.intercept}</span>
                    </div>
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₁ (Wind Speed)</span>
                      <span className={`font-bold ${model.coefficients.wind_speed < 0 ? 'text-green-400' : 'text-red-400'}`}>{model.coefficients.wind_speed} per m/s</span>
                    </div>
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₂ (Humidity)</span>
                      <span className={`font-bold ${model.coefficients.humidity < 0 ? 'text-green-400' : 'text-red-400'}`}>{model.coefficients.humidity} per %</span>
                    </div>
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₃ (Temperature)</span>
                      <span className={`font-bold ${model.coefficients.temperature < 0 ? 'text-green-400' : 'text-red-400'}`}>{model.coefficients.temperature} per °C</span>
                    </div>
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₄ (Pressure)</span>
                      <span className={`font-bold ${model.coefficients.pressure < 0 ? 'text-green-400' : 'text-red-400'}`}>{model.coefficients.pressure} per hPa</span>
                    </div>
                    <div className="p-3 bg-black/10 rounded-lg flex justify-between">
                      <span className="text-white/50">β₅ (Current AQI)</span>
                      <span className={`font-bold ${model.coefficients.aqi_current > 0 ? 'text-blue-400' : 'text-red-400'}`}>{model.coefficients.aqi_current} per AQI</span>
                    </div>
                  </div>
                </div>

                {/* Training info */}
                <div className="p-3 bg-white/5 border border-white/5 rounded-lg">
                  <span className="text-white/50 font-bold text-[10px]">Training Pipeline</span>
                  <p className="mt-1 text-white/30 text-[10px]">
                    30 days of hourly (weather, AQI) data from Open-Meteo → OLS Normal Equation (β = (XᵀX)⁻¹Xᵀy) → 
                    Learned coefficients are location-specific. Model re-trains every hour with fresh data.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};
