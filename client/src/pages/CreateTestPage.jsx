/**
 * CreateTestPage — Create Test with two modes:
 *   1. "AI Generate" — Upload file / paste material → 3-AI pipeline generates MCQs
 *   2. "Paste Q&A"  — Copy prompt → use external AI (ChatGPT/Gemini/Claude) →
 *                     paste formatted Q&A back → preview & save
 *
 * State always resets on mount. Never shows previous unsaved questions.
 */
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  UploadCloud, FileText, X, Loader2, CheckCircle2, XCircle,
  AlertCircle, Eye, Save, Swords, Trash2, Edit3, ChevronDown,
  ChevronUp, Info, Cpu, Zap, Settings2, RefreshCw, Copy,
  ClipboardPaste, Sparkles, Bot
} from 'lucide-react';

const SUBJECTS = [
  'Indian Polity', 'History', 'Geography', 'General Science',
  'Indian Economy', 'Computer Awareness', 'Mathematics',
  'Reasoning', 'Static GK', 'Uttar Pradesh GK', 'General Studies'
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard', 'Mixed'];
const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi (हिंदी)' },
  { value: 'bilingual', label: 'Bilingual' }
];

const PIPELINE_STEPS = [
  { id: 1, label: 'Extracting text from source' },
  { id: 2, label: 'Splitting material into sections' },
  { id: 3, label: 'Gemini: generating questions & answers' },
  { id: 4, label: 'Groq: creating incorrect options' },
  { id: 5, label: 'OpenRouter: verifying answers' },
  { id: 6, label: 'Validating and removing duplicates' },
  { id: 7, label: 'Preparing test preview' },
];

/** The reusable prompt students copy into ChatGPT / Gemini / Claude */
const EXTERNAL_AI_PROMPT = `You are helping me prepare for Indian competitive exams (SSC CGL, Railway NTPC, UP Police, UPSC, Banking).

Study the material I will provide carefully. Generate direct question-and-answer pairs from it.

FORMAT RULES — follow exactly:
Q1: [Question text]
Answer: [Reference answer — one word, phrase, date, name, or short sentence]
Explanation: [Optional 1-2 sentence explanation — omit if not needed]

Q2: [Next question]
Answer: [Reference answer]

Rules:
- Do NOT generate multiple-choice options (A/B/C/D). Direct answers only.
- Every question must have exactly one "Answer:" line.
- Explanation is optional — include only if it adds useful context.
- Do NOT add any text before Q1 or after the last question.
- Questions can be in Hindi, English, or a mix — match the source language.
- Do NOT invent facts. Only use information from the provided material.
- Generate as many meaningful questions as the material supports.
- Do not repeat the same question twice.`;

function VerdictBadge({ verdict }) {
  if (verdict === 'PASS') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-green-50 text-green-700 border border-green-200 px-1.5 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> PASS
    </span>
  );
  if (verdict === 'FAIL') return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-50 text-red-700 border border-red-200 px-1.5 py-0.5 rounded-full">
      <XCircle className="w-3 h-3" /> FAIL
    </span>
  );
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#F7F3EA] text-[#66635D] border border-[#E2DACB] px-1.5 py-0.5 rounded-full">
      <Info className="w-3 h-3" /> SKIPPED
    </span>
  );
}

export const CreateTestPage = ({ token, user, onNavigate, socket, socketConnected }) => {
  // ─── Mode ─────────────────────────────────────────────────────────────────
  const [activeMode, setActiveMode] = useState('paste'); // 'paste' | 'ai'

  // ─── Shared Settings State ────────────────────────────────────────────────
  const [subject, setSubject] = useState('General Studies');
  const [topic, setTopic] = useState('');
  const [language, setLanguage] = useState('en');
  const [difficulty, setDifficulty] = useState('Mixed');

  // ─── AI Pipeline State ────────────────────────────────────────────────────
  const [file, setFile] = useState(null);
  const [pastedMaterial, setPastedMaterial] = useState('');
  const [extractedInfo, setExtractedInfo] = useState(null);
  const [mode, setMode] = useState('quick');
  const [questionCount, setQuestionCount] = useState(15);
  const [skipGroq, setSkipGroq] = useState(false);
  const [skipVerification, setSkipVerification] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);
  const [stats, setStats] = useState(null);
  const [metadata, setMetadata] = useState(null);
  const [providerStatus, setProviderStatus] = useState(null);
  const stepTimerRef = useRef(null);
  const fileRef = useRef();

  // ─── Paste Q&A State ──────────────────────────────────────────────────────
  const [testTitle, setTestTitle] = useState('');
  const [qaText, setQaText] = useState('');
  const [parsing, setParsing] = useState(false);
  const [parseErrors, setParseErrors] = useState([]);
  const [parseStats, setParseStats] = useState(null);
  const [promptCopied, setPromptCopied] = useState(false);

  // ─── Shared Preview/Save/Room State ───────────────────────────────────────
  const [questions, setQuestions] = useState([]);
  const [error, setError] = useState('');
  const [expandedQ, setExpandedQ] = useState(null);
  const [editingQ, setEditingQ] = useState(null);
  const [editDraft, setEditDraft] = useState(null);
  const [saving, setSaving] = useState(false);
  const [savedTestId, setSavedTestId] = useState(null);
  const [saveError, setSaveError] = useState('');
  const [creatingRoom, setCreatingRoom] = useState(false);
  const [roomCode, setRoomCode] = useState(null);
  const [roomError, setRoomError] = useState('');
  const [discardConfirm, setDiscardConfirm] = useState(false);

  // ─── Full reset on mount ──────────────────────────────────────────────────
  useEffect(() => {
    setActiveMode('paste');
    setFile(null);
    setPastedMaterial('');
    setExtractedInfo(null);
    setProcessing(false);
    setCurrentStep(0);
    setQuestions([]);
    setStats(null);
    setMetadata(null);
    setError('');
    setParseErrors([]);
    setParseStats(null);
    setQaText('');
    setTestTitle('');
    setExpandedQ(null);
    setEditingQ(null);
    setEditDraft(null);
    setSaving(false);
    setSavedTestId(null);
    setSaveError('');
    setCreatingRoom(false);
    setRoomCode(null);
    setRoomError('');
    setDiscardConfirm(false);
    if (stepTimerRef.current) clearInterval(stepTimerRef.current);

    // Load AI provider status (for the AI pipeline tab)
    fetch('/api/ai/doc-to-test/status', {
      headers: { Authorization: `Bearer ${token}` }
    }).then(r => r.json()).then(d => {
      if (d.success) setProviderStatus(d.providers);
    }).catch(() => {});
  }, []); // only on mount

  // ─── Mode switch: clear preview ───────────────────────────────────────────
  const switchMode = (newMode) => {
    if (questions.length > 0) {
      if (!window.confirm('Switch mode? Your current preview will be cleared.')) return;
    }
    setActiveMode(newMode);
    setQuestions([]);
    setError('');
    setParseErrors([]);
    setParseStats(null);
    setSavedTestId(null);
    setRoomCode(null);
  };

  const getWordCount = (text) => text.trim().split(/\s+/).filter(Boolean).length;

  // ─── Copy Prompt ──────────────────────────────────────────────────────────
  const copyPrompt = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(EXTERNAL_AI_PROMPT);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    } catch {
      // Fallback for browsers that block clipboard
      const ta = document.createElement('textarea');
      ta.value = EXTERNAL_AI_PROMPT;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2500);
    }
  }, []);

  // ─── Parse Q&A Text ───────────────────────────────────────────────────────
  const handleParseText = async () => {
    if (!qaText.trim()) {
      setError('Please paste the Q&A text generated by your AI tool.');
      return;
    }
    setError('');
    setParseErrors([]);
    setParseStats(null);
    setQuestions([]);
    setSavedTestId(null);
    setRoomCode(null);
    setParsing(true);

    try {
      const res = await fetch('/api/saved-tests/parse-text', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ rawText: qaText })
      });
      const data = await res.json();

      if (!data.success) {
        setError(data.message || 'Could not parse the text. Check format and try again.');
        setParseErrors(data.errors || []);
        setParseStats(data.stats || null);
      } else {
        setQuestions(data.questions || []);
        setParseErrors(data.errors || []);
        setParseStats(data.stats || null);
      }
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setParsing(false);
    }
  };

  // ─── File Handling (AI mode) ──────────────────────────────────────────────
  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const allowed = ['.pdf', '.txt', '.docx', '.csv', '.xlsx'];
    const ext = '.' + f.name.split('.').pop().toLowerCase();
    if (!allowed.includes(ext)) {
      setError(`Unsupported file type "${ext}". Accepted: PDF, TXT, DOCX, CSV, XLSX`);
      return;
    }
    if (f.size > 20 * 1024 * 1024) {
      setError('File too large (max 20 MB). Please use a smaller file or paste the text directly.');
      return;
    }
    setFile(f);
    setExtractedInfo(null);
    setError('');
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleFileChange({ target: { files: [f] } });
  };

  const removeFile = (e) => {
    e.stopPropagation();
    setFile(null);
    setExtractedInfo(null);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── AI Generate ─────────────────────────────────────────────────────────
  const handleGenerate = async (e) => {
    e.preventDefault();
    if (!file && !pastedMaterial.trim()) {
      setError('Please upload a file or paste study material text.');
      return;
    }
    if (questions.length > 0) {
      if (!window.confirm('This will replace the current preview. Continue?')) return;
    }

    setError('');
    setSaveError('');
    setRoomError('');
    setQuestions([]);
    setStats(null);
    setMetadata(null);
    setSavedTestId(null);
    setRoomCode(null);
    setProcessing(true);
    setCurrentStep(1);

    let step = 1;
    stepTimerRef.current = setInterval(() => {
      step++;
      if (step <= 6) setCurrentStep(step);
      else clearInterval(stepTimerRef.current);
    }, 3500);

    const formData = new FormData();
    if (file) formData.append('file', file);
    if (pastedMaterial.trim()) formData.append('pastedText', pastedMaterial.trim());
    formData.append('subject', subject);
    formData.append('topic', topic || subject);
    formData.append('exam', 'General');
    formData.append('difficulty', difficulty === 'Mixed' ? 'All' : difficulty);
    formData.append('language', language);
    formData.append('mode', mode);
    formData.append('questionCount', String(questionCount));
    formData.append('skipGroq', String(skipGroq));
    formData.append('skipVerification', String(skipVerification));

    const controller = new AbortController();
    const fetchTimeoutId = setTimeout(() => controller.abort(), 115000);

    try {
      const res = await fetch('/api/ai/doc-to-test', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(fetchTimeoutId);
      clearInterval(stepTimerRef.current);

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || 'Pipeline failed. Check API keys and server logs.');
        setCurrentStep(0);
        setProcessing(false);
        return;
      }

      setCurrentStep(7);
      setTimeout(() => {
        setQuestions(data.questions || []);
        setStats(data.stats);
        setMetadata(data.metadata);
        if (data.metadata?.extractedChars) {
          setExtractedInfo({ chars: data.metadata.extractedChars });
        }
        setCurrentStep(0);
        setProcessing(false);
      }, 600);
    } catch (err) {
      clearTimeout(fetchTimeoutId);
      clearInterval(stepTimerRef.current);
      if (err.name === 'AbortError') {
        setError(
          'Request timed out (>115 s). Try enabling "Skip Verification", using shorter material, or requesting fewer questions.'
        );
      } else {
        setError(`Network error: ${err.message}`);
      }
      setCurrentStep(0);
      setProcessing(false);
    }
  };

  // ─── Question Edit ────────────────────────────────────────────────────────
  const startEdit = (idx) => {
    setEditingQ(idx);
    setEditDraft({ ...questions[idx] });
    setExpandedQ(idx);
  };

  const saveEdit = (idx) => {
    const updated = [...questions];
    updated[idx] = editDraft;
    setQuestions(updated);
    setEditingQ(null);
    setEditDraft(null);
  };

  const cancelEdit = () => {
    setEditingQ(null);
    setEditDraft(null);
  };

  const deleteQuestion = (idx) => {
    setQuestions(prev => prev.filter((_, i) => i !== idx));
    if (expandedQ === idx) setExpandedQ(null);
    if (editingQ === idx) { setEditingQ(null); setEditDraft(null); }
  };

  // ─── Save Test ────────────────────────────────────────────────────────────
  const handleSave = async () => {
    if (questions.length === 0) return;
    setSaving(true);
    setSaveError('');
    const autoTitle = testTitle.trim() ||
      `${subject} Test — ${new Date().toLocaleDateString('en-IN')}`;
    try {
      const res = await fetch('/api/saved-tests', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: autoTitle,
          subject,
          topic: topic || subject,
          difficulty,
          language,
          mode: activeMode === 'paste' ? 'quick' : mode,
          questions,
          stats: stats || {},
          sourceDocumentName: activeMode === 'paste' ? 'Student Q&A (External AI)' : (file?.name || 'Pasted Content'),
          extractedChars: metadata?.extractedChars || 0
        })
      });
      const data = await res.json();
      if (data.success) {
        setSavedTestId(data.savedTest._id);
      } else {
        setSaveError(data.message || 'Save failed.');
      }
    } catch (err) {
      setSaveError(`Save error: ${err.message}`);
    } finally {
      setSaving(false);
    }
  };

  // ─── Create Room ──────────────────────────────────────────────────────────
  const handleCreateRoom = () => {
    if (questions.length === 0) return;

    // Derive connected state from prop (preferred) or socket.connected (fallback)
    const isSocketReady = socketConnected ?? (socket?.connected ?? false);

    if (!socket) {
      setRoomError('Connecting to server… please wait a moment and try again.');
      return;
    }
    if (!isSocketReady) {
      setRoomError('Reconnecting to battle server… please wait a few seconds and try again.');
      return;
    }

    setCreatingRoom(true);
    setRoomError('');
    setRoomCode(null);

    socket.emit('create_room_with_questions', {
      user: { id: user?.id || user?._id, name: user?.name },
      questions,
      config: { subject, topic, difficulty, timeLimitMinutes: Math.max(5, Math.ceil(questions.length * 1.5)) }
    }, (ack) => {
      setCreatingRoom(false);
      if (ack?.success) {
        setRoomCode(ack.roomCode);
        if (onNavigate) onNavigate('BATTLE', { joinRoomCode: ack.roomCode });
      } else {
        setRoomError(ack?.message || 'Failed to create room.');
      }
    });
  };

  // ─── Discard ──────────────────────────────────────────────────────────────
  const handleDiscard = () => {
    if (questions.length === 0) return;
    setDiscardConfirm(true);
  };

  const confirmDiscard = () => {
    setQuestions([]);
    setStats(null);
    setMetadata(null);
    setFile(null);
    setPastedMaterial('');
    setQaText('');
    setTestTitle('');
    setExtractedInfo(null);
    setSavedTestId(null);
    setRoomCode(null);
    setError('');
    setSaveError('');
    setRoomError('');
    setParseErrors([]);
    setParseStats(null);
    setDiscardConfirm(false);
    if (fileRef.current) fileRef.current.value = '';
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 pb-32 lg:pb-8 space-y-6">

      {/* Discard Confirmation Modal */}
      {discardConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-bold text-[#252525]">Discard this test?</h3>
            <p className="text-xs text-[#66635D]">
              {questions.length} question{questions.length !== 1 ? 's' : ''} will be lost. This cannot be undone.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDiscardConfirm(false)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2DACB] text-[#66635D] text-xs font-semibold hover:bg-[#F7F3EA] transition-colors">
                Cancel
              </button>
              <button onClick={confirmDiscard}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition-colors">
                Yes, Discard
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-gradient-to-r from-[#1a3a5c] to-[#244A73] rounded-2xl p-5 text-white">
        <div className="flex items-center gap-3 mb-3">
          <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
            <Cpu className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-lg font-black">Create Test</h1>
            <p className="text-xs text-white/70">Build your own MCQ test and battle friends</p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={() => switchMode('paste')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'paste'
                ? 'bg-white text-[#244A73] shadow'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            ✍️ Paste Q&amp;A
          </button>
          <button
            type="button"
            onClick={() => switchMode('ai')}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold transition-all ${
              activeMode === 'ai'
                ? 'bg-white text-[#244A73] shadow'
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            <Bot className="w-3.5 h-3.5" />
            🤖 AI Generate
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          PASTE Q&A MODE
      ═══════════════════════════════════════════════════════════════════ */}
      {activeMode === 'paste' && !processing && questions.length === 0 && (
        <div className="space-y-5">

          {/* Step 1: Test Details */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#244A73]" />
              Test Details
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <label className="block text-[#66635D] mb-1 font-semibold">Test Title (optional)</label>
                <input
                  type="text"
                  placeholder={`${subject} Test — ${new Date().toLocaleDateString('en-IN')}`}
                  value={testTitle}
                  onChange={e => setTestTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] focus:outline-none focus:border-[#244A73]"
                />
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Topic (optional)</label>
                <input type="text" placeholder="e.g. Fundamental Rights"
                  value={topic} onChange={e => setTopic(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] focus:outline-none focus:border-[#244A73]" />
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Step 2: Prompt Box */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-[#244A73]" />
              Generate Questions Using Any AI
            </h2>
            <ol className="text-xs text-[#66635D] space-y-1 list-none pl-0">
              {[
                'Copy the prompt below.',
                'Open ChatGPT, Gemini, Claude or any other AI tool.',
                'Upload your PDF, textbook images, notes or study material.',
                'Paste the prompt and ask the AI to generate direct Q&A pairs (no MCQ options).',
                'Copy the AI\'s output and paste it into the box below.',
              ].map((step, i) => (
                <li key={i} className="flex items-start gap-2">
                  <span className="shrink-0 w-5 h-5 rounded-full bg-[#244A73]/10 text-[#244A73] text-[10px] font-bold flex items-center justify-center mt-0.5">{i + 1}</span>
                  <span>{step}</span>
                </li>
              ))}
            </ol>

            {/* Copyable prompt */}
            <div className="relative">
              <pre className="text-[10px] leading-relaxed text-[#252525] bg-[#F7F3EA] border border-[#D5CDBF] rounded-xl p-3 overflow-auto max-h-48 whitespace-pre-wrap font-mono">
                {EXTERNAL_AI_PROMPT}
              </pre>
              <button
                type="button"
                onClick={copyPrompt}
                className={`absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold px-2.5 py-1.5 rounded-lg transition-all ${
                  promptCopied
                    ? 'bg-green-100 text-green-700 border border-green-200'
                    : 'bg-[#244A73] text-white hover:bg-[#1a3a5c]'
                }`}
              >
                {promptCopied ? <CheckCircle2 className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                {promptCopied ? 'Copied!' : 'Copy Prompt'}
              </button>
            </div>
          </div>

          {/* Step 3: Paste Q&A */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 shadow-sm space-y-3">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <ClipboardPaste className="w-4 h-4 text-[#244A73]" />
              Paste AI-Generated Q&amp;A
            </h2>
            <p className="text-xs text-[#66635D]">
              Paste the AI output here. Each question must follow this format — <strong>no A/B/C/D options needed</strong>:
            </p>
            <div className="bg-[#F7F3EA] border border-[#D5CDBF] rounded-xl p-3 text-[10px] font-mono text-[#252525] leading-relaxed whitespace-pre">
{`Q1: भारत के प्रथम राष्ट्रपति कौन थे?
Answer: डॉ. राजेंद्र प्रसाद

Q2: भारत कब स्वतंत्र हुआ था?
Answer: 15 अगस्त 1947
Explanation: भारत 15 अगस्त 1947 को ब्रिटिश शासन से स्वतंत्र हुआ।

Q3: Who founded the Maurya Empire?
Answer: Chandragupta Maurya`}
            </div>
            <textarea
              rows={12}
              placeholder="Paste the Q&amp;A output from ChatGPT / Gemini / Claude here…

Example:
Q1: भारत के प्रथम राष्ट्रपति कौन थे?
Answer: डॉ. राजेंद्र प्रसाद

Q2: Who founded the Maurya Empire?
Answer: Chandragupta Maurya"
              value={qaText}
              onChange={e => setQaText(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] text-xs resize-y focus:outline-none focus:border-[#244A73] transition-colors font-mono"
              dir="auto"
            />
            {qaText.trim() && (
              <p className="text-[10px] text-[#66635D]">
                {qaText.trim().length.toLocaleString()} chars pasted
              </p>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            {parseErrors.length > 0 && (
              <div className="space-y-1">
                <p className="text-[10px] font-bold text-amber-700">Parse errors ({parseErrors.length}):</p>
                {parseErrors.map((e, i) => (
                  <div key={i} className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                    <strong>{e.ref}:</strong> {e.issue}
                  </div>
                ))}
              </div>
            )}

            <button
              type="button"
              onClick={handleParseText}
              disabled={parsing || !qaText.trim()}
              className="w-full flex items-center justify-center gap-2 bg-[#244A73] text-white font-bold py-3 rounded-xl hover:bg-[#1a3a5c] transition-colors shadow-sm disabled:opacity-50"
            >
              {parsing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Eye className="w-4 h-4" />}
              {parsing ? 'Parsing…' : 'Preview Questions →'}
            </button>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AI GENERATE MODE — Input Form
      ═══════════════════════════════════════════════════════════════════ */}
      {activeMode === 'ai' && !processing && questions.length === 0 && (
        <form onSubmit={handleGenerate} className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* A. Material Input */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-[#244A73]" />
              Provide Study Material
            </h2>

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-[#D5CDBF] rounded-xl p-5 text-center cursor-pointer hover:border-[#244A73] transition-colors"
              onDragOver={e => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" className="hidden"
                accept=".pdf,.txt,.docx,.csv,.xlsx"
                onChange={handleFileChange} />
              {file ? (
                <div className="space-y-1">
                  <div className="flex items-center justify-center gap-2 text-[#244A73]">
                    <FileText className="w-5 h-5" />
                    <span className="text-sm font-semibold truncate max-w-[180px]">{file.name}</span>
                    <button type="button" onClick={removeFile} className="text-red-400 hover:text-red-600">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                  <p className="text-[11px] text-[#66635D]">
                    {(file.size / 1024).toFixed(1)} KB
                    {extractedInfo && ` • ${extractedInfo.chars?.toLocaleString()} chars extracted`}
                  </p>
                </div>
              ) : (
                <>
                  <UploadCloud className="w-8 h-8 mx-auto text-[#66635D] mb-1" />
                  <p className="text-xs text-[#66635D] font-medium">Drop file here or click to browse</p>
                  <p className="text-[10px] text-[#66635D]/70 mt-0.5">PDF • TXT • DOCX • CSV • XLSX • max 20 MB</p>
                </>
              )}
            </div>

            <div className="text-center text-[11px] text-[#66635D]">— OR paste text below —</div>

            <textarea
              rows={6}
              placeholder="Paste lecture notes, chapter text, or any study material here..."
              value={pastedMaterial}
              onChange={e => setPastedMaterial(e.target.value)}
              className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] text-xs resize-none focus:outline-none focus:border-[#244A73] transition-colors"
            />
            {pastedMaterial.trim() && (
              <p className="text-[10px] text-[#66635D]">
                {pastedMaterial.trim().length.toLocaleString()} chars • ~{getWordCount(pastedMaterial)} words
              </p>
            )}
          </div>

          {/* B. Test Settings */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <Settings2 className="w-4 h-4 text-[#244A73]" />
              Test Settings
            </h2>

            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="col-span-2">
                <label className="block text-[#66635D] mb-1 font-semibold">Subject</label>
                <select value={subject} onChange={e => setSubject(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {SUBJECTS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="col-span-2">
                <label className="block text-[#66635D] mb-1 font-semibold">Topic (optional)</label>
                <input type="text" placeholder="e.g. Fundamental Rights"
                  value={topic} onChange={e => setTopic(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] focus:outline-none focus:border-[#244A73]" />
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Language</label>
                <select value={language} onChange={e => setLanguage(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Difficulty</label>
                <select value={difficulty} onChange={e => setDifficulty(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  {DIFFICULTIES.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Target Questions</label>
                <input type="number" min={1}
                  value={questionCount}
                  onChange={e => setQuestionCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]" />
              </div>
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Mode</label>
                <select value={mode} onChange={e => setMode(e.target.value)}
                  className="w-full px-2 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]">
                  <option value="quick">Quick (up to target)</option>
                  <option value="comprehensive">Comprehensive (all material)</option>
                </select>
              </div>
            </div>

            {mode === 'comprehensive' && (
              <div className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <strong>Comprehensive mode:</strong> Processes every section. May generate more questions than the target. Takes longer for large documents.
              </div>
            )}

            <div className="space-y-2 pt-1 border-t border-[#E2DACB]">
              <p className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider pt-2">Advanced Options</p>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={skipGroq} onChange={e => setSkipGroq(e.target.checked)} className="rounded" />
                <span className="text-[#66635D]">Skip Groq (use placeholder options — faster)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-xs">
                <input type="checkbox" checked={skipVerification} onChange={e => setSkipVerification(e.target.checked)} className="rounded" />
                <span className="text-[#66635D]">Skip OpenRouter verification</span>
              </label>
            </div>

            {providerStatus && (
              <div className="flex flex-wrap gap-1.5 pt-1 border-t border-[#E2DACB]">
                {Object.entries(providerStatus).map(([name, info]) => (
                  <span key={name}
                    className="flex items-center gap-1 bg-[#F7F3EA] border border-[#E2DACB] text-[10px] font-semibold px-2 py-1 rounded-full">
                    <span className={`w-1.5 h-1.5 rounded-full ${info.configured ? 'bg-green-400' : 'bg-red-400'}`} />
                    <span className="capitalize">{name}</span>
                  </span>
                ))}
              </div>
            )}

            {error && (
              <div className="flex items-start gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}

            <button type="submit"
              className="w-full flex items-center justify-center gap-2 bg-[#244A73] text-white font-bold py-3 rounded-xl hover:bg-[#1a3a5c] transition-colors shadow-sm">
              <Zap className="w-4 h-4" />
              Generate Test with AI
            </button>
          </div>
        </form>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          AI PIPELINE PROCESSING PROGRESS
      ═══════════════════════════════════════════════════════════════════ */}
      {processing && (
        <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-6 shadow-sm space-y-5">
          <h3 className="text-sm font-bold text-[#252525] flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-[#244A73]" />
            Generating Your Test…
          </h3>
          <div className="space-y-2">
            {PIPELINE_STEPS.map((step) => {
              const done = currentStep > step.id;
              const active = currentStep === step.id;
              return (
                <div key={step.id}
                  className={`flex items-center gap-3 p-2.5 rounded-lg text-xs transition-all ${
                    done ? 'bg-green-50' : active ? 'bg-[#244A73]/5 border border-[#244A73]/20' : 'opacity-40'
                  }`}>
                  {done
                    ? <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                    : active
                    ? <Loader2 className="w-4 h-4 animate-spin text-[#244A73] shrink-0" />
                    : <div className="w-4 h-4 rounded-full border-2 border-[#D5CDBF] shrink-0" />}
                  <span className={`${done ? 'text-green-700 font-medium' : active ? 'text-[#244A73] font-semibold' : 'text-[#66635D]'}`}>
                    {step.label}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-[#66635D] text-center">
            This may take 30–120 seconds depending on material size and providers.
          </p>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════════
          QUESTION PREVIEW (shared between both modes)
      ═══════════════════════════════════════════════════════════════════ */}
      {questions.length > 0 && (
        <div className="space-y-4">

          {/* Preview header */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Eye className="w-5 h-5 text-[#244A73]" />
              <h2 className="text-base font-black text-[#252525]">
                {questions.length} Question{questions.length !== 1 ? 's' : ''} Ready
              </h2>
              {savedTestId && (
                <span className="text-[11px] font-bold bg-green-50 text-green-700 border border-green-200 px-2 py-0.5 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> Saved
                </span>
              )}
              {parseStats && (
                <span className="text-[10px] text-[#66635D] bg-[#F7F3EA] border border-[#E2DACB] px-2 py-0.5 rounded-full">
                  {parseStats.errored > 0 && `${parseStats.errored} skipped`}
                </span>
              )}
            </div>
            <button type="button"
              onClick={() => {
                setQuestions([]);
                setStats(null);
                setMetadata(null);
                setSavedTestId(null);
                setRoomCode(null);
                setParseStats(null);
                setParseErrors([]);
              }}
              className="text-xs text-[#66635D] border border-[#E2DACB] px-3 py-1.5 rounded-lg hover:bg-[#F7F3EA] flex items-center gap-1 transition-colors">
              <RefreshCw className="w-3.5 h-3.5" /> New Test
            </button>
          </div>

          {/* Pipeline stats (AI mode only) */}
          {stats && (
            <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-xl p-3 grid grid-cols-3 sm:grid-cols-6 gap-3 text-center">
              {[
                { label: 'Generated', value: stats.geminiGenerated, color: 'text-blue-600' },
                { label: 'Groq OK', value: stats.groqSuccess, color: 'text-purple-600' },
                { label: 'OR Pass', value: stats.openRouterPass, color: 'text-green-600' },
                { label: 'OR Fail', value: stats.openRouterFail, color: 'text-red-500' },
                { label: 'Dropped', value: stats.validationFailed, color: 'text-amber-600' },
                { label: 'Final', value: stats.finalCount, color: 'text-[#244A73] font-bold' },
              ].map(s => (
                <div key={s.label}>
                  <p className={`text-sm font-bold ${s.color}`}>{s.value ?? 0}</p>
                  <p className="text-[10px] text-[#66635D]">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {/* Parse errors (Paste Q&A mode) */}
          {parseErrors.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-amber-700">
                {parseErrors.length} question{parseErrors.length !== 1 ? 's' : ''} skipped due to format errors:
              </p>
              {parseErrors.map((e, i) => (
                <div key={i} className="text-[10px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                  <strong>{e.ref}:</strong> {e.issue}
                </div>
              ))}
            </div>
          )}

          {/* Questions list */}
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl shadow-sm overflow-hidden">
            <div className="divide-y divide-[#E2DACB]">
              {questions.map((q, idx) => (
                <div key={idx}>
                  {editingQ === idx ? (
                    /* Edit mode */
                    <div className="p-4 space-y-3 bg-[#F7F3EA]">
                      <p className="text-[10px] font-bold text-[#244A73] uppercase tracking-wider">Editing Q{idx + 1}</p>
                      <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#D5CDBF] bg-[#FFFDF8] text-xs text-[#252525] resize-none focus:outline-none focus:border-[#244A73]"
                        rows={3}
                        value={editDraft?.question || ''}
                        onChange={e => setEditDraft(d => ({ ...d, question: e.target.value }))}
                      />

                      {/* Short-answer edit: just a reference answer textarea */}
                      {editDraft?.questionType === 'short_answer' ? (
                        <div>
                          <label className="block text-[10px] font-semibold text-[#66635D] mb-1">Reference Answer</label>
                          <textarea
                            className="w-full px-3 py-2 rounded-lg border border-[#D5CDBF] bg-[#FFFDF8] text-xs text-[#252525] resize-none focus:outline-none focus:border-[#244A73]"
                            rows={2}
                            value={editDraft?.referenceAnswer || ''}
                            onChange={e => setEditDraft(d => ({ ...d, referenceAnswer: e.target.value }))}
                          />
                        </div>
                      ) : (
                        /* MCQ edit: options + correct answer radio */
                        <div className="space-y-2">
                          {editDraft?.options?.map((opt, oi) => (
                            <div key={oi} className="flex items-center gap-2">
                              <input type="radio" name={`ca-${idx}`}
                                checked={editDraft.correctAnswer === oi}
                                onChange={() => setEditDraft(d => ({ ...d, correctAnswer: oi }))}
                                className="shrink-0" />
                              <input
                                className="flex-1 px-2 py-1.5 rounded-lg border border-[#D5CDBF] bg-[#FFFDF8] text-xs focus:outline-none focus:border-[#244A73]"
                                value={opt}
                                onChange={e => {
                                  const opts = [...editDraft.options];
                                  opts[oi] = e.target.value;
                                  setEditDraft(d => ({ ...d, options: opts }));
                                }}
                              />
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                editDraft.correctAnswer === oi
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-[#EFE9DC] text-[#66635D]'
                              }`}>
                                {String.fromCharCode(65 + oi)}
                              </span>
                            </div>
                          ))}
                        </div>
                      )}

                      <textarea
                        className="w-full px-3 py-2 rounded-lg border border-[#D5CDBF] bg-[#FFFDF8] text-xs text-[#252525] resize-none focus:outline-none focus:border-[#244A73]"
                        rows={2}
                        placeholder="Explanation (optional)..."
                        value={editDraft?.explanation || ''}
                        onChange={e => setEditDraft(d => ({ ...d, explanation: e.target.value }))}
                      />
                      <div className="flex gap-2">
                        <button type="button" onClick={() => saveEdit(idx)}
                          className="px-4 py-1.5 bg-[#244A73] text-white text-xs font-bold rounded-lg hover:bg-[#1a3a5c] transition-colors">
                          Save Edit
                        </button>
                        <button type="button" onClick={cancelEdit}
                          className="px-4 py-1.5 border border-[#E2DACB] text-[#66635D] text-xs font-semibold rounded-lg hover:bg-[#EFE9DC] transition-colors">
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    /* View mode */
                    <div>
                      <button type="button"
                        onClick={() => setExpandedQ(expandedQ === idx ? null : idx)}
                        className="w-full text-left flex items-start justify-between gap-3 p-3 hover:bg-[#F7F3EA] transition-colors">
                        <div className="flex items-start gap-2 flex-1 min-w-0">
                          <span className="text-[11px] font-bold text-[#244A73] bg-[#244A73]/10 px-1.5 py-0.5 rounded shrink-0">Q{idx + 1}</span>
                          <p className="text-xs font-medium text-[#252525] leading-snug">{q.question}</p>
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          {q._pipeline?.openRouterVerdict && (
                            <VerdictBadge verdict={q._pipeline.openRouterVerdict} />
                          )}
                          <button type="button" onClick={e => { e.stopPropagation(); startEdit(idx); }}
                            className="p-1.5 text-[#66635D] hover:text-[#244A73] hover:bg-[#EFE9DC] rounded-lg transition-colors">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button type="button" onClick={e => { e.stopPropagation(); deleteQuestion(idx); }}
                            className="p-1.5 text-[#66635D] hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                          {expandedQ === idx
                            ? <ChevronUp className="w-4 h-4 text-[#66635D]" />
                            : <ChevronDown className="w-4 h-4 text-[#66635D]" />}
                        </div>
                      </button>

                      {expandedQ === idx && (
                        <div className="px-3 pb-3 pt-1 space-y-2 bg-[#F7F3EA] border-t border-[#E2DACB]">
                          {/* Short-answer: show reference answer */}
                          {q.questionType === 'short_answer' ? (
                            <div className="flex items-start gap-2 px-2 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                              <CheckCircle2 className="w-3.5 h-3.5 shrink-0 mt-0.5 text-green-600" />
                              <div>
                                <span className="font-bold text-green-700">Answer: </span>
                                {q.referenceAnswer}
                              </div>
                            </div>
                          ) : (
                            /* MCQ: show options grid */
                            <div className="grid grid-cols-2 gap-1.5">
                              {q.options?.map((opt, oi) => (
                                <div key={oi}
                                  className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs border ${
                                    oi === q.correctAnswer
                                      ? 'bg-green-50 border-green-200 text-green-800 font-semibold'
                                      : 'bg-[#FFFDF8] border-[#E2DACB] text-[#252525]'
                                  }`}>
                                  <span className="font-bold shrink-0">{String.fromCharCode(65 + oi)})</span>
                                  <span>{opt}</span>
                                  {oi === q.correctAnswer && (
                                    <CheckCircle2 className="w-3.5 h-3.5 ml-auto shrink-0 text-green-600" />
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                          {q.explanation && (
                            <div className="text-[11px] text-[#66635D] bg-[#FFFDF8] border border-[#E2DACB] rounded-lg p-2">
                              <span className="font-bold text-[#244A73]">Explanation: </span>{q.explanation}
                            </div>
                          )}
                          {q._pipeline && (
                            <div className="text-[10px] text-[#66635D] flex flex-wrap gap-2">
                              <span>Gemini ✓</span>
                              {q._pipeline.groqDistractors && <span>Groq ✓</span>}
                              {q._pipeline.verifierCorrected && <span className="text-amber-600">Answer corrected by verifier</span>}
                              {q.topic && <span>Topic: {q.topic}</span>}
                              {q.difficulty && <span>Diff: {q.difficulty}</span>}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Sticky action bar */}
          <div className="sticky bottom-16 lg:bottom-0 bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-4 shadow-lg flex flex-wrap gap-3 items-center z-30">
            <div className="flex-1 min-w-0 space-y-0.5">
              {savedTestId && (
                <p className="text-xs text-green-700 font-semibold flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Test saved to your Saved Tests.
                </p>
              )}
              {saveError && <p className="text-xs text-red-600">{saveError}</p>}
              {roomError && <p className="text-xs text-red-600">{roomError}</p>}
              {roomCode && (
                <p className="text-xs text-[#244A73] font-bold">Room created: {roomCode}</p>
              )}
            </div>

            <button type="button" onClick={handleDiscard}
              className="flex items-center gap-1.5 px-3 py-2.5 border border-[#E2DACB] text-[#66635D] text-xs font-semibold rounded-xl hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Discard
            </button>

            {!savedTestId ? (
              <button type="button" onClick={handleSave} disabled={saving || questions.length === 0}
                className="flex items-center gap-1.5 px-4 py-2.5 border border-[#244A73] text-[#244A73] text-xs font-bold rounded-xl hover:bg-[#244A73] hover:text-white disabled:opacity-50 transition-colors">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {saving ? 'Saving…' : 'Save Test'}
              </button>
            ) : (
              <span className="text-xs text-green-700 font-semibold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Saved
              </span>
            )}

            <button type="button" onClick={handleCreateRoom}
              disabled={creatingRoom || questions.length === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 bg-[#244A73] text-white text-xs font-bold rounded-xl hover:bg-[#1a3a5c] disabled:opacity-50 transition-colors">
              {creatingRoom ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Swords className="w-3.5 h-3.5" />}
              {creatingRoom ? 'Creating Room…' : 'Create Room'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
