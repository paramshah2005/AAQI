'use client';

import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import { BarChart3, Clock } from 'lucide-react';
import { AQIHistoryPoint } from '@/lib/feelsLikeEngine';

interface TimeSeriesChartProps {
  history: AQIHistoryPoint[];
}

interface TooltipData {
  x: number;
  y: number;
  aqi: number;
  feelsLike: number;
  time: string;
}

export const TimeSeriesChart: React.FC<TimeSeriesChartProps> = ({ history }) => {
  const hasData = history.length >= 2;
  const [tooltip, setTooltip] = useState<TooltipData | null>(null);

  // Sort by timestamp and show most recent time label specifically
  const sortedHistory = useMemo(() => 
    [...history].sort((a, b) => a.timestamp - b.timestamp), [history]);

  const chartData = useMemo(() => {
    if (!hasData || sortedHistory.length < 2) return null;

    const width = 600;
    const height = 200;
    const padding = { top: 20, bottom: 30, left: 42, right: 20 };
    const innerW = width - padding.left - padding.right;
    const innerH = height - padding.top - padding.bottom;

    const aqiValues = sortedHistory.map(p => p.aqi);
    const feelsValues = sortedHistory.map(p => p.feelsLike);
    const allValues = [...aqiValues, ...feelsValues];

    const minVal = Math.max(0, Math.min(...allValues) - 10);
    const maxVal = Math.max(...allValues) + 10;
    const range = maxVal - minVal || 1;

    // Use actual timestamps for x-axis (proportional spacing)
    const tMin = sortedHistory[0].timestamp;
    const tMax = sortedHistory[sortedHistory.length - 1].timestamp;
    const tRange = tMax - tMin || 1;

    const mapX = (ts: number) => padding.left + ((ts - tMin) / tRange) * innerW;
    const mapY = (val: number) => padding.top + innerH - ((val - minVal) / range) * innerH;

    const aqiPoints = sortedHistory.map((p, i) => ({
      x: mapX(p.timestamp),
      y: mapY(p.aqi),
      value: p.aqi,
      feelsLike: p.feelsLike,
      time: new Date(p.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    }));

    const feelsPoints = sortedHistory.map((p, i) => ({
      x: mapX(p.timestamp),
      y: mapY(p.feelsLike),
      value: p.feelsLike,
    }));

    const toPath = (points: { x: number; y: number }[]) =>
      points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    const toArea = (points: { x: number; y: number }[]) => {
      const line = toPath(points);
      return `${line} L ${points[points.length - 1].x} ${padding.top + innerH} L ${points[0].x} ${padding.top + innerH} Z`;
    };

    // Y-axis ticks
    const yTicks = [minVal, Math.round((minVal + maxVal) / 2), maxVal];
    const yLabels = yTicks.map(val => ({
      y: mapY(val),
      label: Math.round(val).toString(),
    }));

    // X-axis time labels — show ~6 evenly spaced + always show the LATEST
    const numLabels = 6;
    const timeLabels: { x: number; label: string }[] = [];
    for (let i = 0; i < numLabels; i++) {
      const targetTs = tMin + (i / (numLabels - 1)) * tRange;
      // Find nearest data point
      let nearest = sortedHistory[0];
      let nearDist = Math.abs(nearest.timestamp - targetTs);
      for (const p of sortedHistory) {
        const d = Math.abs(p.timestamp - targetTs);
        if (d < nearDist) { nearest = p; nearDist = d; }
      }
      const label = new Date(nearest.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      const x = mapX(nearest.timestamp);
      // Avoid duplicates
      if (timeLabels.length === 0 || Math.abs(x - timeLabels[timeLabels.length - 1].x) > 35) {
        timeLabels.push({ x, label });
      }
    }

    // Most recent time
    const lastTime = new Date(sortedHistory[sortedHistory.length - 1].timestamp)
      .toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    return {
      aqiLine: toPath(aqiPoints),
      aqiArea: toArea(aqiPoints),
      feelsLine: toPath(feelsPoints),
      feelsArea: toArea(feelsPoints),
      aqiPoints,
      feelsPoints,
      yLabels,
      timeLabels,
      lastTime,
      width,
      height,
      padding,
      innerH,
      innerW,
    };
  }, [sortedHistory, hasData]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="w-full max-w-4xl bg-white/5 backdrop-blur-md border border-white/10 p-8 rounded-[2rem] shadow-2xl overflow-hidden relative"
    >
      <div className="absolute bottom-0 right-0 w-32 h-32 bg-blue-500/10 blur-[60px] rounded-full" />

      <div className="flex items-center justify-between mb-4 z-10 relative">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-blue-500/10 text-blue-400 rounded-2xl border border-blue-500/20">
            <BarChart3 size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black tracking-tight text-white">AQI Trend History</h2>
            <p className="text-[10px] text-white/30 font-bold uppercase tracking-[0.15em]">
              <Clock size={10} className="inline mr-1" />
              Past 24 hours • {sortedHistory.length} readings
              {chartData && <span className="text-white/50"> • Latest: {chartData.lastTime}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] bg-blue-400 rounded-full" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Real AQI</span>
          </div>
          <div className="flex items-center gap-1.5">
            <div className="w-3 h-[3px] bg-amber-400 rounded-full" />
            <span className="text-[9px] font-bold uppercase tracking-wider text-white/30">Feels Like</span>
          </div>
        </div>
      </div>

      {!hasData ? (
        <div className="flex flex-col items-center justify-center py-12 text-white/15 z-10 relative">
          <BarChart3 size={40} />
          <span className="text-[10px] font-bold uppercase tracking-widest mt-3">Collecting data points...</span>
        </div>
      ) : chartData ? (
        <div className="bg-white/5 border border-white/5 rounded-2xl p-4 z-10 relative">
          <svg
            viewBox={`0 0 ${chartData.width} ${chartData.height}`}
            className="w-full h-auto"
            onMouseLeave={() => setTooltip(null)}
          >
            <defs>
              <linearGradient id="realGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#60a5fa" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#60a5fa" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="feelsGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f59e0b" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#f59e0b" stopOpacity="0" />
              </linearGradient>
            </defs>

            {/* Grid */}
            {chartData.yLabels.map((yl, i) => (
              <g key={i}>
                <line x1={chartData.padding.left} y1={yl.y} x2={chartData.width - chartData.padding.right} y2={yl.y} stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
                <text x={chartData.padding.left - 6} y={yl.y + 3} textAnchor="end" fill="rgba(255,255,255,0.2)" fontSize="9" fontWeight="600">{yl.label}</text>
              </g>
            ))}

            {/* Areas */}
            <path d={chartData.aqiArea} fill="url(#realGrad)" />
            <path d={chartData.feelsArea} fill="url(#feelsGrad)" />

            {/* Lines */}
            <path d={chartData.aqiLine} fill="none" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <path d={chartData.feelsLine} fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="6 3" />

            {/* Latest value dots + labels */}
            {chartData.aqiPoints.length > 0 && (() => {
              const lastAqi = chartData.aqiPoints[chartData.aqiPoints.length - 1];
              const lastFeels = chartData.feelsPoints[chartData.feelsPoints.length - 1];
              const tooClose = Math.abs(lastAqi.y - lastFeels.y) < 16;
              const aqiAbove = lastAqi.y <= lastFeels.y;

              return (
                <g>
                  <circle cx={lastAqi.x} cy={lastAqi.y} r="4" fill="#60a5fa" />
                  <text x={lastAqi.x - 10} y={tooClose ? (aqiAbove ? lastAqi.y - 8 : lastAqi.y + 14) : lastAqi.y - 8} fill="#60a5fa" fontSize="10" fontWeight="800" textAnchor="end">{lastAqi.value}</text>
                  <circle cx={lastFeels.x} cy={lastFeels.y} r="4" fill="#f59e0b" />
                  <text x={lastFeels.x - 10} y={tooClose ? (aqiAbove ? lastFeels.y + 14 : lastFeels.y - 8) : lastFeels.y - 8} fill="#f59e0b" fontSize="10" fontWeight="800" textAnchor="end">{lastFeels.value}</text>
                </g>
              );
            })()}

            {/* Hover hit areas (invisible wide rectangles for each data point) */}
            {chartData.aqiPoints.map((p, i) => {
              const segW = chartData.innerW / chartData.aqiPoints.length;
              return (
                <rect
                  key={i}
                  x={p.x - segW / 2}
                  y={chartData.padding.top}
                  width={segW}
                  height={chartData.innerH}
                  fill="transparent"
                  onMouseEnter={() => setTooltip({
                    x: p.x,
                    y: Math.min(p.y, chartData.feelsPoints[i].y) - 10,
                    aqi: p.value,
                    feelsLike: p.feelsLike,
                    time: p.time,
                  })}
                />
              );
            })}

            {/* Hover tooltip */}
            {tooltip && (
              <g>
                {/* Vertical line */}
                <line x1={tooltip.x} y1={chartData.padding.top} x2={tooltip.x} y2={chartData.padding.top + chartData.innerH} stroke="rgba(255,255,255,0.15)" strokeWidth="1" strokeDasharray="3 3" />
                {/* Tooltip box */}
                <rect x={Math.min(tooltip.x - 55, chartData.width - chartData.padding.right - 115)} y={Math.max(chartData.padding.top, tooltip.y - 48)} width="110" height="44" rx="6" fill="rgba(15,23,42,0.95)" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />
                <text x={Math.min(tooltip.x - 50, chartData.width - chartData.padding.right - 110)} y={Math.max(chartData.padding.top + 14, tooltip.y - 33)} fill="rgba(255,255,255,0.5)" fontSize="8" fontWeight="700">{tooltip.time}</text>
                <text x={Math.min(tooltip.x - 50, chartData.width - chartData.padding.right - 110)} y={Math.max(chartData.padding.top + 26, tooltip.y - 20)} fill="#60a5fa" fontSize="9" fontWeight="700">Real: {tooltip.aqi}</text>
                <text x={Math.min(tooltip.x - 50, chartData.width - chartData.padding.right - 110)} y={Math.max(chartData.padding.top + 38, tooltip.y - 8)} fill="#f59e0b" fontSize="9" fontWeight="700">Feels: {tooltip.feelsLike}</text>
              </g>
            )}

            {/* Time labels */}
            {chartData.timeLabels.map((tl, i) => (
              <text key={i} x={tl.x} y={chartData.padding.top + chartData.innerH + 18} textAnchor="middle" fill="rgba(255,255,255,0.2)" fontSize="8" fontWeight="600">{tl.label}</text>
            ))}
          </svg>
        </div>
      ) : null}
    </motion.div>
  );
};
