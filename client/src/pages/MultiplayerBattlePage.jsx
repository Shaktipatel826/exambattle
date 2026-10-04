import React, { useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { Swords, Users, Clock, Trophy, Play, RotateCcw, AlertCircle, CheckCircle2 } from 'lucide-react';
import { getSocketUrl } from '../lib/apiConfig';

export const MultiplayerBattlePage = ({ token, user }) => {
  const [socket, setSocket] = useState(null);
  const [roomCodeInput, setRoomCodeInput] = useState('');
  const [roomState, setRoomState] = useState(null); // Active room details
  const [config, setConfig] = useState({
    subject: 'Indian Polity',
    topic: 'Fundamental Rights',
    questionCount: 5,
    timeLimitMinutes: 3,
    negativeMarking: 0.25,
    difficulty: 'Medium'
  });

  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState({});
  const [leaderboard, setLeaderboard] = useState(null);
  const [error, setError] = useState('');
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    // Initialize Socket.io connection to backend server (Dynamic domain for web/Capacitor)
    const socketUrl = getSocketUrl();
    const newSocket = io(socketUrl);
    setSocket(newSocket);

    newSocket.on('room_updated', (updatedRoom) => {
      setRoomState(updatedRoom);
    });

    newSocket.on('battle_started', ({ startTime, endTime, questions }) => {
      setRoomState(prev => prev ? { ...prev, status: 'IN_PROGRESS', questions, startTime, endTime } : prev);
      const remainingSecs = Math.floor((endTime - Date.now()) / 1000);
      setTimeLeft(Math.max(0, remainingSecs));
    });

    newSocket.on('battle_finished', ({ leaderboard, questions }) => {
      setLeaderboard(leaderboard);
      setRoomState(prev => prev ? { ...prev, status: 'FINISHED' } : prev);
    });

    return () => newSocket.disconnect();
  }, []);

  // Shared server-authoritative countdown timer
  useEffect(() => {
    if (roomState?.status === 'IN_PROGRESS' && roomState.endTime) {
      const interval = setInterval(() => {
        const remaining = Math.floor((roomState.endTime - Date.now()) / 1000);
        if (remaining <= 0) {
          setTimeLeft(0);
          clearInterval(interval);
        } else {
          setTimeLeft(remaining);
        }
      }, 1000);
      return () => clearInterval(interval);
    }
  }, [roomState?.status, roomState?.endTime]);

  const handleCreateRoom = () => {
    if (!socket || !user) return;
    socket.emit('create_room', { user, config }, (response) => {
      if (response.success) {
        setRoomState(response.room);
        setError('');
      } else {
        setError(response.message || 'Failed to create room');
      }
    });
  };

  const handleJoinRoom = () => {
    if (!socket || !user || !roomCodeInput.trim()) return;
    socket.emit('join_room', { roomCode: roomCodeInput.toUpperCase().trim(), user }, (response) => {
      if (response.success) {
        setRoomState(response.room);
        setError('');
      } else {
        setError(response.message || 'Room not found or full');
      }
    });
  };

  const handleStartBattle = () => {
    if (!socket || !roomState) return;
    socket.emit('start_battle', { roomCode: roomState.roomCode, userId: user.id || user._id });
  };

  const handleAnswerSubmit = (optionIndex) => {
    if (!socket || !roomState || selectedAnswers[currentQIndex] !== undefined) return;
    
    setSelectedAnswers({ ...selectedAnswers, [currentQIndex]: optionIndex });
    
    socket.emit('submit_answer', {
      roomCode: roomState.roomCode,
      userId: user.id || user._id,
      questionIndex: currentQIndex,
      selectedOptionIndex: optionIndex
    });
  };

  const handleRematch = () => {
    if (!socket || !roomState) return;
    setSelectedAnswers({});
    setCurrentQIndex(0);
    setLeaderboard(null);
    socket.emit('request_rematch', { roomCode: roomState.roomCode, userId: user.id || user._id });
  };

  const formatTimer = (totalSeconds) => {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  // 1. Initial Room Selection View
  if (!roomState) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-8 space-y-8">
        <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 text-center space-y-2">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/40 mb-2">
            <Swords className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-black text-white">REALTIME MULTIPLAYER BATTLE ARENA</h1>
          <p className="text-xs text-slate-400 max-w-lg mx-auto">
            Compete live with 2–3 friends online. Synchronized timer, server-authoritative scoring & instant rematch!
          </p>
        </div>

        {error && (
          <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center justify-center gap-2">
            <AlertCircle className="w-4 h-4" />
            <span>{error}</span>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
          {/* Create Room Box */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Swords className="w-4 h-4 text-amber-400" /> Create Battle Room
            </h2>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Subject</label>
                <select
                  value={config.subject}
                  onChange={e => setConfig({ ...config, subject: e.target.value })}
                  className="w-full glass-input"
                >
                  <option value="Indian Polity">Indian Polity</option>
                  <option value="History">History</option>
                  <option value="Geography">Geography</option>
                  <option value="Science">Science</option>
                  <option value="Economics">Economics</option>
                  <option value="Computer">Computer</option>
                  <option value="Mathematics">Mathematics</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Question Count</label>
                  <select
                    value={config.questionCount}
                    onChange={e => setConfig({ ...config, questionCount: Number(e.target.value) })}
                    className="w-full glass-input"
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Time Limit (Mins)</label>
                  <select
                    value={config.timeLimitMinutes}
                    onChange={e => setConfig({ ...config, timeLimitMinutes: Number(e.target.value) })}
                    className="w-full glass-input"
                  >
                    <option value={3}>3 Minutes</option>
                    <option value={5}>5 Minutes</option>
                    <option value={10}>10 Minutes</option>
                  </select>
                </div>
              </div>

              <button
                onClick={handleCreateRoom}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-black text-xs tracking-wider uppercase shadow-lg shadow-amber-500/20"
              >
                CREATE ROOM & GENERATE CODE
              </button>
            </div>
          </div>

          {/* Join Room Box */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-4 flex flex-col justify-between">
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
                <Users className="w-4 h-4 text-blue-400" /> Join Existing Room
              </h2>
              <p className="text-xs text-slate-400 mb-4">
                Enter the 6-character room code shared by your friend (e.g., K7P4XZ).
              </p>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Room Code</label>
                <input
                  type="text"
                  maxLength={6}
                  placeholder="K7P4XZ"
                  value={roomCodeInput}
                  onChange={e => setRoomCodeInput(e.target.value.toUpperCase())}
                  className="w-full glass-input text-center text-lg font-mono font-bold uppercase tracking-widest text-amber-300"
                />
              </div>
            </div>

            <button
              onClick={handleJoinRoom}
              className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-blue-600/30"
            >
              JOIN BATTLE ROOM
            </button>
          </div>

        </div>
      </div>
    );
  }

  // 2. Lobby View
  if (roomState.status === 'LOBBY') {
    const isHost = roomState.hostId === (user.id || user._id);
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="glass-panel p-8 rounded-3xl border border-amber-500/40 text-center space-y-6">
          <span className="text-[10px] font-extrabold px-3 py-1 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase tracking-widest">
            Battle Lobby
          </span>

          <div>
            <span className="text-xs text-[#66635D] font-semibold uppercase tracking-wider block">Share Room Code</span>
            <span className="text-4xl font-mono font-black text-[#244A73] tracking-widest select-all bg-[#F7F3EA] px-6 py-2 rounded-2xl border border-[#E2DACB] inline-block mt-2">
              {roomState.roomCode}
            </span>
          </div>

          <div className="p-4 rounded-xl bg-[#FFFDF8] border border-[#E2DACB] space-y-3 shadow-sm">
            <h3 className="text-xs font-bold text-[#252525] uppercase tracking-wider">
              Connected Aspirants ({roomState.players.length}/4)
            </h3>
            <div className="space-y-2">
              {roomState.players.map((p, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-[#F7F3EA] border border-[#E2DACB] text-xs font-bold text-[#252525]">
                  <div className="flex items-center space-x-2">
                    <span className="w-2 h-2 rounded-full bg-[#2D6A4F] animate-pulse"></span>
                    <span>{p.name} {p.userId === roomState.hostId && '(Host)'}</span>
                  </div>
                  <span className="text-[#2D6A4F] text-[10px] px-2 py-0.5 rounded bg-[#EFE9DC] border border-[#2D6A4F]/30 font-bold">
                    READY
                  </span>
                </div>
              ))}
            </div>
          </div>

          {isHost ? (
            <button
              onClick={handleStartBattle}
              className="w-full py-3.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
            >
              <Play className="w-4 h-4 fill-white" /> START MULTIPLAYER BATTLE NOW
            </button>
          ) : (
            <p className="text-xs text-[#244A73] font-semibold animate-pulse">
              Waiting for room host to start the battle...
            </p>
          )}
        </div>
      </div>
    );
  }

  // 3. Battle Finished Results View
  if (roomState.status === 'FINISHED' && leaderboard) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
        <div className="bg-[#FFFDF8] p-8 rounded-3xl border border-[#E2DACB] shadow-sm text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-full bg-[#EFE9DC] text-[#244A73] flex items-center justify-center border border-[#E2DACB]">
            <Trophy className="w-8 h-8 text-[#244A73]" />
          </div>
          <h2 className="text-2xl font-black text-[#252525]">BATTLE FINAL LEADERBOARD</h2>

          <div className="space-y-3">
            {leaderboard.map((item) => {
              const medal = item.rank === 1 ? '🥇' : item.rank === 2 ? '🥈' : '🥉';
              return (
                <div
                  key={item.userId}
                  className={`flex items-center justify-between p-4 rounded-xl border text-xs font-bold transition-all ${
                    item.rank === 1
                      ? 'bg-[#EFE9DC] border-[#244A73] text-[#244A73]'
                      : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{medal}</span>
                    <span>{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-[#244A73] block">{item.score} PTS</span>
                    <span className="text-[10px] text-[#66635D] font-normal">{item.accuracy}% Accuracy</span>
                  </div>
                </div>
              );
            })}
          </div>

          <button
            onClick={handleRematch}
            className="w-full py-3.5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-black text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
          >
            <RotateCcw className="w-4 h-4" /> REMATCH (SAME PLAYERS)
          </button>
        </div>
      </div>
    );
  }

  // 4. Live In-Progress Battle Test View
  const currentQ = roomState.questions?.[currentQIndex];

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-6">
      
      {/* Top Synchronized Server Status & Timer Header */}
      <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] flex justify-between items-center shadow-sm">
        <div className="flex items-center space-x-2">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse"></span>
          <span className="text-xs font-black text-[#244A73]">LIVE BATTLE ARENA</span>
        </div>

        <div className="flex items-center space-x-1.5 bg-[#F7F3EA] px-3 py-1 rounded-xl border border-[#E2DACB] text-xs font-black text-[#244A73]">
          <Clock className="w-4 h-4 text-[#244A73]" />
          <span>{formatTimer(timeLeft)}</span>
        </div>
      </div>

      {/* Live Question Box */}
      {currentQ && (
        <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-5">
          <div className="flex justify-between items-center text-xs font-bold text-[#66635D]">
            <span>Question {currentQIndex + 1} of {roomState.questions.length}</span>
            <span>Subject: {roomState.config.subject}</span>
          </div>

          <p className="text-sm sm:text-base font-extrabold text-[#252525] leading-relaxed opacity-100">
            {currentQ.question}
          </p>

          <div className="space-y-2.5">
            {currentQ.options.map((opt, oIdx) => {
              const selectedOpt = selectedAnswers[currentQIndex];
              const isSelected = selectedOpt !== undefined;
              const isChosen = selectedOpt === oIdx;

              return (
                <button
                  key={oIdx}
                  disabled={isSelected}
                  onClick={() => handleAnswerSubmit(oIdx)}
                  className={`w-full text-left p-3.5 rounded-xl border text-xs sm:text-sm font-semibold transition-all flex items-center justify-between ${
                    isChosen
                      ? 'bg-[#EFE9DC] border-[#244A73] text-[#244A73] font-black shadow-sm'
                      : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73]'
                  }`}
                >
                  <span className="text-[#252525] font-semibold"><strong className="mr-2 text-[#244A73]">{String.fromCharCode(65 + oIdx)}.</strong> {opt}</span>
                  {isChosen && <CheckCircle2 className="w-5 h-5 text-[#244A73] shrink-0" />}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-[#E2DACB] flex justify-end">
            {currentQIndex < roomState.questions.length - 1 && (
              <button
                onClick={() => setCurrentQIndex(currentQIndex + 1)}
                className="py-2.5 px-6 rounded-lg bg-[#244A73] hover:bg-[#1B3857] text-white font-bold text-xs"
              >
                Next Question
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
