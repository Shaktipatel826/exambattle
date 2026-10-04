import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, CheckCircle2, XCircle, ArrowRight, ArrowLeft, Clock, Bookmark, 
  RotateCcw, Award, CheckSquare, FileText, AlertCircle, ChevronRight
} from 'lucide-react';

export const SoloPracticePage = ({ token, onComplete }) => {
  // Mode: 'CONFIG' | 'TEST' | 'RESULT'
  const [mode, setMode] = useState('CONFIG');
  
  // Test Configuration Options (Fetched from DB)
  const [configOptions, setConfigOptions] = useState({
    subjects: ['General Studies', 'Indian Polity', 'History', 'Geography', 'Economy', 'Science'],
    topics: ['All', 'Fundamental Rights', 'Revolt of 1857', 'Preamble', 'Supreme Court'],
    exams: ['All', 'SSC CGL', 'RRB NTPC', 'SBI PO', 'UPPSC'],
    difficulties: ['All', 'Easy', 'Medium', 'Hard']
  });

  // Selected Test Config
  const [config, setConfig] = useState({
    subject: 'General Studies',
    topic: 'All',
    exam: 'All',
    difficulty: 'All',
    questionCount: 10,
    timeLimitMinutes: 10,
    negativeMarking: 0.25,
    mode: 'SOLO'
  });

  // Active Test State
  const [testData, setTestData] = useState(null);
  const [questions, setQuestions] = useState([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [markedForReview, setMarkedForReview] = useState({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(600);
  const [loading, setLoading] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // Result & Attempt History State
  const [result, setResult] = useState(null);

  useEffect(() => {
    fetchConfigOptions();
  }, []);

  // Timer Countdown Effect
  useEffect(() => {
    if (mode !== 'TEST' || timeLeftSeconds <= 0) return;

    const timer = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [mode, timeLeftSeconds]);

  const fetchConfigOptions = async () => {
    try {
      const res = await fetch('/api/tests/config-options', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.configOptions) {
        setConfigOptions({
          subjects: data.configOptions.subjects.filter(s => s !== 'All'),
          topics: data.configOptions.topics,
          exams: data.configOptions.exams,
          difficulties: data.configOptions.difficulties
        });
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleStartTest = async (e) => {
    if (e) e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch('/api/tests/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(config)
      });
      const data = await res.json();
      if (data.success && data.test) {
        setTestData(data.test);
        setQuestions(data.test.questions || []);
        setCurrentIndex(0);
        setSelectedAnswers({});
        setMarkedForReview({});
        setTimeLeftSeconds((data.test.timeLimitMinutes || 10) * 60);
        setMode('TEST');
      } else {
        alert(data.message || 'Failed to generate test');
      }
    } catch (e) {
      alert('Error creating test session.');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectOption = (optIndex) => {
    setSelectedAnswers(prev => ({
      ...prev,
      [currentIndex]: optIndex
    }));
  };

  const handleClearAnswer = () => {
    setSelectedAnswers(prev => {
      const copy = { ...prev };
      delete copy[currentIndex];
      return copy;
    });
  };

  const handleToggleMarkForReview = () => {
    setMarkedForReview(prev => ({
      ...prev,
      [currentIndex]: !prev[currentIndex]
    }));
  };

  const handleAutoSubmit = () => {
    alert('Time limit expired! Auto-submitting your test paper...');
    handleSubmitTest();
  };

  const handleSubmitTest = async () => {
    setShowSubmitConfirm(false);
    setLoading(true);
    try {
      const totalTimeSpent = (testData?.timeLimitMinutes || 10) * 60 - timeLeftSeconds;
      const payload = questions.map((q, idx) => ({
        questionId: q._id,
        selectedOption: selectedAnswers[idx] !== undefined ? selectedAnswers[idx] : -1,
        subject: q.subject,
        topic: q.topic,
        timeTakenSeconds: 15
      }));

      const res = await fetch('/api/tests/submit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          testType: config.mode,
          subject: config.subject,
          topic: config.topic,
          exam: config.exam,
          negativeMarking: config.negativeMarking,
          timeTakenSeconds: totalTimeSpent,
          answers: payload
        })
      });

      const data = await res.json();
      if (data.success) {
        setResult(data.result);
        setMode('RESULT');
      } else {
        alert(data.message || 'Submission error');
      }
    } catch (e) {
      alert('Error submitting test');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60);
    const rem = secs % 60;
    return `${mins.toString().padStart(2, '0')}:${rem.toString().padStart(2, '0')}`;
  };

  // SUMMARY STATS FOR PALETTE
  const totalQCount = questions.length;
  const attemptedCount = Object.keys(selectedAnswers).length;
  const markedCount = Object.values(markedForReview).filter(Boolean).length;
  const unattemptedCount = totalQCount - attemptedCount;

  // 1. CONFIGURATION SCREEN
  if (mode === 'CONFIG') {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        <div className="glass-panel p-6 rounded-3xl border border-purple-500/40 bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900">
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-purple-400" /> STUDENT TEST ENGINE CONFIGURATOR
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure your exam practice session using authenticated, published questions from ExamiQ database.
          </p>
        </div>

        <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-5 text-xs">
          <form onSubmit={handleStartTest} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Subject Category</label>
                <select
                  value={config.subject}
                  onChange={e => setConfig({ ...config, subject: e.target.value })}
                  className="w-full glass-input"
                >
                  {configOptions.subjects.map((sub, i) => (
                    <option key={i} value={sub}>{sub}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Target Exam</label>
                <select
                  value={config.exam}
                  onChange={e => setConfig({ ...config, exam: e.target.value })}
                  className="w-full glass-input"
                >
                  {configOptions.exams.map((ex, i) => (
                    <option key={i} value={ex}>{ex}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Topic Filter</label>
                <select
                  value={config.topic}
                  onChange={e => setConfig({ ...config, topic: e.target.value })}
                  className="w-full glass-input"
                >
                  {configOptions.topics.map((top, i) => (
                    <option key={i} value={top}>{top}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Difficulty Level</label>
                <select
                  value={config.difficulty}
                  onChange={e => setConfig({ ...config, difficulty: e.target.value })}
                  className="w-full glass-input"
                >
                  {configOptions.difficulties.map((diff, i) => (
                    <option key={i} value={diff}>{diff}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Number of Questions</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={config.questionCount}
                  onChange={e => setConfig({ ...config, questionCount: Number(e.target.value) })}
                  className="w-full glass-input"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Time Limit (Minutes)</label>
                <input
                  type="number"
                  min={1}
                  max={120}
                  value={config.timeLimitMinutes}
                  onChange={e => setConfig({ ...config, timeLimitMinutes: Number(e.target.value) })}
                  className="w-full glass-input"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4 border-t border-slate-800 pt-4">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Negative Marking per Wrong Answer</label>
                <select
                  value={config.negativeMarking}
                  onChange={e => setConfig({ ...config, negativeMarking: Number(e.target.value) })}
                  className="w-full glass-input"
                >
                  <option value={0}>0.0 (No Negative Marking)</option>
                  <option value={0.25}>-0.25 Marks (SSC Standard)</option>
                  <option value={0.33}>-0.33 Marks (UPSC / Banking)</option>
                  <option value={0.50}>-0.50 Marks (High Penalty)</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Test Mode</label>
                <select
                  value={config.mode}
                  onChange={e => setConfig({ ...config, mode: e.target.value })}
                  className="w-full glass-input"
                >
                  <option value="SOLO">Solo Practice Test</option>
                  <option value="MOCK">Timed Mock Exam</option>
                  <option value="PYQ">Previous Year Questions (PYQ)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 text-white font-black text-sm uppercase tracking-wider shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
            >
              {loading ? 'GENERATING TEST...' : 'START TEST SESSION NOW'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  // 2. LIVE TEST SCREEN
  if (mode === 'TEST') {
    const currentQ = questions[currentIndex];
    const isAnswered = selectedAnswers[currentIndex] !== undefined;
    const isMarked = markedForReview[currentIndex];

    return (
      <div className="max-w-7xl mx-auto px-4 py-4 space-y-4 text-xs text-[#252525]">
        
        {/* Top Header Bar */}
        <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] flex justify-between items-center shadow-sm">
          <div>
            <span className="font-extrabold text-[#252525] text-sm">{config.subject} • {config.exam}</span>
            <p className="text-[11px] text-[#66635D] font-medium">Mode: {config.mode} | Negative Marking: -{config.negativeMarking}</p>
          </div>

          <div className="flex items-center gap-4">
            <div className={`px-4 py-2 rounded-xl border flex items-center gap-2 font-mono font-bold text-sm ${
              timeLeftSeconds < 120 ? 'bg-[#FDF2F2] text-[#9E2A2B] border-[#F87171] animate-pulse' : 'bg-[#F7F3EA] text-[#244A73] border-[#E2DACB]'
            }`}>
              <Clock className="w-4 h-4 text-[#244A73]" />
              <span>{formatTime(timeLeftSeconds)}</span>
            </div>

            <button
              onClick={() => setShowSubmitConfirm(true)}
              className="px-4 py-2 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-extrabold uppercase tracking-wider text-xs shadow-sm"
            >
              SUBMIT PAPER
            </button>
          </div>
        </div>

        {/* Main Content Layout (Question Box + Question Palette) */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          
          {/* Left 3 Cols: Question & Options */}
          <div className="lg:col-span-3 space-y-4">
            {currentQ && (
              <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-5">
                
                {/* Question Metadata */}
                <div className="flex justify-between items-center border-b border-[#E2DACB] pb-3">
                  <span className="font-bold text-[#66635D]">
                    Question {currentIndex + 1} of {questions.length}
                  </span>
                  <div className="flex gap-2">
                    <span className="bg-[#EFE9DC] text-[#252525] px-2.5 py-1 rounded text-[10px] font-bold border border-[#D5CDBF]">
                      {currentQ.difficulty || 'Medium'}
                    </span>
                    <span className="bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] px-2.5 py-1 rounded text-[10px] font-bold">
                      {currentQ.topic || 'General'}
                    </span>
                  </div>
                </div>

                {/* Explicitly Readable Dark Charcoal Question Text */}
                <p className="text-sm sm:text-base font-extrabold text-[#252525] leading-relaxed opacity-100">
                  {currentQ.question}
                </p>

                {/* Options List */}
                <div className="space-y-2.5">
                  {currentQ.options.map((opt, oIdx) => {
                    const isSelected = selectedAnswers[currentIndex] === oIdx;
                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleSelectOption(oIdx)}
                        className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm transition-all flex items-center justify-between ${
                          isSelected
                            ? 'bg-[#EFE9DC] border-[#244A73] text-[#244A73] font-black shadow-sm'
                            : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                        }`}
                      >
                        <span className="text-[#252525] font-semibold"><strong className="mr-2 text-[#244A73]">{String.fromCharCode(65 + oIdx)}.</strong> {opt}</span>
                        {isSelected && <CheckCircle2 className="w-5 h-5 text-[#244A73] shrink-0" />}
                      </button>
                    );
                  })}
                </div>

                {/* Question Bottom Action Bar */}
                <div className="border-t border-[#E2DACB] pt-4 flex flex-wrap justify-between items-center gap-2">
                  <div className="flex gap-2">
                    <button
                      onClick={handleToggleMarkForReview}
                      className={`px-3 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 border ${
                        isMarked
                          ? 'bg-[#D97706] text-white border-[#B45309]'
                          : 'bg-[#F7F3EA] border-[#E2DACB] text-[#66635D] hover:text-[#252525]'
                      }`}
                    >
                      <Bookmark className="w-3.5 h-3.5" />
                      {isMarked ? 'Marked for Review' : 'Mark for Review'}
                    </button>

                    {isAnswered && (
                      <button
                        onClick={handleClearAnswer}
                        className="px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#9E2A2B] hover:bg-[#FDF2F2] text-xs font-bold flex items-center gap-1"
                      >
                        <RotateCcw className="w-3.5 h-3.5" /> Clear Answer
                      </button>
                    )}
                  </div>

                  <div className="flex gap-2">
                    <button
                      disabled={currentIndex === 0}
                      onClick={() => setCurrentIndex(currentIndex - 1)}
                      className="px-4 py-2 rounded-xl bg-[#FFFDF8] border border-[#E2DACB] text-[#252525] font-bold disabled:opacity-40 flex items-center gap-1"
                    >
                      <ArrowLeft className="w-3.5 h-3.5" /> Previous
                    </button>
                    
                    <button
                      disabled={currentIndex === questions.length - 1}
                      onClick={() => setCurrentIndex(currentIndex + 1)}
                      className="px-4 py-2 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold disabled:opacity-40 flex items-center gap-1"
                    >
                      Next <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Right 1 Col: Question Palette Navigation */}
          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4">
            <h3 className="font-bold text-[#252525] text-xs flex items-center gap-1.5">
              <CheckSquare className="w-4 h-4 text-[#244A73]" /> QUESTION PALETTE
            </h3>

            {/* Summary Counters */}
            <div className="grid grid-cols-2 gap-2 text-[10px] font-bold">
              <div className="p-2 rounded-xl bg-[#EFE9DC] border border-[#2D6A4F]/30 text-[#2D6A4F] text-center">
                Attempted: {attemptedCount}
              </div>
              <div className="p-2 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#66635D] text-center">
                Unattempted: {unattemptedCount}
              </div>
              <div className="p-2 rounded-xl bg-[#FEF3C7] border border-[#F59E0B]/30 text-[#B45309] text-center col-span-2">
                Marked for Review: {markedCount}
              </div>
            </div>

            {/* Number Palette Grid */}
            <div className="grid grid-cols-5 gap-2 max-h-64 overflow-y-auto pr-1">
              {questions.map((q, idx) => {
                const ans = selectedAnswers[idx] !== undefined;
                const rev = markedForReview[idx];
                const active = idx === currentIndex;

                let paletteStyle = 'bg-[#F7F3EA] text-[#66635D] border-[#E2DACB]';
                if (ans && rev) paletteStyle = 'bg-[#B45309] text-white border-[#92400E] font-black';
                else if (ans) paletteStyle = 'bg-[#2D6A4F] text-white border-[#1B4332] font-black';
                else if (rev) paletteStyle = 'bg-[#244A73] text-white border-[#1B3857] font-black';

                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentIndex(idx)}
                    className={`h-9 rounded-lg text-xs font-bold border transition-all flex items-center justify-center ${paletteStyle} ${
                      active ? 'ring-2 ring-[#244A73] ring-offset-2 ring-offset-[#F7F3EA]' : ''
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>
          </div>

        </div>

        {/* SUBMIT CONFIRMATION MODAL */}
        {showSubmitConfirm && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-xl max-w-md w-full space-y-4">
              <h3 className="text-base font-bold text-[#252525] flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-[#B45309]" /> Confirm Test Paper Submission
              </h3>
              
              <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] space-y-2 text-xs">
                <p className="text-[#252525]">Are you sure you want to finalize and submit your test paper?</p>
                <div className="grid grid-cols-3 gap-2 text-center pt-2 font-bold">
                  <div className="text-[#2D6A4F]">Attempted: {attemptedCount}</div>
                  <div className="text-[#66635D]">Unattempted: {unattemptedCount}</div>
                  <div className="text-[#B45309]">Review: {markedCount}</div>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowSubmitConfirm(false)}
                  className="flex-1 py-2.5 rounded-xl bg-[#EFE9DC] hover:bg-[#E2DACB] text-[#252525] font-bold"
                >
                  Continue Test
                </button>
                <button
                  onClick={handleSubmitTest}
                  className="flex-1 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold"
                >
                  Submit Final Answers
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    );
  }

  // 3. POST-TEST RESULT & QUESTION-WISE REVIEW PAGE
  if (mode === 'RESULT' && result) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6 text-xs">
        
        {/* Score Card */}
        <div className="bg-[#FFFDF8] p-8 rounded-3xl border border-[#E2DACB] shadow-sm text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#EFE9DC] text-[#2D6A4F] flex items-center justify-center border border-[#E2DACB]">
            <Award className="w-8 h-8 text-[#2D6A4F]" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-[#252525]">TEST COMPLETED & VERIFIED</h2>
            <p className="text-[#66635D] text-xs">Server-calculated score and breakdown record.</p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#F7F3EA] p-4 rounded-2xl border border-[#E2DACB] text-center">
            <div>
              <span className="text-[10px] text-[#66635D] font-bold block">FINAL SCORE</span>
              <span className="text-2xl font-black text-[#244A73]">{result.score} / {result.totalQuestions}</span>
            </div>
            <div>
              <span className="text-[10px] text-[#66635D] font-bold block">ACCURACY</span>
              <span className="text-2xl font-black text-[#2D6A4F]">{result.accuracy}%</span>
            </div>
            <div>
              <span className="text-[10px] text-[#66635D] font-bold block">CORRECT / WRONG</span>
              <span className="text-xl font-black text-[#252525]">
                <span className="text-[#2D6A4F]">{result.correctCount}</span> / <span className="text-[#9E2A2B]">{result.wrongCount}</span>
              </span>
            </div>
            <div>
              <span className="text-[10px] text-[#66635D] font-bold block">XP REWARD</span>
              <span className="text-2xl font-black text-[#B45309]">+{result.xpEarned} XP</span>
            </div>
          </div>

          <button
            onClick={() => setMode('CONFIG')}
            className="px-8 py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-bold text-xs shadow-sm uppercase tracking-wider"
          >
            START ANOTHER PRACTICE TEST
          </button>
        </div>

        {/* Question-Wise Detailed Review Section */}
        {result.questionReviews && result.questionReviews.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#244A73]" /> Question-Wise Detailed Review
            </h3>

            {result.questionReviews.map((rev, idx) => (
              <div key={idx} className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-3">
                <div className="flex justify-between items-start">
                  <span className="font-bold text-[#66635D] text-xs">Question {idx + 1}</span>
                  <span className={`px-2.5 py-0.5 rounded text-[10px] font-bold ${
                    rev.isCorrect ? 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]' :
                    rev.selectedOption === -1 ? 'bg-[#EFE9DC] text-[#66635D]' :
                    'bg-[#FEE2E2] text-[#991B1B] border border-[#EF4444]'
                  }`}>
                    {rev.isCorrect ? 'CORRECT (+1.0)' : rev.selectedOption === -1 ? 'UNATTEMPTED (0.0)' : `WRONG (-${config.negativeMarking})`}
                  </span>
                </div>

                <p className="font-extrabold text-[#252525] text-sm leading-relaxed opacity-100">{rev.question}</p>

                <div className="grid grid-cols-2 gap-2">
                  {rev.options.map((opt, oIdx) => {
                    const isSelected = rev.selectedOption === oIdx;
                    const isCorrect = rev.correctAnswer === oIdx;
                    
                    let style = 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]';
                    if (isCorrect) style = 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] font-bold';
                    else if (isSelected && !isCorrect) style = 'bg-[#FEE2E2] border-[#EF4444] text-[#991B1B] font-bold';

                    return (
                      <div key={oIdx} className={`p-2.5 rounded-lg border text-xs ${style}`}>
                        <strong className="mr-1">{String.fromCharCode(65 + oIdx)}:</strong> {opt}
                        {isCorrect && <span className="ml-2 text-[#065F46] font-bold">(Correct Answer)</span>}
                        {isSelected && !isCorrect && <span className="ml-2 text-[#991B1B] font-bold">(Your Choice)</span>}
                      </div>
                    );
                  })}
                </div>

                {rev.explanation && (
                  <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#252525] text-[11px] space-y-1">
                    <span className="font-bold text-[#244A73] block">Explanation:</span>
                    <p className="text-[#252525] leading-relaxed">{rev.explanation}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

      </div>
    );
  }

  return null;
};

