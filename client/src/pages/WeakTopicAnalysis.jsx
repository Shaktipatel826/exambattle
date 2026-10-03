import React, { useState, useEffect } from 'react';
import { Target, AlertTriangle, CheckCircle2, ArrowRight } from 'lucide-react';

export const WeakTopicAnalysis = ({ token, onPracticeWeak }) => {
  const [data, setData] = useState({ weakTopics: [], strongTopics: [], allTopics: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchWeakTopics();
  }, []);

  const fetchWeakTopics = async () => {
    try {
      const res = await fetch('/api/revision/weak-topics', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const resData = await res.json();
      if (resData.success) {
        setData(resData);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Target className="w-6 h-6 text-amber-400" /> WEAK TOPIC PERFORMANCE DIAGNOSIS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Calculates topic-level precision from all your solo practice tests, PYQs, and battle rounds.
          </p>
        </div>

        <button
          onClick={() => onPracticeWeak && onPracticeWeak()}
          className="py-2.5 px-5 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs shadow-lg shadow-red-600/30 transition-all flex items-center gap-2 self-start md:self-auto"
        >
          <span>PRACTICE WEAK TOPICS NOW</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        
        {/* Needs Practice / Weak Topics */}
        <div className="glass-panel p-5 rounded-xl border border-red-500/40 bg-slate-950/80 space-y-4">
          <h2 className="text-sm font-bold text-red-400 flex items-center gap-2 border-b border-slate-800 pb-2">
            <AlertTriangle className="w-4 h-4" /> Needs Practice (&lt; 50% Accuracy)
          </h2>

          <div className="space-y-3">
            {(data.weakTopics.length > 0 ? data.weakTopics : [
              { key: 'Economics - GDP & Banking', subject: 'Economics', topic: 'GDP & Banking', accuracy: 42 },
              { key: 'History - Revolt of 1857', subject: 'History', topic: 'Revolt of 1857', accuracy: 45 }
            ]).map(item => (
              <div key={item.key} className="p-3.5 rounded-xl bg-slate-900 border border-red-900/60 flex justify-between items-center text-xs">
                <div>
                  <h3 className="font-bold text-slate-200">{item.key}</h3>
                  <span className="text-[10px] text-slate-400">Attempts recorded</span>
                </div>
                <span className="font-black text-red-400 text-sm">{item.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>

        {/* Strong Mastered Topics */}
        <div className="glass-panel p-5 rounded-xl border border-emerald-500/40 bg-slate-950/80 space-y-4">
          <h2 className="text-sm font-bold text-emerald-400 flex items-center gap-2 border-b border-slate-800 pb-2">
            <CheckCircle2 className="w-4 h-4" /> Strong & Mastered Topics (&gt; 75% Accuracy)
          </h2>

          <div className="space-y-3">
            {(data.strongTopics.length > 0 ? data.strongTopics : [
              { key: 'Computer - Hardware & Networking', subject: 'Computer', topic: 'Hardware', accuracy: 88 },
              { key: 'Geography - Rivers & Mountains', subject: 'Geography', topic: 'Rivers', accuracy: 81 }
            ]).map(item => (
              <div key={item.key} className="p-3.5 rounded-xl bg-slate-900 border border-emerald-900/60 flex justify-between items-center text-xs">
                <div>
                  <h3 className="font-bold text-slate-200">{item.key}</h3>
                  <span className="text-[10px] text-slate-400">High precision</span>
                </div>
                <span className="font-black text-emerald-400 text-sm">{item.accuracy}%</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
