import { useState, useEffect } from 'react';
import { X, AlertTriangle, Wind, Info, MapPin, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: {
    areaName: string;
    lat: number;
    lon: number;
    category: string;
    sources: Record<string, number>;
  }) => Promise<void>;
  lat: number | null;
  lon: number | null;
}

export function ReportModal({ isOpen, onClose, onSubmit, lat, lon }: ReportModalProps) {
  const [suburbs, setSuburbs] = useState<string[]>(['Locating nearby areas...']);
  const [areaName, setAreaName] = useState('');
  const [category, setCategory] = useState('Medium');
  const [selectedSources, setSelectedSources] = useState<string[]>([]);
  const [sourceScales, setSourceScales] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const SOURCE_OPTIONS = ['Traffic Data', 'Construction Dust', 'Industrial Smoke', 'Stubble Burning', 'Waste Burning', 'Odor / Unknown'];
  const CATEGORIES = ['Low', 'Medium', 'High', 'Very High', 'Severe'];

  useEffect(() => {
    if (isOpen && lat && lon) {
      fetch(`/api/suburbs?lat=${lat}&lon=${lon}`)
        .then(r => r.json())
        .then(d => {
           const list: string[] = Array.isArray(d.suburbs) && d.suburbs.length > 0 ? d.suburbs : ['Local Area'];
           setSuburbs(list);
           setAreaName(prev => (prev && list.includes(prev) ? prev : list[0]));
        })
        .catch(() => {
           setSuburbs(['Local Area']);
           setAreaName(prev => prev || 'Local Area');
        });
    }
  }, [isOpen, lat, lon]);

  const toggleSource = (s: string) => {
    if (selectedSources.includes(s)) {
      setSelectedSources(prev => prev.filter(x => x !== s));
      const newScales = { ...sourceScales };
      delete newScales[s];
      setSourceScales(newScales);
    } else {
      setSelectedSources(prev => [...prev, s]);
      setSourceScales(prev => ({ ...prev, [s]: 3 }));
    }
  };

  const handleSubmit = async () => {
    try {
      setSubmitError(null);
      setLoading(true);
      if (lat === null || lon === null) {
        throw new Error('Coordinates are required');
      }
      await onSubmit({ areaName, lat, lon, category, sources: sourceScales });
      setSuccess(true);

      setTimeout(() => {
        setSelectedSources([]);
        setSourceScales({});
        setCategory('Medium');
        setSuccess(false);
        onClose();
      }, 2500);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to submit report';
      setSubmitError(msg);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="bg-slate-900 border border-white/20 rounded-3xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden max-h-[90vh] overflow-y-auto">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-red-500" />
          
          <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white transition-colors">
            <X size={24} />
          </button>

          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-xl">
              <AlertTriangle size={24} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Report Local AQI</h2>
              <p className="text-xs text-white/50 flex items-center gap-1"><MapPin size={10} /> {lat?.toFixed(4) || 0}, {lon?.toFixed(4) || 0}</p>
            </div>
          </div>

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-12 flex flex-col items-center justify-center text-center">
              <div className="w-20 h-20 bg-green-500/20 text-green-400 rounded-full flex items-center justify-center mb-6">
                 <CheckCircle2 size={40} />
              </div>
              <h3 className="text-2xl font-black text-white mb-2">Report Logged</h3>
              <p className="text-white/60">Your data has been clustered. Once the area hits 3 reports, the AQI will update!</p>
            </motion.div>
          ) : (
            <div className="space-y-6">
              <div>
                <label className="text-sm font-bold text-white/80 uppercase tracking-wider block mb-2">Area / Suburb</label>
                <select 
                  value={areaName} 
                  onChange={e => setAreaName(e.target.value)}
                  className="w-full bg-white/10 border border-white/20 text-white p-3 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/50 appearance-none cursor-pointer"
                >
                  {suburbs.map(s => <option key={s} value={s} className="bg-slate-900">{s}</option>)}
                </select>
              </div>

              <div>
                <label className="text-sm font-bold text-white/80 uppercase tracking-wider block mb-2">Severity Category</label>
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map(c => (
                    <button 
                       key={c}
                       onClick={() => setCategory(c)}
                       className={`px-4 py-2 rounded-xl text-sm font-bold transition-all border ${category === c ? 'bg-blue-600 text-white border-blue-500 shadow-lg shadow-blue-500/30' : 'bg-white/5 text-white/50 border-white/10 hover:bg-white/10'}`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-sm font-bold text-white/80 uppercase tracking-wider mb-3 block">Visible Sources</label>
                <div className="flex flex-wrap gap-2 mb-4">
                  {SOURCE_OPTIONS.map(s => (
                    <button 
                      key={s}
                      onClick={() => toggleSource(s)}
                      className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${selectedSources.includes(s) ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/30' : 'bg-white/5 text-white/60 hover:bg-white/10 border border-white/10'}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>

                {selectedSources.length > 0 && (
                  <div className="bg-white/5 rounded-xl p-4 space-y-4 border border-white/10">
                     <p className="text-xs text-white/50 font-medium uppercase tracking-wider">Rate Intensity (1 to 5)</p>
                     {selectedSources.map(s => (
                       <div key={s} className="space-y-1">
                          <div className="flex justify-between text-sm text-white/80 font-bold">
                             <span>{s}</span>
                             <span className="text-blue-400">{sourceScales[s] || 3}/5</span>
                          </div>
                          <input 
                            type="range" min="1" max="5" step="1" 
                            value={sourceScales[s] || 3} onChange={(e) => setSourceScales(prev => ({...prev, [s]: parseInt(e.target.value)}))}
                            className="w-full accent-purple-500 h-2 bg-white/10 rounded-lg appearance-none cursor-pointer"
                          />
                       </div>
                     ))}
                  </div>
                )}
              </div>

              <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex gap-3 text-blue-200 text-xs">
                <Info size={16} className="shrink-0 mt-0.5" />
                <p>Your report applies a weighted penalty to the &apos;Feels Like AQI&apos; for this area, validating after 3 community hits.</p>
              </div>

              <button 
                onClick={handleSubmit} 
                disabled={loading || selectedSources.length === 0 || !category || !areaName || areaName.startsWith('Locating') || lat === null || lon === null}
                className="w-full py-4 bg-white text-slate-900 rounded-2xl font-black text-lg hover:bg-slate-200 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {loading ? <div className="w-5 h-5 border-2 border-slate-900 border-t-transparent rounded-full animate-spin" /> : <Wind size={20} />}
                Submit Report
              </button>
              {selectedSources.length === 0 && (
                <p className="text-[11px] text-amber-300/80 text-center">
                  Select at least one visible source to submit a valid report.
                </p>
              )}
              {submitError && (
                <p className="text-[11px] text-red-300/90 text-center">
                  {submitError}
                </p>
              )}
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
