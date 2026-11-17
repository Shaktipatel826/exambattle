import React, { useState, useEffect, useCallback, useRef } from 'react';
import { io } from 'socket.io-client';
import {
  Calculator, Users, Clock, Trophy, Play, RotateCcw, AlertCircle,
  CheckCircle2, Loader2, Zap, Target, Star, ArrowLeft, Copy, ChevronRight
} from 'lucide-react';
import { getSocketUrl } from '../lib/apiConfig';

// ─── Constants ────────────────────────────────────────────────────────────────

const DIFFICULTIES = [
  { id: 'easy',   label: 'Easy',   desc: 'Basic operations' },
  { id: 'medium', label: 'Medium', desc: 'Competitive level' },
  { id: 'hard',   label: 'Hard',   desc: 'Advanced problems' },
  { id: 'expert', label: 'Expert', desc: 'Exam-grade challenge' },
];

const DURATIONS = [
  { sec: 60,  label: '1 Min',  desc: 'Quick Duel' },
  { sec: 120, label: '2 Min',  desc: 'Standard' },
  { sec: 180, label: '3 Min',  desc: 'Marathon' },
];

const CATEGORY_GROUPS = [
  {
    label: 'Basic Operations',
    cats: [
      { id: 'addition',       label: 'Addition' },
      { id: 'subtraction',    label: 'Subtraction' },
      { id: 'multiplication', label: 'Multiplication' },
      { id: 'division',       label: 'Division' },
    ],
  },
  {
    label: 'Number Theory',
    cats: [
      { id: 'lcm',           label: 'LCM' },
      { id: 'hcf',           label: 'HCF' },
      { id: 'number_system', label: 'Number System' },
    ],
  },
  {
    label: 'Powers & Roots',
    cats: [
      { id: 'squares',     label: 'Squares' },
      { id: 'cubes',       label: 'Cubes' },
      { id: 'square_root', label: 'Square Root' },
      { id: 'cube_root',   label: 'Cube Root' },
    ],
  },
  {
    label: 'Advanced',
    cats: [
      { id: 'trigonometry', label: 'Trigonometry' },
      { id: 'logarithm',    label: 'Logarithm' },
      { id: 'arithmetic',   label: 'Arithmetic' },
      { id: 'mixed',        label: 'Mixed' },
    ],
  },
];

const ALL_CAT_IDS = CATEGORY_GROUPS.flatMap(g => g.cats.map(c => c.id));

// ─── Helper: format timer ──────────────────────────────────────────────────────
function fmtTime(secs) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

// ─── Numeric Keypad Component ─────────────────────────────────────────────────
function NumericKeypad({ value, onChange, onSubmit, disabled }) {
  const append = (ch) => {
    if (disabled) return;
    // Max 10 chars
    if (String(value).length >= 10) return;
    // Prevent double dots
    if (ch === '.' && String(value).includes('.')) return;
    // Prevent leading zeros (except "0.")
    if (ch !== '.' && value === '0') { onChange(ch); return; }
    onChange(String(value) + ch);
  };
  const backspace = () => {
    if (disabled) return;
    const s = String(value);
    onChange(s.length <= 1 ? '' : s.slice(0, -1));
  };
  const clear = () => { if (!disabled) onChange(''); };
  const toggleSign = () => {
    if (disabled) return;
    const s = String(value);
    if (!s || s === '0' || s === '') return;
    onChange(s.startsWith('-') ? s.slice(1) : '-' + s);
  };

  const btnClass = `
    flex items-center justify-center rounded-2xl font-black text-xl
    h-14 w-full border-2 transition-all active:scale-95 select-none
    touch-manipulation cursor-pointer
  `;

  const rows = [
    ['7','8','9'],
    ['4','5','6'],
    ['1','2','3'],
    ['±','0','.'],
  ];

  return (
    <div className="space-y-2">
      {rows.map((row, ri) => (
        <div key={ri} className="grid grid-cols-3 gap-2">
          {row.map(ch => (
            <button
              key={ch}
              onPointerDown={e => { e.preventDefault(); ch === '±' ? toggleSign() : append(ch); }}
              disabled={disabled}
              className={`${btnClass} ${
                ch === '±'
                  ? 'bg-[#EFE9DC] border-[#D5CDBF] text-[#66635D] text-base disabled:opacity-40'
                  : 'bg-[#FFFDF8] border-[#E2DACB] text-[#252525] hover:bg-[#EFE9DC] disabled:opacity-40'
              }`}
            >
              {ch === '±' ? '±' : ch}
            </button>
          ))}
        </div>
      ))}
      <div className="grid grid-cols-3 gap-2">
        <button
          onPointerDown={e => { e.preventDefault(); clear(); }}
          disabled={disabled}
          className={`${btnClass} bg-[#FEF2F2] border-red-200 text-red-600 text-sm font-black disabled:opacity-40`}
        >
          CLR
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); backspace(); }}
          disabled={disabled}
          className={`${btnClass} bg-[#EFE9DC] border-[#D5CDBF] text-[#252525] disabled:opacity-40`}
        >
          ⌫
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); onSubmit(); }}
          disabled={disabled || value === '' || value === '-'}
          className={`${btnClass} bg-[#2D6A4F] border-[#1B4332] text-white text-sm disabled:opacity-40`}
        >
          OK
        </button>
      </div>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export const CalculationArenaPage = ({ token, user }) => {
  const [socket, setSocket] = useState(null);
  const [view, setView] = useState('SETUP'); // SETUP | LOBBY | BATTLE | RESULT

  // Setup config
  const [mode, setMode] = useState('mixed'); // 'mixed' | 'topic'
  const [selectedCats, setSelectedCats] = useState(ALL_CAT_IDS);
  const [difficulty, setDifficulty] = useState('medium');
  const [duration, setDuration] = useState(60);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [createMode, setCreateMode] = useState('create'); // 'create' | 'join'

  // Room state
  const [roomState, setRoomState] = useState(null);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  // Battle state
  const [currentQ, setCurrentQ] = useState(null);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [inputValue, setInputValue] = useState('');
  const [myScore, setMyScore] = useState({ correct: 0, wrong: 0, attempted: 0 });
  const [opponentScore, setOpponentScore] = useState({ correct: 0, wrong: 0, attempted: 0 });
  const [timeLeft, setTimeLeft] = useState(0);
  const [feedback, setFeedback] = useState(null); // null | 'correct' | 'wrong'
  const [submitting, setSubmitting] = useState(false);
  const [lastLatency, setLastLatency] = useState(null);
  const [flashCorrect, setFlashCorrect] = useState(false);
  const [flashWrong, setFlashWrong] = useState(false);

  // Result state
  const [resultPayload, setResultPayload] = useState(null);

  const endTimeRef = useRef(null);
  const timerRef = useRef(null);

  const myId = user?.id || user?._id;

  // ── Socket setup ─────────────────────────────────────────────────────────────
  useEffect(() => {
    const socketUrl = getSocketUrl();
    const s = io(socketUrl, { transports: ['websocket', 'polling'] });
    setSocket(s);

    s.on('connect', () => console.log('[Calc] Socket connected:', s.id));
    s.on('connect_error', err => console.error('[Calc] Connect error:', err.message));

    s.on('calculation_room_updated', (room) => {
      setRoomState(room);
      if (room.status === 'LOBBY') {
        setView(prev => prev === 'RESULT' ? 'LOBBY' : prev);
      }
    });

    s.on('calculation_lobby_updated', (room) => {
      setRoomState(room);
      setCurrentQ(null);
      setCurrentQIndex(0);
      setInputValue('');
      setFeedback(null);
      setSubmitting(false);
      setMyScore({ correct: 0, wrong: 0, attempted: 0 });
      setOpponentScore({ correct: 0, wrong: 0, attempted: 0 });
      setView('LOBBY');
    });

    s.on('calculation_settings_updated', ({ config }) => {
      setRoomState(prev => prev ? { ...prev, config: { ...prev.config, ...config } } : prev);
    });

    s.on('calculation_battle_started', ({ startTime, endTime, config }) => {
      const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
      setTimeLeft(remaining);
      endTimeRef.current = endTime;
      setCurrentQIndex(0);
      setInputValue('');
      setFeedback(null);
      setSubmitting(false);
      setResultPayload(null);
      setMyScore({ correct: 0, wrong: 0, attempted: 0 });
      setOpponentScore({ correct: 0, wrong: 0, attempted: 0 });
      setView('BATTLE');
    });

    s.on('calculation_question', ({ question, qIndex }) => {
      setCurrentQ(question);
      setCurrentQIndex(qIndex);
      setInputValue('');
      setFeedback(null);
      setSubmitting(false);
    });

    s.on('calculation_scores_updated', ({ players }) => {
      const me = players.find(p => String(p.userId) === String(myId));
      const opp = players.find(p => String(p.userId) !== String(myId));
      if (me) setMyScore({ correct: me.correct, wrong: me.wrong, attempted: me.attempted });
      if (opp) setOpponentScore({ correct: opp.correct, wrong: opp.wrong, attempted: opp.attempted });
    });

    s.on('calculation_battle_finished', (payload) => {
      clearInterval(timerRef.current);
      setResultPayload(payload);
      setView('RESULT');
    });

    s.on('reconnect', () => {
      if (roomState?.roomCode) {
        s.emit('join_calculation_room', { roomCode: roomState.roomCode, user }, (resp) => {
          if (resp?.success) setRoomState(resp.room);
        });
      }
    });

    return () => { clearInterval(timerRef.current); s.disconnect(); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep local config in sync with roomState config
  useEffect(() => {
    if (roomState?.config) {
      if (roomState.config.durationSeconds) setDuration(roomState.config.durationSeconds);
      if (roomState.config.difficulty) setDifficulty(roomState.config.difficulty);
      if (roomState.config.categories) setSelectedCats(roomState.config.categories);
      if (roomState.config.mode) setMode(roomState.config.mode);
    }
  }, [roomState?.config]);

  // ── Server-authoritative countdown ──────────────────────────────────────────
  useEffect(() => {
    if (view !== 'BATTLE' || !endTimeRef.current) return;
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      const remaining = Math.max(0, Math.floor((endTimeRef.current - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) clearInterval(timerRef.current);
    }, 500);
    return () => clearInterval(timerRef.current);
  }, [view]);

  // ── Physical keyboard support ────────────────────────────────────────────────
  useEffect(() => {
    if (view !== 'BATTLE') return;
    const handler = (e) => {
      if (e.key >= '0' && e.key <= '9') {
        setInputValue(prev => prev.length >= 10 ? prev : prev + e.key);
      } else if (e.key === '.') {
        setInputValue(prev => prev.includes('.') ? prev : prev + '.');
      } else if (e.key === 'Backspace') {
        setInputValue(prev => prev.slice(0, -1));
      } else if (e.key === 'Enter' || e.key === ' ') {
        handleSubmitAnswer();
      } else if (e.key === '-') {
        setInputValue(prev => prev.startsWith('-') ? prev.slice(1) : '-' + prev);
      } else if (e.key === 'Escape') {
        setInputValue('');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [view, inputValue, currentQ, currentQIndex, roomState, submitting]); // eslint-disable-line

  // ── Room actions ─────────────────────────────────────────────────────────────
  const handleCreateRoom = () => {
    if (!socket || !user) return;
    setError('');
    const categories = mode === 'mixed' ? ALL_CAT_IDS : selectedCats.length ? selectedCats : ALL_CAT_IDS;
    socket.emit('create_calculation_room', {
      user: { id: user.id || user._id, name: user.name },
      config: { categories, difficulty, durationSeconds: duration },
    }, (resp) => {
      if (resp?.success) {
        setRoomState(resp.room);
        setView('LOBBY');
      } else {
        setError(resp?.message || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !user || !roomCodeInput.trim()) return;
    setError('');
    socket.emit('join_calculation_room', {
      roomCode: roomCodeInput.trim().toUpperCase(),
      user: { id: user.id || user._id, name: user.name },
    }, (resp) => {
      if (resp?.success) {
        setRoomState(resp.room);
        if (resp.alreadyFinished) {
          // Will be handled by calculation_battle_finished event
        } else {
          setView('LOBBY');
        }
      } else {
        setError(resp?.message || 'Room not found');
      }
    });
  };

  const handleStartBattle = () => {
    if (!socket || !roomState) return;
    socket.emit('start_calculation_battle', {
      roomCode: roomState.roomCode,
      userId: myId,
    }, (resp) => {
      if (resp?.success) {
        // Apply battle state immediately from the ack.
        // The socket event 'calculation_battle_started' will also arrive and is idempotent,
        // but we cannot rely on it alone — the host's socket may have drifted from the
        // Socket.IO room between create and start (transport upgrade, brief reconnect).
        const endTime = resp.endTime;
        const remaining = Math.max(0, Math.floor((endTime - Date.now()) / 1000));
        endTimeRef.current = endTime;
        setTimeLeft(remaining);
        setCurrentQIndex(0);
        setInputValue('');
        setFeedback(null);
        setSubmitting(false);
        setResultPayload(null);
        setMyScore({ correct: 0, wrong: 0, attempted: 0 });
        setOpponentScore({ correct: 0, wrong: 0, attempted: 0 });
        setView('BATTLE');
      } else {
        setError(resp?.message || 'Could not start battle');
      }
    });
  };

  const handleUpdateConfig = (updates) => {
    if (!socket || !roomState) return;
    const isHost = roomState?.hostId === myId || String(roomState?.hostId) === String(myId);
    if (!isHost) return;

    const newConfig = {
      durationSeconds: updates.durationSeconds ?? (roomState?.config?.durationSeconds || duration),
      difficulty: updates.difficulty ?? (roomState?.config?.difficulty || difficulty),
      categories: updates.categories ?? (roomState?.config?.categories || (mode === 'mixed' ? ALL_CAT_IDS : selectedCats)),
      mode: updates.mode ?? (roomState?.config?.mode || mode),
    };

    if (updates.durationSeconds !== undefined) setDuration(updates.durationSeconds);
    if (updates.difficulty !== undefined) setDifficulty(updates.difficulty);
    if (updates.categories !== undefined) setSelectedCats(updates.categories);
    if (updates.mode !== undefined) setMode(updates.mode);

    socket.emit('calculation_update_settings', {
      roomCode: roomState.roomCode,
      userId: myId,
      config: newConfig,
    }, (resp) => {
      if (!resp?.success) {
        setError(resp?.message || 'Failed to update settings');
      }
    });
  };

  const handleRematch = () => {
    if (!socket || !roomState) return;
    setError('');
    socket.emit('calculation_rematch_requested', {
      roomCode: roomState.roomCode,
      userId: myId,
    }, (resp) => {
      if (resp?.success) {
        setRoomState(resp.room);
        setCurrentQ(null);
        setCurrentQIndex(0);
        setInputValue('');
        setFeedback(null);
        setSubmitting(false);
        setMyScore({ correct: 0, wrong: 0, attempted: 0 });
        setOpponentScore({ correct: 0, wrong: 0, attempted: 0 });
        setView('LOBBY');
      } else {
        setError(resp?.message || 'Could not request rematch');
      }
    });
  };

  const handleLeaveRoom = () => {
    if (socket && roomState) {
      socket.emit('leave_calculation_room', { roomCode: roomState.roomCode, userId: myId });
    }
    resetState();
  };

  const resetState = () => {
    setView('SETUP');
    setRoomState(null);
    setCurrentQ(null);
    setCurrentQIndex(0);
    setInputValue('');
    setMyScore({ correct: 0, wrong: 0, attempted: 0 });
    setOpponentScore({ correct: 0, wrong: 0, attempted: 0 });
    setResultPayload(null);
    setFeedback(null);
    setSubmitting(false);
    setError('');
    clearInterval(timerRef.current);
  };

  // ── Answer submission ─────────────────────────────────────────────────────────
  const handleSubmitAnswer = useCallback(() => {
    if (!socket || !roomState || submitting || !currentQ || inputValue === '' || inputValue === '-') return;
    setSubmitting(true);
    const submitTime = Date.now();

    socket.emit('submit_calculation_answer', {
      roomCode: roomState.roomCode,
      userId:   myId,
      qIndex:   currentQIndex,
      answer:   inputValue,
    }, (resp) => {
      const latency = Date.now() - submitTime;
      setLastLatency(latency);
      setSubmitting(false);

      if (resp?.reason === 'time_expired' || resp?.reason === 'not_active') {
        return; // Timer handled by server
      }

      if (resp?.correct) {
        // Correct — flash green, advance question
        setFlashCorrect(true);
        setTimeout(() => setFlashCorrect(false), 300);
        if (resp.playerScore) {
          setMyScore(resp.playerScore);
        }
        if (resp.nextQuestion) {
          setCurrentQ(resp.nextQuestion);
          setCurrentQIndex(resp.nextQIndex);
          setInputValue('');
          setFeedback(null);
        } else {
          // No more questions (ran out of pre-generated batch — extremely rare at 200 q)
          setInputValue('');
          setFeedback('correct');
        }
      } else {
        // Wrong — flash red, stay on same question
        setFlashWrong(true);
        setTimeout(() => setFlashWrong(false), 400);
        if (resp.playerScore) setMyScore(resp.playerScore);
        setInputValue('');
        setFeedback('wrong');
        setTimeout(() => setFeedback(null), 1200);
      }
    });
  }, [socket, roomState, submitting, currentQ, inputValue, currentQIndex, myId]);

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomState?.roomCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Category toggle ───────────────────────────────────────────────────────────
  const toggleCat = (id) => {
    setSelectedCats(prev =>
      prev.includes(id)
        ? prev.length > 1 ? prev.filter(c => c !== id) : prev // keep at least 1
        : [...prev, id]
    );
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: SETUP
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'SETUP') {
    return (
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">

        {/* Header */}
        <div className="bg-[#244A73] p-6 rounded-2xl text-center space-y-2 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-2">
            <Calculator className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">CALCULATION ARENA</h1>
          <p className="text-xs text-white/70 max-w-md mx-auto">
            1v1 Mental Maths Speed Battle · Solve more calculations than your opponent
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" /><span>{error}</span>
          </div>
        )}

        {/* Mode selection */}
        <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-3">
          <h2 className="text-xs font-black text-[#252525] uppercase tracking-wider">Challenge Mode</h2>
          <div className="grid grid-cols-2 gap-2">
            {[
              { id: 'mixed', label: 'Mixed Challenge', desc: 'All categories randomly' },
              { id: 'topic', label: 'Topic Challenge', desc: 'You pick the categories' },
            ].map(m => (
              <button
                key={m.id}
                onClick={() => setMode(m.id)}
                className={`p-3 rounded-xl border text-xs text-left transition-all ${
                  mode === m.id
                    ? 'bg-[#244A73] border-[#244A73] text-white'
                    : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                }`}
              >
                <div className="font-black">{m.label}</div>
                <div className={`text-[10px] mt-0.5 ${mode === m.id ? 'text-white/70' : 'text-[#66635D]'}`}>{m.desc}</div>
              </button>
            ))}
          </div>

          {/* Category selector for Topic Challenge */}
          {mode === 'topic' && (
            <div className="space-y-3 pt-1">
              {CATEGORY_GROUPS.map(grp => (
                <div key={grp.label}>
                  <p className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider mb-1.5">{grp.label}</p>
                  <div className="flex flex-wrap gap-1.5">
                    {grp.cats.map(cat => (
                      <button
                        key={cat.id}
                        onClick={() => toggleCat(cat.id)}
                        className={`px-2.5 py-1 rounded-lg border text-[11px] font-bold transition-all ${
                          selectedCats.includes(cat.id)
                            ? 'bg-[#244A73] border-[#244A73] text-white'
                            : 'bg-[#F7F3EA] border-[#E2DACB] text-[#66635D] hover:border-[#244A73]'
                        }`}
                      >
                        {cat.label}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Difficulty + Duration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] shadow-sm space-y-2">
            <h2 className="text-xs font-black text-[#252525] uppercase tracking-wider">Difficulty</h2>
            <div className="grid grid-cols-2 gap-1.5">
              {DIFFICULTIES.map(d => (
                <button
                  key={d.id}
                  onClick={() => setDifficulty(d.id)}
                  className={`p-2.5 rounded-xl border text-[11px] text-left transition-all ${
                    difficulty === d.id
                      ? 'bg-[#244A73] border-[#244A73] text-white'
                      : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                  }`}
                >
                  <div className="font-black">{d.label}</div>
                  <div className={`text-[10px] ${difficulty === d.id ? 'text-white/70' : 'text-[#66635D]'}`}>{d.desc}</div>
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] shadow-sm space-y-2">
            <h2 className="text-xs font-black text-[#252525] uppercase tracking-wider">Duration</h2>
            <div className="space-y-1.5">
              {DURATIONS.map(d => (
                <button
                  key={d.sec}
                  onClick={() => setDuration(d.sec)}
                  className={`w-full p-2.5 rounded-xl border text-xs text-left transition-all flex items-center justify-between ${
                    duration === d.sec
                      ? 'bg-[#244A73] border-[#244A73] text-white'
                      : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                  }`}
                >
                  <span className="font-black">{d.label}</span>
                  <span className={`text-[10px] ${duration === d.sec ? 'text-white/70' : 'text-[#66635D]'}`}>{d.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Create / Join */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={() => setCreateMode('create')}
            className={`py-2 rounded-xl border text-xs font-black transition-all ${
              createMode === 'create'
                ? 'bg-[#244A73] border-[#244A73] text-white'
                : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
            }`}
          >
            Create Room
          </button>
          <button
            onClick={() => setCreateMode('join')}
            className={`py-2 rounded-xl border text-xs font-black transition-all ${
              createMode === 'join'
                ? 'bg-[#2D6A4F] border-[#2D6A4F] text-white'
                : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
            }`}
          >
            Join Room
          </button>
        </div>

        {createMode === 'join' && (
          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] space-y-3">
            <label className="block text-xs font-bold text-[#252525]">Room Code</label>
            <input
              type="text"
              maxLength={6}
              placeholder="C•••••"
              value={roomCodeInput}
              onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
              className="w-full px-4 py-3 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-center text-2xl font-mono font-black uppercase tracking-widest text-[#244A73] focus:outline-none focus:border-[#244A73]"
            />
            <button
              onClick={handleJoinRoom}
              disabled={!roomCodeInput.trim()}
              className="w-full py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider disabled:opacity-50 transition-all"
            >
              JOIN BATTLE ROOM
            </button>
          </div>
        )}

        {createMode === 'create' && (
          <button
            onClick={handleCreateRoom}
            className="w-full py-4 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
          >
            <Zap className="w-4 h-4" /> CREATE CALCULATION ROOM
          </button>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: LOBBY
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'LOBBY') {
    const isHost = roomState?.hostId === myId || String(roomState?.hostId) === String(myId);
    return (
      <div className="max-w-xl mx-auto px-4 py-8">
        <div className="bg-[#FFFDF8] p-8 rounded-3xl border border-[#E2DACB] shadow-sm text-center space-y-6">
          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] uppercase tracking-widest">
            Calculation Arena · Lobby
          </span>

          {/* Room Code */}
          <div>
            <span className="text-xs text-[#66635D] font-semibold uppercase tracking-wider block mb-2">
              Share this code with your opponent
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-black text-[#244A73] tracking-widest bg-[#F7F3EA] px-6 py-3 rounded-2xl border border-[#E2DACB] select-all">
                {roomState?.roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-3 rounded-xl bg-[#EFE9DC] border border-[#D5CDBF] text-[#244A73] hover:bg-[#E2DACB] transition-all"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Previous Match Scorecard Banner (if continuous rematch) */}
          {resultPayload?.leaderboard && (
            <div className="bg-[#F7F3EA] border border-[#E2DACB] rounded-2xl p-4 text-xs text-left space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-extrabold text-[10px] text-[#66635D] uppercase tracking-wider">Previous Battle Scorecard</span>
                <span className="font-black text-[11px] text-[#244A73]">
                  {resultPayload.leaderboard[0]?.result === 'DRAW'
                    ? "DRAW"
                    : `${resultPayload.leaderboard[0]?.name} Won`}
                </span>
              </div>
              <div className="flex items-center justify-between font-bold text-xs">
                {resultPayload.leaderboard.map(e => (
                  <span key={e.userId} className={String(e.userId) === String(myId) ? 'text-[#244A73]' : 'text-[#252525]'}>
                    {e.name}: {e.correct} correct ({e.accuracy}%)
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Battle Settings Panel (Host controls, opponent sees live sync) */}
          <div className="bg-[#F7F3EA] p-4 rounded-2xl border border-[#E2DACB] text-left space-y-3.5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-black text-[#252525] uppercase tracking-wider">
                Battle Settings
              </h3>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                isHost
                  ? 'bg-[#EFE9DC] text-[#244A73] border-[#244A73]/30'
                  : 'bg-[#FFFDF8] text-[#66635D] border-[#D5CDBF]'
              }`}>
                {isHost ? '⭐ You Control Settings' : 'Controlled by Host'}
              </span>
            </div>

            {/* Duration */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider">Duration</span>
              <div className="grid grid-cols-3 gap-1.5">
                {DURATIONS.map(d => {
                  const active = (roomState?.config?.durationSeconds || duration) === d.sec;
                  return (
                    <button
                      key={d.sec}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleUpdateConfig({ durationSeconds: d.sec })}
                      className={`py-2 px-1 rounded-xl border text-xs font-black text-center transition-all ${
                        active
                          ? 'bg-[#244A73] border-[#244A73] text-white shadow-sm'
                          : 'bg-[#FFFDF8] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                      } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Difficulty */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider">Difficulty</span>
              <div className="grid grid-cols-4 gap-1.5">
                {DIFFICULTIES.map(d => {
                  const active = (roomState?.config?.difficulty || difficulty) === d.id;
                  return (
                    <button
                      key={d.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleUpdateConfig({ difficulty: d.id })}
                      className={`py-2 px-1 rounded-xl border text-[11px] font-black text-center transition-all ${
                        active
                          ? 'bg-[#244A73] border-[#244A73] text-white shadow-sm'
                          : 'bg-[#FFFDF8] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                      } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                    >
                      {d.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Mode */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider">Challenge Mode</span>
              <div className="grid grid-cols-2 gap-1.5">
                {[
                  { id: 'mixed', label: 'Mixed Challenge', desc: 'Random topics' },
                  { id: 'topic', label: 'Topic Challenge', desc: 'Selected topics' },
                ].map(m => {
                  const active = (roomState?.config?.mode || mode) === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      disabled={!isHost}
                      onClick={() => handleUpdateConfig({ mode: m.id })}
                      className={`p-2 rounded-xl border text-xs text-left transition-all ${
                        active
                          ? 'bg-[#244A73] border-[#244A73] text-white shadow-sm'
                          : 'bg-[#FFFDF8] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                      } ${!isHost ? 'cursor-default opacity-85' : 'cursor-pointer active:scale-95'}`}
                    >
                      <div className="font-black text-[11px]">{m.label}</div>
                      <div className={`text-[9px] ${active ? 'text-white/70' : 'text-[#66635D]'}`}>{m.desc}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Categories if Topic Challenge */}
            {((roomState?.config?.mode || mode) === 'topic') && (
              <div className="space-y-2 pt-1 border-t border-[#E2DACB]">
                <span className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider block">
                  Select Topics {isHost ? '(Click to Toggle)' : ''}
                </span>
                <div className="flex flex-wrap gap-1">
                  {ALL_CAT_IDS.map(catId => {
                    const currentCats = roomState?.config?.categories || selectedCats;
                    const active = currentCats.includes(catId);
                    return (
                      <button
                        key={catId}
                        type="button"
                        disabled={!isHost}
                        onClick={() => {
                          if (!isHost) return;
                          const next = active
                            ? currentCats.length > 1 ? currentCats.filter(c => c !== catId) : currentCats
                            : [...currentCats, catId];
                          handleUpdateConfig({ categories: next, mode: 'topic' });
                        }}
                        className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all ${
                          active
                            ? 'bg-[#244A73] border-[#244A73] text-white'
                            : 'bg-[#FFFDF8] border-[#E2DACB] text-[#66635D]'
                        } ${!isHost ? 'cursor-default opacity-80' : 'cursor-pointer active:scale-95'}`}
                      >
                        {catId.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Players */}
          <div className="bg-[#F7F3EA] p-4 rounded-xl border border-[#E2DACB] space-y-2">
            <h3 className="text-xs font-bold text-[#252525] uppercase tracking-wider mb-3">
              Players ({roomState?.players?.length || 0}/2)
            </h3>
            {(roomState?.players || []).map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#FFFDF8] border border-[#E2DACB] text-xs font-bold text-[#252525]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse"></span>
                  <span>{p.name} {String(p.userId) === String(roomState?.hostId) && '⭐ Host'}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D1FAE5] border border-[#10B981] text-[#065F46] font-bold">READY</span>
              </div>
            ))}
            {(roomState?.players?.length || 0) < 2 && (
              <p className="text-xs text-[#66635D] text-center animate-pulse pt-1">Waiting for opponent…</p>
            )}
          </div>

          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex items-center gap-2 justify-center">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}

          {isHost ? (
            <button
              onClick={handleStartBattle}
              disabled={(roomState?.players?.length || 0) < 1}
              className="w-full py-4 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            >
              <Play className="w-4 h-4 fill-white" /> START BATTLE
            </button>
          ) : (
            <p className="text-xs text-[#244A73] font-semibold animate-pulse py-4">
              Waiting for host to start…
            </p>
          )}

          <button
            onClick={handleLeaveRoom}
            className="w-full py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#66635D] font-bold text-xs hover:bg-[#EFE9DC] transition-all"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: BATTLE
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'BATTLE') {
    const isTimeLow = timeLeft > 0 && timeLeft <= 15;
    const opponent = roomState?.players?.find(p => String(p.userId) !== String(myId));
    const me = roomState?.players?.find(p => String(p.userId) === String(myId));

    return (
      <div className="max-w-lg mx-auto px-3 py-4 space-y-3">

        {/* Timer + scores header */}
        <div className={`flex items-center justify-between px-4 py-3 rounded-2xl border shadow-sm transition-all ${
          isTimeLow
            ? 'bg-red-50 border-red-300 animate-pulse'
            : 'bg-[#FFFDF8] border-[#E2DACB]'
        }`}>
          {/* My score */}
          <div className="text-center min-w-[70px]">
            <div className="text-[10px] font-bold text-[#66635D] uppercase truncate max-w-[70px]">{me?.name || 'You'}</div>
            <div className="text-2xl font-black text-[#244A73]">{myScore.correct}</div>
            <div className="text-[10px] text-red-500 font-bold">{myScore.wrong > 0 && `✗${myScore.wrong}`}</div>
          </div>

          {/* Timer center */}
          <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl font-mono font-black text-lg ${
            isTimeLow ? 'text-red-600' : 'text-[#252525]'
          }`}>
            <Clock className="w-4 h-4" />
            {fmtTime(timeLeft)}
          </div>

          {/* Opponent score */}
          <div className="text-center min-w-[70px]">
            <div className="text-[10px] font-bold text-[#66635D] uppercase truncate max-w-[70px]">{opponent?.name || 'Opponent'}</div>
            <div className="text-2xl font-black text-[#2D6A4F]">{opponentScore.correct}</div>
            <div className="text-[10px] text-red-500 font-bold">{opponentScore.wrong > 0 && `✗${opponentScore.wrong}`}</div>
          </div>
        </div>

        {/* Question card */}
        <div className={`bg-[#FFFDF8] rounded-2xl border-2 shadow-sm p-6 text-center transition-all duration-150 ${
          flashCorrect ? 'border-[#2D6A4F] bg-green-50' :
          flashWrong  ? 'border-red-400 bg-red-50' :
          feedback === 'wrong' ? 'border-red-300' :
                                 'border-[#E2DACB]'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] font-bold text-[#66635D] uppercase tracking-wider">
              {currentQ?.category?.replace(/_/g, ' ')} · {currentQ?.difficulty}
            </span>
            <span className="text-[10px] font-bold text-[#244A73]">Q #{currentQIndex + 1}</span>
          </div>

          <p className="text-2xl sm:text-3xl font-black text-[#252525] leading-relaxed min-h-[3rem] flex items-center justify-center">
            {currentQ?.text || 'Loading…'}
          </p>

          {feedback === 'wrong' && (
            <div className="mt-3 text-xs text-red-600 font-bold flex items-center justify-center gap-1">
              <AlertCircle className="w-4 h-4" /> Wrong answer — try again!
            </div>
          )}

          {/* Answer display */}
          <div className={`mt-4 h-14 flex items-center justify-center rounded-xl border-2 font-mono font-black text-3xl transition-all ${
            inputValue
              ? 'bg-[#F7F3EA] border-[#244A73] text-[#244A73]'
              : 'bg-[#F7F3EA] border-[#E2DACB] text-[#D5CDBF]'
          }`}>
            {inputValue || '—'}
          </div>
        </div>

        {/* Keypad */}
        <NumericKeypad
          value={inputValue}
          onChange={setInputValue}
          onSubmit={handleSubmitAnswer}
          disabled={submitting || timeLeft === 0}
        />

        {/* Stats bar */}
        <div className="flex items-center justify-between text-[10px] font-bold text-[#66635D] px-1">
          <span>✓ {myScore.correct} correct</span>
          {lastLatency && <span>⚡ {lastLatency}ms</span>}
          <span>✗ {myScore.wrong} wrong</span>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW: RESULT
  // ═══════════════════════════════════════════════════════════════════════════
  if (view === 'RESULT' && resultPayload) {
    const { leaderboard, config, startTime, endTime } = resultPayload;
    const myEntry = leaderboard.find(e => String(e.userId) === String(myId));
    const winner  = leaderboard[0];
    const isTie   = leaderboard.length >= 2 && leaderboard[0].result === 'DRAW';
    const duration = endTime && startTime ? Math.round((endTime - startTime) / 1000) : config?.durationSeconds || 0;

    return (
      <div className="max-w-xl mx-auto px-4 py-6 space-y-4">

        {/* Winner banner */}
        <div className="bg-[#244A73] p-6 rounded-2xl text-center space-y-1 shadow-sm">
          <div className="text-4xl">{isTie ? '🤝' : myEntry?.result === 'WIN' ? '🏆' : '💪'}</div>
          <h2 className="text-2xl font-black text-white">
            {isTie ? "IT'S A DRAW!" : myEntry?.result === 'WIN' ? 'YOU WIN!' : `${winner.name} WINS!`}
          </h2>
          <p className="text-white/70 text-xs">
            {isTie ? 'Both players scored equally!' : `${winner.name} · ${winner.correct} correct answers`}
          </p>
        </div>

        {/* Score comparison table */}
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E2DACB] overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#E2DACB] bg-[#F7F3EA]">
            <h3 className="text-xs font-black text-[#252525] uppercase tracking-wider">Battle Results</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2DACB]">
                  <th className="text-left px-4 py-3 font-bold text-[#66635D] w-32">Metric</th>
                  {leaderboard.map(e => (
                    <th key={e.userId} className={`px-4 py-3 font-black text-center ${String(e.userId) === String(myId) ? 'text-[#244A73]' : 'text-[#252525]'}`}>
                      {e.rank === 1 ? '🥇' : '🥈'} {e.name}
                      {String(e.userId) === String(myId) && <span className="text-[10px] font-normal text-[#66635D] block">(You)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DACB]">
                {[
                  ['Correct', e => e.correct],
                  ['Wrong',   e => e.wrong],
                  ['Attempted', e => e.attempted],
                  ['Accuracy', e => `${e.accuracy}%`],
                  ['Result', e => e.result],
                ].map(([label, fn]) => (
                  <tr key={label} className="hover:bg-[#F7F3EA] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[#66635D]">{label}</td>
                    {leaderboard.map(e => (
                      <td key={e.userId} className={`px-4 py-2.5 text-center font-bold ${
                        label === 'Result'
                          ? e.result === 'WIN' ? 'text-[#2D6A4F]' : e.result === 'DRAW' ? 'text-[#D97706]' : 'text-red-600'
                          : String(e.userId) === String(myId) ? 'text-[#244A73]' : 'text-[#252525]'
                      }`}>
                        {fn(e)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Duration info */}
        <div className="flex items-center justify-center gap-4 text-xs text-[#66635D] font-semibold">
          <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5" /> {duration}s battle</span>
          <span className="flex items-center gap-1"><Target className="w-3.5 h-3.5" /> {config?.difficulty} difficulty</span>
        </div>

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRematch}
            className="py-3.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-sm active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" /> PLAY AGAIN / REMATCH
          </button>
          <button
            onClick={handleLeaveRoom}
            className="py-3.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#252525] hover:bg-[#EFE9DC] font-bold text-xs uppercase transition-all cursor-pointer"
          >
            Leave Room
          </button>
        </div>
      </div>
    );
  }

  // Fallback loading
  return (
    <div className="flex items-center justify-center min-h-[200px]">
      <Loader2 className="w-8 h-8 text-[#244A73] animate-spin" />
    </div>
  );
};
