/**
 * DocToTestPanel — Multi-AI Document-to-Test Workflow UI
 *
 * Flow: Upload file / paste text → run Gemini+Groq+OpenRouter pipeline
 *       → preview generated MCQs → Admin can save to Question Bank
 *       → optionally create a Battle Room from saved questions
 *
 * Props:
 *   token   {string}  — JWT token for API calls
 *   user    {object}  — current user (role, name, id)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Cpu, UploadCloud, FileText, CheckCircle2, XCircle,
  AlertCircle, Loader2, Eye, Save, Swords, ChevronDown, ChevronUp,
  RefreshCw, Info
} from 'lucide-react';

const SUBJECTS = [
  'Indian Polity', 'History', 'Geography', 'General Science',
  'Indian Economy', 'Computer Awareness', 'Mathematics',
  'Reasoning', 'Static GK', 'Uttar Pradesh GK', 'General Studies'
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'All'];

// ─── Tiny helper badges ───────────────────────────────────────────────────────

function VerdictBadge({ verdict }) {
  if (verdict === 'PASS') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> PASS
    </span>
  );
  if (verdict === 'FAIL') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> FAIL
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">
      <Info className="w-3 h-3" /> SKIPPED
    </span>
  );
}

function ProviderDot({ configured }) {
  return (
    <span className={`inline-block w-2 h-2 rounded-full ${configured ? 'bg-green-500' : 'bg-red-400'}`} />
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const DocToTestPanel = ({ token, user }) => {
  const isAdmin = user?.role === 'ADMIN';

  // Form state
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState('Indian Polity');
  const [topic, setTopic] = useState('');
  const [exam, setExam] = useState('General');
  const [difficulty, setDifficulty] = useState('Medium');
  const [questionCount, setQuestionCount] = useState(10);
  const [skipGroq, setSkipGroq] = useState(false);
  const [skipVerification, setSkipVerification] = useState(false);

  // Pipeline state
  const [processing, setProcessing] = useState(false);
  const [pipelineStep, setPipelineStep] = useState(''); // current step description
  const [questions, setQuestions] = useState([]);
  const [stats, setStats] = useState(null);
  const [error, setError] = useState('');

  // Save state
  const [saving, setSaving] = useState(false);
  const [saveResult, setSaveResult] = useState(null);

  // Provider status
  const [providerStatus, setProviderStatus] = useState(null);

  // Preview expand
  const [expandedQ, setExpandedQ] = useState(null);

  const fileRef = useRef();

  // Load provider status on mount
  useEffect(() => {
    fetch('/api/ai/doc-to-test/status', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(d => { if (d.success) setProviderStatus(d.providers); })
      .catch(() => {});
  }, [token]);

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleDropZone = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) { setFile(f); setError(''); }
  };

  const handleRunPipeline = async (e) => {
    e.preventDefault();
    if (!file && !pastedText.trim()) {
      setError('Please upload a file or paste study material text.');
      return;
    }

    setError('');
    setQuestions([]);
    setStats(null);
    setSaveResult(null);
    setProcessing(true);
    setPipelineStep('📄 Extracting text from source...');

    setTimeout(() => setPipelineStep('🤖 Gemini: Generating questions + answers...'), 1200);
    setTimeout(() => setPipelineStep('⚡ Groq: Creating distractor options...'), 3000);
    setTimeout(() => setPipelineStep('🔍 OpenRouter: Verifying answers...'), 6000);
    setTimeout(() => setPipelineStep('✅ Validating and deduplicating...'), 9000);

    const formData = new FormData();
    if (file) formData.append('file', file);
    if (pastedText.trim()) formData.append('pastedText', pastedText.trim());
    formData.append('subject', subject);
    formData.append('topic', topic || subject);
    formData.append('exam', exam);
    formData.append('difficulty', difficulty);
    formData.append('questionCount', questionCount);
    formData.append('skipGroq', skipGroq);
    formData.append('skipVerification', skipVerification);

    try {
      const res = await fetch('/api/ai/doc-to-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Pipeline failed. Check API keys and server logs.');
        return;
      }

      setQuestions(data.questions || []);
      setStats(data.stats);
      setPipelineStep('');
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setProcessing(false);
    }
  };

  const handleSaveToQuestionBank = async (status = 'PENDING_REVIEW') => {
    if (!isAdmin) return;
    if (questions.length === 0) return;
    setSaving(true);
    setSaveResult(null);
    try {
      const res = await fetch('/api/ai/doc-to-test/save', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ questions, status })
      });
      const data = await res.json();
      setSaveResult(data);
    } catch (err) {
      setSaveResult({ success: false, message: err.message });
    } finally {
      setSaving(false);
    }
  };

  const stepLabels = [
    { key: 'geminiGenerated', label: 'Gemini Q+A pairs', color: 'text-blue-500' },
    { key: 'groqSuccess', label: 'Groq distractors added', color: 'text-purple-500' },
    { key: 'groqFailed', label: 'Groq fallbacks used', color: 'text-orange-500' },
    { key: 'openRouterPass', label: 'OpenRouter PASS', color: 'text-green-500' },
    { key: 'openRouterFail', label: 'OpenRouter FAIL (corrected)', color: 'text-red-400' },
    { key: 'openRouterSkipped', label: 'Verification skipped', color: 'text-slate-400' },
    { key: 'deduplicatedLocally', label: 'Duplicates removed', color: 'text-amber-500' },
    { key: 'validationFailed', label: 'Invalid (dropped)', color: 'text-red-500' },
    { key: 'finalCount', label: 'Final questions ready', color: 'text-emerald-500 font-bold' },
  ];

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="bg-gradient-to-r from-[#1a3a5c] to-[#244A73] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Cpu className="w-6 h-6 text-white" />
          </div>
          <div>
            <h2 className="text-lg font-black">Multi-AI Document → Test Pipeline</h2>
            <p className="text-xs text-white/70">Gemini generates questions · Groq adds distractors · OpenRouter verifies answers</p>
          </div>
        </div>

        {/* Provider Status Bar */}
        {providerStatus && (
          <div className="mt-3 flex flex-wrap gap-3 text-[11px]">
            {Object.entries(providerStatus).map(([name, info]) => (
              <div key={name} className="flex items-center gap-1.5 bg-white/10 px-2.5 py-1 rounded-full">
                <ProviderDot configured={info.configured} />
                <span className="font-semibold capitalize">{name}</span>
                <span className="text-white/50">— {info.role}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── LEFT: Input Form ── */}
        <form onSubmit={handleRunPipeline} className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 space-y-4 shadow-sm">
          <h3 className="text-sm font-bold text-[#252525]">Source Material</h3>

          {/* Drop Zone */}
          <div
            className="border-2 border-dashed border-[#D5CDBF] rounded-xl p-5 text-center cursor-pointer hover:border-[#244A73] transition-colors"
            onDragOver={e => e.preventDefault()}
            onDrop={handleDropZone}
            onClick={() => fileRef.current?.click()}
          >
            <input ref={fileRef} type="file" className="hidden" accept=".pdf,.txt,.docx,.csv,.xlsx" onChange={handleFileChange} />
            {file ? (
              <div className="flex items-center justify-center gap-2 text-[#244A73]">
                <FileText className="w-5 h-5" />
                <span className="text-sm font-semibold">{file.name}</span>
                <button type="button" onClick={e => { e.stopPropagation(); setFile(null); }}
                  className="text-red-400 hover:text-red-600 ml-2 text-xs">Remove</button>
              </div>
            ) : (
              <>
                <UploadCloud className="w-8 h-8 mx-auto text-[#66635D] mb-1" />
                <p className="text-xs text-[#66635D]">Drop PDF / TXT / DOCX / CSV · or click to browse</p>
              </>
            )}
          </div>

          <div className="text-center text-[11px] text-[#66635D]">— OR paste text below —</div>

          <textarea
            rows={5}
            placeholder="Paste lecture notes, chapter text, or any study material here..."
            value={pastedText}
            onChange={e => setPastedText(e.target.value)}
            className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] text-xs resize-none focus:outline-none focus:border-[#244A73]"
          />

          {/* Configuration */}
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block text-[#66635D] mb-1 font-semibold">Subject</label>
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#66635D] mb-1 font-semibold">Topic (optional)</label>
              <input type="text" placeholder="e.g. Fundamental Rights" value={topic}
                onChange={e => setTopic(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] focus:outline-none focus:border-[#244A73]" />
            </div>
            <div>
              <label className="block text-[#66635D] mb-1 font-semibold">Difficulty</label>
              <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-[#66635D] mb-1 font-semibold">Questions (1–50)</label>
              <input type="number" min={1} max={50} value={questionCount}
                onChange={e => setQuestionCount(Number(e.target.value))}
                className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]" />
            </div>
          </div>

          {/* Advanced toggles */}
          <div className="flex flex-wrap gap-4 text-xs">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skipGroq} onChange={e => setSkipGroq(e.target.checked)}
                className="rounded" />
              <span className="text-[#66635D]">Skip Groq (use placeholder distractors)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={skipVerification} onChange={e => setSkipVerification(e.target.checked)}
                className="rounded" />
              <span className="text-[#66635D]">Skip OpenRouter verification</span>
            </label>
          </div>

          {error && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <button type="submit" disabled={processing}
            className="w-full flex items-center justify-center gap-2 bg-[#244A73] text-white font-bold py-3 rounded-xl hover:bg-[#1a3a5c] transition-colors disabled:opacity-50">
            {processing
              ? <><Loader2 className="w-4 h-4 animate-spin" /> {pipelineStep || 'Processing...'}</>
              : <><Cpu className="w-4 h-4" /> Run Multi-AI Pipeline</>
            }
          </button>
        </form>

        {/* ── RIGHT: Stats + Save ── */}
        <div className="space-y-4">

          {/* Pipeline Stats */}
          {stats && (
            <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm">
              <h3 className="text-sm font-bold text-[#252525] mb-3 flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-[#244A73]" /> Pipeline Stats
              </h3>
              <div className="grid grid-cols-2 gap-2">
                {stepLabels.map(({ key, label, color }) => (
                  <div key={key} className="flex items-center justify-between text-xs py-1 border-b border-[#E2DACB]">
                    <span className="text-[#66635D]">{label}</span>
                    <span className={`font-bold ${color}`}>{stats[key] ?? 0}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Save to Question Bank (Admin only) */}
          {questions.length > 0 && isAdmin && (
            <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm space-y-3">
              <h3 className="text-sm font-bold text-[#252525]">
                Save {questions.length} Questions to Question Bank
              </h3>

              <div className="flex gap-3">
                <button
                  onClick={() => handleSaveToQuestionBank('PENDING_REVIEW')}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-amber-500 text-white font-bold py-2.5 rounded-xl hover:bg-amber-600 transition-colors disabled:opacity-50 text-xs">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save for Review
                </button>
                <button
                  onClick={() => handleSaveToQuestionBank('PUBLISHED')}
                  disabled={saving}
                  className="flex-1 flex items-center justify-center gap-2 bg-green-600 text-white font-bold py-2.5 rounded-xl hover:bg-green-700 transition-colors disabled:opacity-50 text-xs">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  Publish Directly
                </button>
              </div>

              {saveResult && (
                <div className={`text-xs p-3 rounded-xl border ${saveResult.success ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'}`}>
                  {saveResult.success
                    ? `✅ Saved ${saveResult.saved} questions. Skipped ${saveResult.skipped} duplicates.`
                    : `❌ ${saveResult.message}`
                  }
                  {saveResult.errors?.length > 0 && (
                    <ul className="mt-1 list-disc ml-4 text-[10px] text-red-600">
                      {saveResult.errors.slice(0, 3).map((e, i) => <li key={i}>{e}</li>)}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Non-admin notice */}
          {questions.length > 0 && !isAdmin && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 text-xs text-amber-700">
              <AlertCircle className="w-4 h-4 inline mr-1" />
              Preview only. Admin login required to save questions to the Question Bank.
            </div>
          )}
        </div>
      </div>

      {/* ── Question Preview List ── */}
      {questions.length > 0 && (
        <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm">
          <h3 className="text-sm font-bold text-[#252525] mb-4 flex items-center gap-2">
            <Eye className="w-4 h-4 text-[#244A73]" />
            Preview: {questions.length} Generated Questions
          </h3>
          <div className="space-y-3 max-h-[600px] overflow-y-auto pr-1">
            {questions.map((q, idx) => (
              <div key={idx}
                className="border border-[#E2DACB] rounded-xl overflow-hidden">
                {/* Question header */}
                <button
                  type="button"
                  onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                  className="w-full text-left flex items-start justify-between gap-3 p-3 hover:bg-[#F7F3EA] transition-colors">
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <span className="text-[11px] font-bold text-[#244A73] bg-[#244A73]/10 px-1.5 py-0.5 rounded shrink-0">Q{idx + 1}</span>
                    <p className="text-xs font-medium text-[#252525] leading-snug">{q.question}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {q._pipeline?.openRouterVerdict && (
                      <VerdictBadge verdict={q._pipeline.openRouterVerdict} />
                    )}
                    {expandedQ === idx
                      ? <ChevronUp className="w-4 h-4 text-[#66635D]" />
                      : <ChevronDown className="w-4 h-4 text-[#66635D]" />
                    }
                  </div>
                </button>

                {/* Expanded details */}
                {expandedQ === idx && (
                  <div className="px-3 pb-3 pt-1 space-y-2 text-xs bg-[#F7F3EA] border-t border-[#E2DACB]">
                    <div className="space-y-1">
                      {q.options.map((opt, oi) => (
                        <div key={oi}
                          className={`flex items-center gap-2 px-2 py-1.5 rounded-lg ${oi === q.correctAnswer ? 'bg-green-100 text-green-700 font-semibold' : 'text-[#252525]'}`}>
                          <span className="font-bold shrink-0">{String.fromCharCode(65 + oi)})</span>
                          <span>{opt}</span>
                          {oi === q.correctAnswer && <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0" />}
                        </div>
                      ))}
                    </div>
                    {q.explanation && (
                      <div className="text-[11px] text-[#66635D] bg-white border border-[#E2DACB] rounded-lg p-2">
                        <span className="font-bold text-[#244A73]">Explanation: </span>{q.explanation}
                      </div>
                    )}
                    {q._pipeline && (
                      <div className="text-[10px] text-slate-400 flex flex-wrap gap-2">
                        <span>Gemini: ✓</span>
                        {q._pipeline.groqDistractors && <span>Groq: ✓</span>}
                        {q._pipeline.verifierCorrected && <span className="text-amber-500">Answer corrected by verifier</span>}
                        <span>Topic: {q.topic}</span>
                        <span>Diff: {q.difficulty}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};
