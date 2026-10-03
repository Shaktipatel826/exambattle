import React, { useState, useEffect } from 'react';
import { RefreshCw, BookOpen, AlertCircle, CheckCircle2, Calendar } from 'lucide-react';

export const WrongQuestionNotebook = ({ token }) => {
  const [categorized, setCategorized] = useState({});
  const [loading, setLoading] = useState(true);
  const [dueItems, setDueItems] = useState([]);
  const [revisionActive, setRevisionActive] = useState(false);
  const [revIndex, setRevIndex] = useState(0);
  const [revAnswers, setRevAnswers] = useState({});

  useEffect(() => {
    fetchNotebook();
    fetchDueItems();
  }, []);

  const fetchNotebook = async () => {
    try {
      const res = await fetch('/api/revision/notebook', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setCategorized(data.categorized || {});
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const fetchDueItems = async () => {
    try {
      const res = await fetch('/api/revision/due-items', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDueItems(data.questions || []);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const currentDue = dueItems[revIndex];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-rose-950/40 via-slate-900 to-slate-900 border border-rose-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-rose-400" /> WRONG QUESTION NOTEBOOK & SMART REVISION
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Automatically saves your exam mistakes. Uses spaced repetition algorithms (1, 3, 7, 14, 30 days) for guaranteed long-term retention.
          </p>
        </div>

        {dueItems.length > 0 && !revisionActive && (
          <button
            onClick={() => setRevisionActive(true)}
            className="py-2.5 px-5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs shadow-lg shadow-rose-600/30 transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <span>START SMART REVISION ({dueItems.length} DUE)</span>
          </button>
        )}
      </div>

      {/* Active Revision Runner Mode */}
      {revisionActive && currentDue ? (
        <div className="max-w-3xl mx-auto glass-panel p-6 rounded-2xl border border-rose-500/40 space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-slate-400">
            <span>Revision Item {revIndex + 1} of {dueItems.length}</span>
            <span className="text-rose-400">Spaced Repetition Active</span>
          </div>

          <p className="text-sm font-bold text-slate-100 leading-relaxed">{currentDue.question}</p>

          <div className="space-y-2">
            {currentDue.options?.map((opt, oIdx) => (
              <button
                key={oIdx}
                onClick={() => setRevAnswers({ ...revAnswers, [revIndex]: oIdx })}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                  revAnswers[revIndex] === oIdx
                    ? oIdx === currentDue.correctAnswer
                      ? 'bg-emerald-950 border-emerald-500 text-emerald-200'
                      : 'bg-red-950 border-red-500 text-red-200'
                    : 'bg-slate-950 border-slate-800 text-slate-300'
                }`}
              >
                <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-slate-800">
            <button
              onClick={() => setRevisionActive(false)}
              className="text-xs font-semibold text-slate-400 hover:text-white"
            >
              Exit Revision
            </button>

            {revIndex < dueItems.length - 1 ? (
              <button
                onClick={() => setRevIndex(revIndex + 1)}
                className="py-2 px-5 rounded-lg bg-rose-600 text-white font-bold text-xs"
              >
                Next Revision Question
              </button>
            ) : (
              <button
                onClick={() => { setRevisionActive(false); fetchNotebook(); }}
                className="py-2 px-5 rounded-lg bg-emerald-600 text-white font-bold text-xs"
              >
                Complete Revision Session
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Categorized Subject Notebook Display */
        <div className="space-y-6">
          {Object.keys(categorized).length === 0 ? (
            <div className="glass-panel p-12 text-center rounded-2xl text-slate-400">
              <CheckCircle2 className="w-12 h-12 mx-auto text-emerald-400 mb-2" />
              <h3 className="text-base font-bold text-slate-200">No Mistake Logged Yet!</h3>
              <p className="text-xs text-slate-500 mt-1">
                Any questions you answer incorrectly during solo practice or battles will appear here automatically.
              </p>
            </div>
          ) : (
            Object.keys(categorized).map(subjectName => (
              <div key={subjectName} className="glass-panel p-5 rounded-xl border border-slate-700/80 space-y-3">
                <h3 className="text-sm font-bold text-white flex items-center justify-between border-b border-slate-800 pb-2">
                  <span>{subjectName} Mistakes</span>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                    {categorized[subjectName].length} Items Saved
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categorized[subjectName].map(item => (
                    <div key={item.mistakeId} className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                      <p className="text-xs font-bold text-slate-200">{item.question?.question}</p>
                      <div className="flex justify-between items-center text-[10px] text-slate-400">
                        <span className="text-red-400 font-semibold">Wrong Attempts: {item.wrongCount}</span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-500" />
                          Next Rev: {new Date(item.nextRevisionDate).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

    </div>
  );
};
