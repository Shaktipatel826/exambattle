import React, { useState, useEffect, useCallback } from 'react';
import { io } from 'socket.io-client';
import {
  Swords, Users, Clock, Trophy, Play, RotateCcw, AlertCircle, CheckCircle2,
  ArrowRight, ArrowLeft, ChevronRight, Share2, Copy, Loader2
} from 'lucide-react';
import { getSocketUrl } from '../lib/apiConfig';

// ─── Exact subject names that match MongoDB ──────────────────────────────────
const SUBJECTS = [
  'Indian Polity',
  'History',
  'Geography',
  'General Science',
  'Indian Economy',
  'Computer Awareness',
  'Mathematics',
  'Reasoning',
  'Static GK',
  'Uttar Pradesh GK',
  'General Studies',
];

export const MultiplayerBattlePage = ({ token, user, initialRoomCode, savedTestMeta, onRoomCodeConsumed }) => {
  const [socket, setSocket] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState(initialRoomCode || '');
  const [roomState, setRoomState] = useState(null);
  const [config, setConfig] = useState({
    subject: 'Indian Polity',
    topic: 'All',
    questionCount: 10,
    timeLimitMinutes: 5,
    negativeMarking: 0.25,
    difficulty: 'All',
  });

  // In-battle state
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});  // { questionIndex: optionIndex | string }
  const [typedAnswers, setTypedAnswers] = useState({});           // { questionIndex: string } for short_answer
  const [submittedShortAnswers, setSubmittedShortAnswers] = useState({});  // { questionIndex: true }
  const [leaderboard, setLeaderboard] = useState(null);
  const [reviewQuestions, setReviewQuestions] = useState([]);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);
  const [copied, setCopied] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [startBattleError, setStartBattleError] = useState('');
  const [startingBattle, setStartingBattle] = useState(false);

  // ── Socket Setup ────────────────────────────────────────────────────────────
  useEffect(() => {
    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl, { transports: ['websocket', 'polling'] });
    setSocket(newSocket);

    newSocket.on('connect_error', (err) => {
      console.error('[Socket] Connect error:', err.message);
    });

    newSocket.on('room_updated', (updatedRoom) => {
      setRoomState(updatedRoom);
    });

    newSocket.on('battle_started', ({ startTime, endTime, questions }) => {
      setRoomState(prev =>
        prev ? { ...prev, status: 'IN_PROGRESS', questions, startTime, endTime } : prev
      );
      setCurrentQIndex(0);
      setSelectedAnswers({});
      const remainingSecs = Math.floor((endTime - Date.now()) / 1000);
      setTimeLeft(Math.max(0, remainingSecs));
    });

    newSocket.on('reconnect', () => {
      console.log('[Battle] Socket reconnected — re-joining room');
      setRoomState(prev => {
        if (prev?.roomCode && prev.status === 'LOBBY') {
          newSocket.emit('join_room', { roomCode: prev.roomCode, user }, (response) => {
            if (response?.success) setRoomState(response.room);
          });
        }
        return prev;
      });
    });

    newSocket.on('battle_finished', ({ leaderboard, questions }) => {
      // Clear safety-net timeout if present
      if (newSocket._finishTimeoutId) {
        clearTimeout(newSocket._finishTimeoutId);
        newSocket._finishTimeoutId = null;
      }
      setSubmitting(false);
      setLeaderboard(leaderboard);
      if (questions) setReviewQuestions(questions);
      setRoomState(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
    });

    return () => newSocket.disconnect();
  }, []);

  // ── Auto-join when navigated from Create Test / Saved Tests ─────────────────
  useEffect(() => {
    if (!socket || !initialRoomCode || !user) return;
    // Wait for socket to connect then auto-join
    const doJoin = () => {
      socket.emit('join_room', { roomCode: initialRoomCode.toUpperCase().trim(), user }, (response) => {
        if (response?.success) {
          setRoomState(response.room);
          setRoomCodeInput(initialRoomCode.toUpperCase().trim());
        } else {
          setError(response?.message || 'Auto-join failed — room may not exist yet.');
        }
        if (onRoomCodeConsumed) onRoomCodeConsumed();
      });
    };
    if (socket.connected) {
      doJoin();
    } else {
      socket.once('connect', doJoin);
      return () => socket.off('connect', doJoin);
    }
  }, [socket, initialRoomCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Auto-create room from Saved Test (navigated from SavedTestsPage) ─────────
  // Uses THIS page's own persistent socket — no temp socket, no dead socketId bug.
  useEffect(() => {
    if (!socket || !savedTestMeta || !user) return;
    if (roomState) return; // already in a room

    const doCreate = () => {
      console.log('[Battle] Creating room from saved test via persistent socket:', savedTestMeta);
      setError('');
      socket.emit('create_room_from_saved_test', {
        user: { id: user?.id || user?._id, name: user?.name },
        savedTestId: savedTestMeta.savedTestId,
        config: savedTestMeta.config,
      }, (response) => {
        console.log('[Battle] create_room_from_saved_test ack:', response);
        if (response?.success) {
          setRoomState(response.room);
          setRoomCodeInput(response.roomCode);
        } else {
          setError(response?.message || 'Failed to create battle room from saved test. Please try again.');
        }
        if (onRoomCodeConsumed) onRoomCodeConsumed();
      });
    };

    if (socket.connected) {
      doCreate();
    } else {
      socket.once('connect', doCreate);
      return () => socket.off('connect', doCreate);
    }
  }, [socket, savedTestMeta]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Server-Authoritative Countdown ─────────────────────────────────────────
  useEffect(() => {
    if (roomState?.status !== 'IN_PROGRESS' || !roomState.endTime) return;

    const interval = setInterval(() => {
      const remaining = Math.floor((roomState.endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setTimeLeft(0);
        clearInterval(interval);
        // Auto-submit when time expires
        if (!submitting) handleFinishBattle();
      } else {
        setTimeLeft(remaining);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [roomState?.status, roomState?.endTime]);

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // ── Room Actions ────────────────────────────────────────────────────────────
  const handleCreateRoom = () => {
    if (!socket || !user) return;
    setError('');
    socket.emit('create_room', { user, config }, (response) => {
      if (response.success) {
        setRoomState(response.room);
      } else {
        setError(response.message || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !user || !roomCodeInput.trim()) return;
    setError('');
    socket.emit('join_room', { roomCode: roomCodeInput.toUpperCase().trim(), user }, (response) => {
      if (response.success) {
        setRoomState(response.room);
      } else {
        setError(response.message || 'Room not found or full');
      }
    });
  };

  const handleStartBattle = () => {
    if (!socket || !roomState || startingBattle) return;
    setStartBattleError('');
    setStartingBattle(true);
    console.log('[Battle] Emitting start_battle:', { roomCode: roomState.roomCode, userId: user.id || user._id });

    // Timeout if server doesn't ack within 8s (e.g. server restarted, room lost)
    const timeoutId = setTimeout(() => {
      setStartingBattle(false);
      setStartBattleError('Battle server did not respond. The room may have expired — please create a new room.');
    }, 8000);

    socket.emit(
      'start_battle',
      { roomCode: roomState.roomCode, userId: user.id || user._id },
      (response) => {
        clearTimeout(timeoutId);
        setStartingBattle(false);
        console.log('[Battle] start_battle ack:', response);
        if (response && !response.success) {
          setStartBattleError(response.message || 'Failed to start battle. Please try again.');
        }
      }
    );
  };

  const handleCopyCode = () => {
    navigator.clipboard?.writeText(roomState?.roomCode || '');
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ── Answer Selection & Navigation ──────────────────────────────────────────
  const handleSelectAnswer = (optionIndex) => {
    // Allow changing answer before moving to next question
    setSelectedAnswers(prev => ({ ...prev, [currentQIndex]: optionIndex }));

    // Immediately emit to server (server records and allows re-submission with override)
    if (socket && roomState) {
      socket.emit('submit_answer', {
        roomCode: roomState.roomCode,
        userId: user.id || user._id,
        questionIndex: currentQIndex,
        selectedOptionIndex: optionIndex,
      });
    }
  };

  // ── Short-Answer Submission ──────────────────────────────────────────────────
  const handleSubmitTypedAnswer = (qIndex) => {
    const text = (typedAnswers[qIndex] || '').trim();
    if (!text) return;
    setSelectedAnswers(prev => ({ ...prev, [qIndex]: text }));
    setSubmittedShortAnswers(prev => ({ ...prev, [qIndex]: true }));
    if (socket && roomState) {
      socket.emit('submit_answer', {
        roomCode: roomState.roomCode,
        userId: user.id || user._id,
        questionIndex: qIndex,
        selectedOptionIndex: text,
      });
    }
  };

  const handleNext = () => {
    const questions = roomState?.questions || [];
    if (currentQIndex < questions.length - 1) {
      setCurrentQIndex(prev => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentQIndex > 0) {
      setCurrentQIndex(prev => prev - 1);
    }
  };

  // ── Final Battle Submission ─────────────────────────────────────────────────
  const handleFinishBattle = useCallback(() => {
    if (!socket || !roomState || submitting) return;
    setSubmitting(true);

    // Emit any unanswered questions as -1 (skip); short_answer uses empty string
    const questions = roomState.questions || [];
    questions.forEach((q, idx) => {
      if (selectedAnswers[idx] === undefined) {
        socket.emit('submit_answer', {
          roomCode: roomState.roomCode,
          userId: user.id || user._id,
          questionIndex: idx,
          selectedOptionIndex: q.questionType === 'short_answer' ? '' : -1,
        });
      }
    });

    // Tell server this player is done
    socket.emit('player_finished', {
      roomCode: roomState.roomCode,
      userId: user.id || user._id,
    });

    // Safety net: if battle_finished not received within 30s, show error
    const timeoutId = setTimeout(() => {
      setSubmitting(false);
      setError('Results are taking too long to arrive. Please wait or refresh if results still do not appear.');
    }, 30000);

    // Store timeout id so we can clear it when battle_finished arrives
    socket._finishTimeoutId = timeoutId;
  }, [socket, roomState, selectedAnswers, submitting, user]);

  const handleRematch = () => {
    setSelectedAnswers({});
    setTypedAnswers({});
    setSubmittedShortAnswers({});
    setCurrentQIndex(0);
    setLeaderboard(null);
    setReviewQuestions([]);
    setSubmitting(false);
    setStartBattleError('');
    setStartingBattle(false);
    if (socket && roomState) {
      socket.emit('request_rematch', { roomCode: roomState.roomCode, userId: user.id || user._id });
    }
  };

  const handleLeaveRoom = () => {
    if (socket && roomState) {
      socket.emit('leave_room', { roomCode: roomState.roomCode, userId: user.id || user._id });
    }
    setRoomState(null);
    setSelectedAnswers({});
    setTypedAnswers({});
    setSubmittedShortAnswers({});
    setCurrentQIndex(0);
    setLeaderboard(null);
    setSubmitting(false);
    setStartBattleError('');
    setStartingBattle(false);
    setError('');
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 1: Room Setup (Create / Join)
  // ═══════════════════════════════════════════════════════════════════════════
  if (!roomState) {
    // If navigated from SavedTestsPage, show a "Setting up room…" card while socket creates it
    if (savedTestMeta && !error) {
      return (
        <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">
          <div className="bg-[#FFFDF8] p-10 rounded-2xl border border-[#E2DACB] shadow-sm text-center space-y-4">
            <Loader2 className="w-10 h-10 text-[#244A73] animate-spin mx-auto" />
            <h2 className="text-lg font-black text-[#252525]">Setting up your Battle Room…</h2>
            <p className="text-sm text-[#66635D]">
              Randomly selecting <strong>{savedTestMeta.questionCount}</strong> questions from <em>{savedTestMeta.testTitle}</em>
            </p>
            <p className="text-xs text-[#66635D]">Connecting to battle server. This will only take a moment.</p>
          </div>
        </div>
      );
    }

    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-6">

        {/* Header */}
        <div className="bg-[#244A73] p-6 rounded-2xl text-center space-y-2 shadow-sm">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/10 flex items-center justify-center mb-2">
            <Swords className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black text-white">REALTIME BATTLE ARENA</h1>
          <p className="text-xs text-white/70 max-w-lg mx-auto">
            Compete live with friends. Synchronized timer, server-validated scoring.
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-red-50 border border-red-300 text-red-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Create Room */}
          <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <Swords className="w-4 h-4 text-[#244A73]" /> Create Battle Room
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-[#66635D] mb-1 font-semibold">Subject</label>
                <select
                  value={config.subject}
                  onChange={e => setConfig({ ...config, subject: e.target.value })}
                  className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]"
                >
                  {SUBJECTS.map(s => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#66635D] mb-1 font-semibold">Questions</label>
                  <select
                    value={config.questionCount}
                    onChange={e => setConfig({ ...config, questionCount: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]"
                  >
                    {[5, 10, 15, 20].map(n => (
                      <option key={n} value={n}>{n} Questions</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#66635D] mb-1 font-semibold">Time Limit</label>
                  <select
                    value={config.timeLimitMinutes}
                    onChange={e => setConfig({ ...config, timeLimitMinutes: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]"
                  >
                    {[3, 5, 10, 15].map(m => (
                      <option key={m} value={m}>{m} Minutes</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#66635D] mb-1 font-semibold">Difficulty</label>
                  <select
                    value={config.difficulty}
                    onChange={e => setConfig({ ...config, difficulty: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]"
                  >
                    {['All', 'Easy', 'Medium', 'Hard'].map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[#66635D] mb-1 font-semibold">Negative Marks</label>
                  <select
                    value={config.negativeMarking}
                    onChange={e => setConfig({ ...config, negativeMarking: Number(e.target.value) })}
                    className="w-full px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] font-semibold focus:outline-none focus:border-[#244A73]"
                  >
                    <option value={0}>None</option>
                    <option value={0.25}>-0.25 (SSC)</option>
                    <option value={0.33}>-0.33</option>
                    <option value={0.5}>-0.50</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-black text-xs tracking-wider uppercase shadow-sm transition-all"
              >
                CREATE ROOM & GET CODE
              </button>
            </div>
          </div>

          {/* Join Room */}
          <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-[#2D6A4F]" /> Join Existing Room
              </h2>
              <p className="text-xs text-[#66635D] mb-4">
                Enter the 6-character code shared by your friend (e.g., K7P4XZ).
              </p>
              <label className="block text-xs font-semibold text-[#252525] mb-1">Room Code</label>
              <input
                type="text"
                maxLength={6}
                placeholder="K7P4XZ"
                value={roomCodeInput}
                onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                className="w-full px-4 py-3 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-center text-2xl font-mono font-black uppercase tracking-widest text-[#244A73] focus:outline-none focus:border-[#244A73]"
              />
            </div>
            <button
              onClick={handleJoinRoom}
              disabled={!roomCodeInput.trim()}
              className="w-full py-3 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs tracking-wider uppercase shadow-sm disabled:opacity-50 transition-all"
            >
              JOIN BATTLE ROOM
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 2: Lobby
  // ═══════════════════════════════════════════════════════════════════════════
  if (roomState.status === 'LOBBY') {
    const isHost = roomState.hostId === (user.id || user._id);
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-[#FFFDF8] p-8 rounded-3xl border border-[#E2DACB] shadow-sm text-center space-y-6">

          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] uppercase tracking-widest">
            Battle Lobby
          </span>

          {/* Room Code */}
          <div>
            <span className="text-xs text-[#66635D] font-semibold uppercase tracking-wider block mb-2">
              Share this Room Code with your friends
            </span>
            <div className="flex items-center justify-center gap-3">
              <span className="text-4xl font-mono font-black text-[#244A73] tracking-widest bg-[#F7F3EA] px-6 py-3 rounded-2xl border border-[#E2DACB] select-all">
                {roomState.roomCode}
              </span>
              <button
                onClick={handleCopyCode}
                className="p-3 rounded-xl bg-[#EFE9DC] border border-[#D5CDBF] text-[#244A73] hover:bg-[#E2DACB] transition-all"
                title="Copy code"
              >
                {copied ? <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" /> : <Copy className="w-5 h-5" />}
              </button>
            </div>
          </div>

          {/* Config summary */}
          <div className="flex flex-wrap justify-center gap-2 text-[10px] font-bold">
            <span className="px-2.5 py-1 rounded-full bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF]">{roomState.config.subject}</span>
            <span className="px-2.5 py-1 rounded-full bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF]">{roomState.config.questionCount} Questions</span>
            <span className="px-2.5 py-1 rounded-full bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF]">{roomState.config.timeLimitMinutes} Min Timer</span>
          </div>

          {/* Players */}
          <div className="bg-[#F7F3EA] p-4 rounded-xl border border-[#E2DACB] space-y-2">
            <h3 className="text-xs font-bold text-[#252525] uppercase tracking-wider mb-3">
              Players ({roomState.players.length}/3)
            </h3>
            {roomState.players.map((p, idx) => (
              <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#FFFDF8] border border-[#E2DACB] text-xs font-bold text-[#252525]">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse"></span>
                  <span>{p.name} {p.userId === roomState.hostId && '⭐ Host'}</span>
                </div>
                <span className="text-[10px] px-2 py-0.5 rounded bg-[#D1FAE5] border border-[#10B981] text-[#065F46] font-bold">READY</span>
              </div>
            ))}
          </div>

          <div className="space-y-2">
            {startBattleError && (
              <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {startBattleError}
              </div>
            )}
            {isHost ? (
              <button
                onClick={handleStartBattle}
                disabled={roomState.players.length < 1 || startingBattle}
                className="w-full py-4 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2 disabled:opacity-60"
              >
                {startingBattle ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Starting…</>
                ) : (
                  <><Play className="w-4 h-4 fill-white" /> START BATTLE NOW</>
                )}
              </button>
            ) : (
              <p className="text-xs text-[#244A73] font-semibold animate-pulse py-4">
                Waiting for host to start the battle...
              </p>
            )}
            <button
              onClick={handleLeaveRoom}
              className="w-full py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#66635D] font-bold text-xs hover:bg-[#EFE9DC]"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 3: Results / Leaderboard — Full Comparative Dashboard
  // ═══════════════════════════════════════════════════════════════════════════
  if (roomState.status === 'FINISHED' && leaderboard) {
    const myId = user.id || user._id;
    const myEntry = leaderboard.find(p => p.userId === myId);
    const winner = leaderboard[0]; // sorted by score desc server-side
    const isTie = leaderboard.length > 1 && leaderboard[0].score === leaderboard[1].score;
    const totalQs = reviewQuestions.length;

    // Helper: get a player's answer for question idx
    const getPlayerAnswer = (entry, idx) => {
      if (!entry) return undefined;
      const ans = entry.submittedAnswers?.[idx];
      return ans;
    };

    // Helper: answer status for a question
    const getStatus = (entry, question, idx) => {
      const ans = getPlayerAnswer(entry, idx);
      const isShort = question.questionType === 'short_answer';
      if (ans === undefined || ans === null || ans === '' || ans === -1) return 'SKIPPED';
      if (isShort) {
        const pct = entry.answerScores?.[idx] ?? 0;
        if (pct === 100) return 'CORRECT';
        if (pct > 0) return 'PARTIAL';
        return 'WRONG';
      }
      return ans === question.correctAnswer ? 'CORRECT' : 'WRONG';
    };

    const statusStyle = {
      CORRECT:  'bg-green-100 text-green-800 border-green-200',
      PARTIAL:  'bg-amber-100 text-amber-800 border-amber-200',
      WRONG:    'bg-red-100 text-red-800 border-red-200',
      SKIPPED:  'bg-[#F7F3EA] text-[#66635D] border-[#E2DACB]',
    };
    const statusLabel = {
      CORRECT: '✓ Correct',
      PARTIAL: '◑ Partial',
      WRONG:   '✗ Wrong',
      SKIPPED: '— Skipped',
    };

    const medals = ['🥇', '🥈', '🥉'];

    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Winner Banner ── */}
        <div className="bg-[#244A73] p-6 rounded-2xl text-center space-y-1 shadow-sm">
          <div className="text-3xl">{isTie ? '🤝' : '🏆'}</div>
          <h2 className="text-2xl font-black text-white">
            {isTie ? 'IT\'S A TIE!' : `${winner.name} WINS!`}
          </h2>
          <p className="text-white/70 text-xs">
            {isTie ? `Both players scored ${winner.score} pts` : `${winner.score} pts — by score (incl. partial marks)`}
          </p>
        </div>

        {/* ── Overall Comparison Table ── */}
        <div className="bg-[#FFFDF8] rounded-2xl border border-[#E2DACB] overflow-hidden shadow-sm">
          <div className="px-5 py-3 border-b border-[#E2DACB] bg-[#F7F3EA]">
            <h3 className="text-xs font-black text-[#252525] uppercase tracking-wider">Battle Comparison</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[#E2DACB]">
                  <th className="text-left px-4 py-3 font-bold text-[#66635D] w-36">Performance</th>
                  {leaderboard.map(p => (
                    <th key={p.userId} className={`px-4 py-3 font-black text-center ${p.userId === myId ? 'text-[#244A73]' : 'text-[#252525]'}`}>
                      {medals[p.rank - 1] || `#${p.rank}`} {p.name}
                      {p.userId === myId && <span className="text-[10px] font-normal text-[#66635D] block">(You)</span>}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2DACB]">
                {[
                  ['Total Questions', () => totalQs],
                  ['Fully Correct', p => p.correctCount],
                  ['Partially Correct', p => p.partialCount || 0],
                  ['Wrong', p => p.wrongCount],
                  ['Skipped', p => p.unattemptedCount],
                  ['Total Score (pts)', p => p.score],
                  ['Score %', p => `${p.accuracy}%`],
                ].map(([label, getValue]) => (
                  <tr key={label} className="hover:bg-[#F7F3EA] transition-colors">
                    <td className="px-4 py-2.5 font-semibold text-[#66635D]">{label}</td>
                    {leaderboard.map(p => (
                      <td key={p.userId} className={`px-4 py-2.5 text-center font-bold ${p.userId === myId ? 'text-[#244A73]' : 'text-[#252525]'}`}>
                        {typeof getValue === 'function' && getValue.length === 0 ? getValue() : getValue(p)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── Leaderboard Cards ── */}
        <div className="space-y-2">
          {leaderboard.map(item => {
            const isMe = item.userId === myId;
            return (
              <div
                key={item.userId}
                className={`flex items-center justify-between p-4 rounded-xl border text-xs font-bold ${
                  isMe ? 'bg-[#EFE9DC] border-[#244A73] text-[#244A73]' : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="text-base">{medals[item.rank - 1] || `#${item.rank}`}</span>
                  <div>
                    <span className="block">{item.name} {isMe && '(You)'}</span>
                    <span className="text-[10px] font-normal text-[#66635D]">
                      {item.correctCount}✓ {item.partialCount > 0 ? `${item.partialCount}◑ ` : ''}{item.wrongCount}✗ {item.unattemptedCount}—
                    </span>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-sm font-black text-[#244A73] block">{item.score} pts</span>
                  <span className="text-[10px] text-[#66635D] font-normal">{item.accuracy}% accuracy</span>
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Buttons ── */}
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleRematch}
            className="py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> Rematch
          </button>
          <button
            onClick={handleLeaveRoom}
            className="py-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#252525] font-bold text-xs uppercase"
          >
            Exit
          </button>
        </div>

        {/* ── Question-wise Comparative Review ── */}
        {reviewQuestions.length > 0 && (
          <div className="space-y-3">
            <h3 className="text-sm font-black text-[#252525] uppercase tracking-wide">Question-wise Comparison</h3>

            {reviewQuestions.map((q, idx) => {
              const isShort = q.questionType === 'short_answer';

              return (
                <div key={idx} className="bg-[#FFFDF8] rounded-2xl border border-[#E2DACB] overflow-hidden shadow-sm">
                  {/* Question header */}
                  <div className="bg-[#F7F3EA] px-4 py-2.5 border-b border-[#E2DACB] flex items-center justify-between">
                    <span className="text-xs font-black text-[#244A73]">Q{idx + 1}</span>
                    <span className="text-[10px] text-[#66635D] font-semibold">{q.topic || q.subject}</span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-sm font-bold text-[#252525] leading-relaxed">{q.question}</p>

                    {/* Reference Answer */}
                    {(isShort && q.referenceAnswer) && (
                      <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                        <strong>Reference Answer:</strong> {q.referenceAnswer}
                      </div>
                    )}
                    {!isShort && q.correctAnswer !== undefined && (
                      <div className="px-3 py-2 rounded-lg bg-green-50 border border-green-200 text-xs text-green-800">
                        <strong>Correct Answer:</strong> {String.fromCharCode(65 + q.correctAnswer)}. {q.options?.[q.correctAnswer]}
                      </div>
                    )}

                    {/* Per-player answers */}
                    <div className={`grid gap-3 ${leaderboard.length > 1 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'}`}>
                      {leaderboard.map(entry => {
                        const status = getStatus(entry, q, idx);
                        const ans = getPlayerAnswer(entry, idx);
                        const pct = entry.answerScores?.[idx] ?? null;
                        const isMe = entry.userId === myId;

                        let answerDisplay = '—';
                        if (isShort) {
                          answerDisplay = (ans !== undefined && ans !== null && ans !== '' && ans !== -1)
                            ? String(ans) : 'No answer';
                        } else {
                          if (ans !== undefined && ans !== null && ans !== '' && ans !== -1) {
                            answerDisplay = `${String.fromCharCode(65 + ans)}. ${q.options?.[ans] || ''}`;
                          } else {
                            answerDisplay = 'Skipped';
                          }
                        }

                        return (
                          <div key={entry.userId} className={`p-3 rounded-xl border ${isMe ? 'border-[#244A73] bg-[#EFE9DC]' : 'border-[#E2DACB] bg-[#F7F3EA]'}`}>
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-[11px] font-black text-[#252525]">
                                {medals[entry.rank - 1] || `#${entry.rank}`} {entry.name} {isMe && '(You)'}
                              </span>
                              <span className={`text-[10px] font-bold px-2 py-0.5 rounded border ${statusStyle[status]}`}>
                                {statusLabel[status]}
                                {isShort && pct !== null && status !== 'SKIPPED' && ` · ${pct}%`}
                              </span>
                            </div>
                            <p className="text-xs text-[#252525] font-medium">{answerDisplay}</p>
                          </div>
                        );
                      })}
                    </div>

                    {/* MCQ options for context */}
                    {!isShort && q.options && (
                      <div className="grid grid-cols-1 gap-1 mt-1">
                        {q.options.map((opt, oIdx) => {
                          const isCorrectOpt = oIdx === q.correctAnswer;
                          return (
                            <div
                              key={oIdx}
                              className={`px-3 py-1.5 rounded-lg border text-[11px] ${
                                isCorrectOpt
                                  ? 'bg-green-50 border-green-200 text-green-800 font-bold'
                                  : 'bg-[#F7F3EA] border-[#E2DACB] text-[#66635D]'
                              }`}
                            >
                              <strong className="mr-1.5">{String.fromCharCode(65 + oIdx)}.</strong>{opt}
                              {isCorrectOpt && <span className="ml-2 text-[10px]">(Correct)</span>}
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {q.explanation && (
                      <p className="text-[11px] text-[#252525] bg-[#F7F3EA] p-2.5 rounded-lg border border-[#E2DACB]">
                        <strong className="text-[#244A73]">Explanation: </strong>{q.explanation}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // VIEW 4: Live Battle — IN PROGRESS
  // ═══════════════════════════════════════════════════════════════════════════
  const questions = roomState?.questions || [];
  const currentQ = questions[currentQIndex];
  const totalQ = questions.length;
  const isAnswered = selectedAnswers[currentQIndex] !== undefined && selectedAnswers[currentQIndex] !== '';
  const isLastQuestion = currentQIndex === totalQ - 1;
  const answeredCount = Object.keys(selectedAnswers).filter(k => {
    const v = selectedAnswers[k];
    return v !== undefined && v !== -1 && v !== '';
  }).length;
  const isTimeLow = timeLeft > 0 && timeLeft < 60;

  // ── "Waiting for results" overlay ─────────────────────────────────────────
  if (submitting) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-4">
        <div className="bg-[#FFFDF8] p-10 rounded-2xl border border-[#E2DACB] shadow-sm text-center space-y-4">
          <Loader2 className="w-10 h-10 text-[#244A73] animate-spin mx-auto" />
          <h2 className="text-lg font-black text-[#252525]">Exam Submitted!</h2>
          <p className="text-sm text-[#66635D]">Waiting for all players to finish…</p>
          <p className="text-xs text-[#66635D]">Results will appear automatically once everyone is done.</p>
          {error && (
            <div className="text-xs text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl flex items-center gap-2 justify-center">
              <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {error}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-4 space-y-4">

      {/* ── Header Bar ── */}
      <div className="bg-[#FFFDF8] px-4 py-3 rounded-2xl border border-[#E2DACB] shadow-sm flex items-center justify-between gap-3">
        <div>
          <span className="flex items-center gap-1.5 text-xs font-black text-[#252525]">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
            LIVE BATTLE · {roomState?.config?.subject}
          </span>
          <span className="text-[10px] text-[#66635D] font-medium block mt-0.5">
            {answeredCount} of {totalQ} answered
          </span>
        </div>

        <div className={`flex items-center gap-1.5 px-4 py-2 rounded-xl border font-mono font-black text-sm ${
          isTimeLow
            ? 'bg-red-50 text-red-600 border-red-300 animate-pulse'
            : 'bg-[#F7F3EA] text-[#244A73] border-[#E2DACB]'
        }`}>
          <Clock className="w-4 h-4" />
          <span>{formatTimer(timeLeft)}</span>
        </div>
      </div>

      {/* ── Live Players Status ── */}
      {roomState?.players && roomState.players.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {roomState.players.map((p, idx) => (
            <span
              key={idx}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#FFFDF8] border border-[#E2DACB] text-[10px] font-bold text-[#252525]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#2D6A4F]"></span>
              {p.name}
            </span>
          ))}
        </div>
      )}

      {/* ── Question Card ── */}
      {currentQ ? (
        <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-5">

          {/* Progress Header */}
          <div className="flex items-center justify-between">
            <div>
              <span className="text-xs font-black text-[#244A73]">
                Question {currentQIndex + 1} of {totalQ}
              </span>
              <div className="w-full bg-[#EFE9DC] rounded-full h-1.5 mt-1.5" style={{ width: '180px' }}>
                <div
                  className="bg-[#244A73] h-1.5 rounded-full transition-all"
                  style={{ width: `${((currentQIndex + 1) / totalQ) * 100}%` }}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-[#EFE9DC] text-[#252525] border border-[#D5CDBF] font-bold">
                {currentQ.difficulty || 'Medium'}
              </span>
              <span className="text-[10px] px-2.5 py-1 rounded-lg bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] font-bold">
                {currentQ.topic || currentQ.subject}
              </span>
            </div>
          </div>

          {/* Question Text */}
          <p className="text-sm sm:text-base font-extrabold text-[#252525] leading-relaxed">
            {currentQ.question}
          </p>

          {/* Options — MCQ or Short Answer */}
          {currentQ.questionType === 'short_answer' ? (
            <div className="space-y-3">
              <p className="text-xs text-[#66635D] font-semibold">Type your answer below:</p>
              <textarea
                value={typedAnswers[currentQIndex] || ''}
                onChange={e => setTypedAnswers(prev => ({ ...prev, [currentQIndex]: e.target.value }))}
                placeholder="Type your answer here…"
                rows={3}
                disabled={submittedShortAnswers[currentQIndex]}
                className="w-full px-3 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#D5CDBF] text-[#252525] text-sm resize-none focus:outline-none focus:border-[#244A73] disabled:opacity-60"
                dir="auto"
              />
              <button
                onClick={() => handleSubmitTypedAnswer(currentQIndex)}
                disabled={!typedAnswers[currentQIndex]?.trim() || submittedShortAnswers[currentQIndex]}
                className="w-full py-2.5 bg-[#244A73] text-white text-xs font-bold rounded-xl disabled:opacity-50 flex items-center justify-center gap-2 transition-colors hover:bg-[#1a3a5c]"
              >
                {submittedShortAnswers[currentQIndex]
                  ? <><CheckCircle2 className="w-4 h-4" /> Answer Submitted</>
                  : 'Submit Answer'}
              </button>
              {submittedShortAnswers[currentQIndex] && (
                <p className="text-[11px] text-[#66635D] text-center">
                  Answer recorded. You can move to the next question.
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(currentQ.options || []).map((opt, oIdx) => {
                const isChosen = selectedAnswers[currentQIndex] === oIdx;
                return (
                  <button
                    key={oIdx}
                    onClick={() => handleSelectAnswer(oIdx)}
                    className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                      isChosen
                        ? 'bg-[#EFE9DC] border-[#244A73] text-[#244A73] font-black shadow-sm'
                        : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73] hover:bg-[#EFE9DC]/50'
                    }`}
                  >
                    <span>
                      <strong className="mr-2 text-[#244A73]">{String.fromCharCode(65 + oIdx)}.</strong>
                      {opt}
                    </span>
                    {isChosen && <CheckCircle2 className="w-5 h-5 text-[#244A73] shrink-0" />}
                  </button>
                );
              })}
            </div>
          )}

          {/* ── Navigation Controls ── */}
          <div className="border-t border-[#E2DACB] pt-4 flex items-center justify-between gap-3">
            {/* Previous */}
            <button
              onClick={handlePrev}
              disabled={currentQIndex === 0}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[#252525] font-bold text-xs disabled:opacity-40 hover:bg-[#EFE9DC] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Previous
            </button>

            {/* Question palette dots */}
            <div className="flex gap-1 flex-wrap justify-center max-w-xs">
              {questions.map((_, idx) => {
                const ans = selectedAnswers[idx] !== undefined && selectedAnswers[idx] !== -1;
                const active = idx === currentQIndex;
                return (
                  <button
                    key={idx}
                    onClick={() => setCurrentQIndex(idx)}
                    className={`w-6 h-6 rounded-md text-[10px] font-bold border transition-all ${
                      active
                        ? 'bg-[#244A73] text-white border-[#1B3857] ring-2 ring-[#244A73] ring-offset-1'
                        : ans
                        ? 'bg-[#2D6A4F] text-white border-[#1B4332]'
                        : 'bg-[#F7F3EA] text-[#66635D] border-[#E2DACB] hover:border-[#244A73]'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            {/* Next or Submit */}
            {isLastQuestion ? (
              <button
                onClick={handleFinishBattle}
                disabled={submitting}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider shadow-sm disabled:opacity-60 transition-all"
              >
                {submitting ? 'Submitting...' : 'Submit Exam'}
                {!submitting && <CheckCircle2 className="w-3.5 h-3.5" />}
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-black text-xs uppercase tracking-wider shadow-sm transition-all"
              >
                Next <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Skip hint when unanswered */}
          {!isAnswered && (
            <p className="text-center text-[10px] text-[#66635D]">
              Select an answer or click Next to skip this question.
            </p>
          )}

        </div>
      ) : (
        <div className="bg-[#FFFDF8] p-8 rounded-2xl border border-[#E2DACB] text-center text-sm text-[#66635D]">
          Loading questions...
        </div>
      )}

    </div>
  );
};
