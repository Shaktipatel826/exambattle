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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#252525]">
      
      {/* Header */}
      <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#244A73] flex items-center gap-2">
            <RefreshCw className="w-6 h-6 text-[#9E2A2B]" /> WRONG QUESTION NOTEBOOK & REVISION
          </h1>
          <p className="text-xs text-[#66635D] mt-1">
            Automatically saves your exam mistakes. Uses spaced repetition algorithms (1, 3, 7, 14, 30 days) for guaranteed long-term retention.
          </p>
        </div>

        {dueItems.length > 0 && !revisionActive && (
          <button
            onClick={() => setRevisionActive(true)}
            className="py-2.5 px-5 rounded-xl bg-[#9E2A2B] hover:bg-[#7E2223] text-white font-bold text-xs shadow-sm transition-all flex items-center gap-2 self-start md:self-auto"
          >
            <span>START REVISION ({dueItems.length} DUE)</span>
          </button>
        )}
      </div>

      {/* Active Revision Runner Mode */}
      {revisionActive && currentDue ? (
        <div className="max-w-3xl mx-auto bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4">
          <div className="flex justify-between items-center text-xs font-bold text-[#66635D]">
            <span>Revision Item {revIndex + 1} of {dueItems.length}</span>
            <span className="text-[#9E2A2B]">Spaced Repetition Active</span>
          </div>

          <p className="text-sm font-bold text-[#252525] leading-relaxed">{currentDue.question}</p>

          <div className="space-y-2">
            {currentDue.options?.map((opt, oIdx) => (
              <button
                key={oIdx}
                onClick={() => setRevAnswers({ ...revAnswers, [revIndex]: oIdx })}
                className={`w-full text-left p-3 rounded-xl border text-xs font-semibold transition-all ${
                  revAnswers[revIndex] === oIdx
                    ? oIdx === currentDue.correctAnswer
                      ? 'bg-[#E8F5E9] border-[#2D6A4F] text-[#2D6A4F] font-bold'
                      : 'bg-[#FDF2F2] border-[#9E2A2B] text-[#9E2A2B] font-bold'
                    : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
                }`}
              >
                <strong>{String.fromCharCode(65 + oIdx)}.</strong> {opt}
              </button>
            ))}
          </div>

          <div className="flex justify-between items-center pt-3 border-t border-[#E2DACB]">
            <button
              onClick={() => setRevisionActive(false)}
              className="text-xs font-semibold text-[#66635D] hover:text-[#252525]"
            >
              Exit Revision
            </button>

            {revIndex < dueItems.length - 1 ? (
              <button
                onClick={() => setRevIndex(revIndex + 1)}
                className="py-2 px-5 rounded-lg bg-[#244A73] hover:bg-[#1B3857] text-white font-bold text-xs"
              >
                Next Revision Question
              </button>
            ) : (
              <button
                onClick={() => { setRevisionActive(false); fetchNotebook(); }}
                className="py-2 px-5 rounded-lg bg-[#2D6A4F] text-white font-bold text-xs"
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
            <div className="bg-[#FFFDF8] p-12 text-center rounded-2xl border border-[#E2DACB] text-[#66635D]">
              <CheckCircle2 className="w-12 h-12 mx-auto text-[#2D6A4F] mb-2" />
              <h3 className="text-base font-bold text-[#252525]">No Mistake Logged Yet!</h3>
              <p className="text-xs text-[#66635D] mt-1">
                Any questions you answer incorrectly during solo practice or battles will appear here automatically.
              </p>
            </div>
          ) : (
            Object.keys(categorized).map(subjectName => (
              <div key={subjectName} className="bg-[#FFFDF8] p-5 rounded-xl border border-[#E2DACB] shadow-sm space-y-3">
                <h3 className="text-sm font-bold text-[#252525] flex items-center justify-between border-b border-[#E2DACB] pb-2">
                  <span>{subjectName} Mistakes</span>
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-[#FDF2F2] text-[#9E2A2B] border border-[#F87171]">
                    {categorized[subjectName].length} Items Saved
                  </span>
                </h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {categorized[subjectName].map(item => (
                    <div key={item.mistakeId} className="p-3.5 bg-[#F7F3EA] rounded-xl border border-[#E2DACB] space-y-2">
                      <p className="text-xs font-bold text-[#252525]">{item.question?.question}</p>
                      <div className="flex justify-between items-center text-[10px] text-[#66635D]">
                        <span className="text-[#9E2A2B] font-bold">Wrong Attempts: {item.wrongCount}</span>
                        <span className="flex items-center gap-1 font-semibold">
                          <Calendar className="w-3 h-3 text-[#66635D]" />
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
