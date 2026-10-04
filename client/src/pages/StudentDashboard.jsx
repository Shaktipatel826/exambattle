import React, { useState, useEffect } from 'react';
import { 
  Swords, Sparkles, RefreshCw, BookOpen, Flame, Zap, Trophy, 
  Target, AlertTriangle, CheckCircle2, ArrowRight, Award, Coins, Calendar, Shield, Users, User, LogOut, Mail
} from 'lucide-react';

export const StudentDashboard = ({ onNavigate, token, user, onOpenProfile, onLogout }) => {
  const [activeTab, setActiveTab] = useState('DASHBOARD'); // DASHBOARD | LEADERBOARD | ACHIEVEMENTS
  const [dashboardData, setDashboardData] = useState(null);
  const [leaderboardData, setLeaderboardData] = useState([]);
  const [leaderboardCategory, setLeaderboardCategory] = useState('allTime');
  const [achievements, setAchievements] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboard();
    fetchLeaderboard(leaderboardCategory);
    fetchAchievements();
  }, []);

  const fetchDashboard = async () => {
    try {
      const res = await fetch('/api/student/dashboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setDashboardData(data.dashboard);
      }
    } catch (err) {
      console.error('Error loading dashboard:', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchLeaderboard = async (cat = 'allTime') => {
    try {
      const res = await fetch(`/api/student/leaderboard?category=${cat}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboardData(data.leaderboard || []);
      }
    } catch (err) {
      console.error('Error loading leaderboard:', err);
    }
  };

  const fetchAchievements = async () => {
    try {
      const res = await fetch('/api/student/achievements', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAchievements(data.achievements || []);
      }
    } catch (err) {
      console.error('Error loading achievements:', err);
    }
  };

  const uData = dashboardData?.user || {};
  const stats = dashboardData?.stats || {};
  const levelInfo = uData.levelInfo || { level: user?.level || 1, progressPercentage: 20, xpInCurrentLevel: 100, xpRequiredForNext: 500 };
  const streak = uData.streak || user?.streak || 1;
  const longestStreak = uData.longestStreak || user?.longestStreak || 1;
  const xp = uData.xp || user?.xp || 0;
  const coins = uData.coins || user?.coins || 0;
  const targetExams = user?.targetExams || ['SSC CGL', 'UP Police', 'Railway NTPC'];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-xs">
      
      {/* Top Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'DASHBOARD', label: 'Student Home', icon: BookOpen },
          { id: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
          { id: 'ACHIEVEMENTS', label: 'Badges & Rewards', icon: Award },
          { id: 'PROFILE', label: 'My Profile & Logout', icon: User, isProfile: true }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                if (tab.isProfile && onOpenProfile) {
                  onOpenProfile();
                } else {
                  setActiveTab(tab.id);
                }
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                tab.isProfile
                  ? 'bg-purple-950/80 border-purple-600/80 text-purple-200 hover:bg-purple-900 active:scale-95 shadow-sm'
                  : active
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className={`w-4 h-4 ${tab.isProfile ? 'text-red-400' : ''}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          
          {/* Top Banner: Greeting, XP, Level, Streak & Profile/Logout Launcher */}
          <div className="glass-panel rounded-3xl p-6 relative overflow-hidden bg-gradient-to-r from-slate-900 via-purple-950/30 to-slate-900 border border-purple-500/30">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              <div className="space-y-2 flex-1">
                <div className="flex items-center space-x-2 text-xs font-semibold text-purple-300 uppercase tracking-wider">
                  <span>Target Exams Aspirant</span>
                  <span>•</span>
                  <span className="text-amber-400 font-bold flex items-center gap-1">
                    <Flame className="w-4 h-4 fill-amber-400 text-amber-500 animate-pulse" />
                    {streak} Day Streak (Best: {longestStreak}d)
                  </span>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h1 className="text-2xl sm:text-3xl font-black text-white">
                    Welcome back, <span className="bg-gradient-to-r from-purple-400 to-indigo-300 bg-clip-text text-transparent">{user?.name || 'Aspirant'} 👋</span>
                  </h1>

                  {/* Prominent Banner Profile & Logout Button */}
                  {onOpenProfile && (
                    <button
                      onClick={onOpenProfile}
                      className="px-4 py-2 bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 hover:from-purple-800 hover:to-indigo-800 text-purple-200 border border-purple-500/50 rounded-xl font-extrabold flex items-center gap-2 text-xs shadow-md shadow-purple-950/50 active:scale-95 transition-all"
                    >
                      <User className="w-4 h-4 text-purple-300" />
                      <span>My Profile & Logout</span>
                      <LogOut className="w-3.5 h-3.5 text-red-400" />
                    </button>
                  )}
                </div>
                
                {/* Level & XP Progress Bar */}
                <div className="space-y-1 max-w-md pt-1">
                  <div className="flex justify-between text-[11px] font-bold text-slate-300">
                    <span className="text-purple-300">Level {levelInfo.level}</span>
                    <span className="text-amber-400 font-mono">{levelInfo.xpInCurrentLevel} / {levelInfo.xpRequiredForNext} XP</span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-950 rounded-full overflow-hidden border border-slate-800">
                    <div
                      className="h-full bg-gradient-to-r from-purple-600 to-indigo-400 transition-all duration-500"
                      style={{ width: `${levelInfo.progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Gamification Counters */}
              <div className="flex items-center space-x-3 bg-slate-950/80 p-4 rounded-2xl border border-slate-800">
                <div className="text-center px-3 border-r border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">LEVEL</span>
                  <span className="text-xl font-black text-purple-400">⭐ {levelInfo.level}</span>
                </div>
                <div className="text-center px-3 border-r border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">XP</span>
                  <span className="text-xl font-black text-amber-400 flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4 fill-amber-400 text-amber-400" />
                    {xp.toLocaleString()}
                  </span>
                </div>
                <div className="text-center px-3">
                  <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block">COINS</span>
                  <span className="text-xl font-black text-yellow-400 flex items-center justify-center gap-1">
                    <Coins className="w-4 h-4 fill-yellow-400 text-yellow-400" />
                    {coins}
                  </span>
                </div>
              </div>

            </div>
          </div>

          {/* Quick Action Module Launchers */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <button
              onClick={() => onNavigate('PRACTICE')}
              className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center hover:scale-105 transition-all bg-gradient-to-br from-emerald-500/10 via-slate-900 to-slate-900 border-emerald-500/30 group"
            >
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center mb-2 text-emerald-400 group-hover:bg-emerald-500 group-hover:text-slate-950 transition-all">
                <Target className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white">DAILY CHALLENGE</span>
              <span className="text-[10px] text-emerald-400 font-bold mt-0.5">+50 XP • +25 Coins</span>
            </button>

            <button
              onClick={() => onNavigate('REVISION')}
              className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center hover:scale-105 transition-all bg-gradient-to-br from-rose-500/10 via-slate-900 to-slate-900 border-rose-500/30 group"
            >
              <div className="w-12 h-12 rounded-xl bg-rose-500/20 flex items-center justify-center mb-2 text-rose-400 group-hover:bg-rose-500 group-hover:text-slate-950 transition-all">
                <RefreshCw className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white">REVISION DUE</span>
              <span className="text-[10px] text-rose-400 font-bold mt-0.5">{stats.mistakesRemaining || 0} Mistakes Due</span>
            </button>

            <button
              onClick={() => onNavigate('PRACTICE')}
              className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center hover:scale-105 transition-all bg-gradient-to-br from-blue-500/10 via-slate-900 to-slate-900 border-blue-500/30 group"
            >
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center mb-2 text-blue-400 group-hover:bg-blue-500 group-hover:text-slate-950 transition-all">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white">SOLO TEST ENGINE</span>
              <span className="text-[10px] text-blue-400 font-bold mt-0.5">Mock & PYQ Sets</span>
            </button>

            <button
              onClick={() => onNavigate('BATTLE')}
              className="glass-panel p-4 rounded-2xl flex flex-col items-center justify-center hover:scale-105 transition-all bg-gradient-to-br from-purple-500/10 via-slate-900 to-slate-900 border-purple-500/30 group"
            >
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center mb-2 text-purple-400 group-hover:bg-purple-500 group-hover:text-slate-950 transition-all">
                <Swords className="w-6 h-6" />
              </div>
              <span className="text-xs font-bold text-white">BATTLE FRIENDS</span>
              <span className="text-[10px] text-purple-400 font-bold mt-0.5">Realtime 1v1 / 3P</span>
            </button>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Progress Stats & Subject Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Performance Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">QUESTIONS ATTEMPTED</span>
                  <span className="text-xl font-black text-white">{stats.totalQuestions || 0}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">OVERALL ACCURACY</span>
                  <span className="text-xl font-black text-emerald-400">{stats.accuracy || 0}%</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">TESTS COMPLETED</span>
                  <span className="text-xl font-black text-purple-400">{stats.testsCompleted || 0}</span>
                </div>
                <div className="glass-panel p-4 rounded-xl border border-slate-800">
                  <span className="text-[10px] text-slate-400 font-bold block">MISTAKES MASTERED</span>
                  <span className="text-xl font-black text-amber-400">{stats.masteredCount || 0}</span>
                </div>
              </div>

              {/* Subject Performance Progress Bars */}
              <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-4">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-amber-400" /> Subject Accuracy Breakdown
                </h2>

                <div className="space-y-3">
                  {(dashboardData?.subjectProgress || [
                    { subject: 'Indian Polity', accuracy: 80 },
                    { subject: 'History', accuracy: 65 },
                    { subject: 'Geography', accuracy: 81 },
                    { subject: 'General Science', accuracy: 72 }
                  ]).map(sub => (
                    <div key={sub.subject} className="space-y-1">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-300">{sub.subject}</span>
                        <span className={`font-bold ${sub.accuracy < 50 ? 'text-red-400' : 'text-emerald-400'}`}>
                          {sub.accuracy}% Accuracy
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-950 rounded-full overflow-hidden border border-slate-900">
                        <div
                          className={`h-full transition-all duration-500 ${
                            sub.accuracy >= 75 ? 'bg-emerald-500' : sub.accuracy >= 50 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                          style={{ width: `${sub.accuracy}%` }}
                        ></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

            </div>

            {/* Right 1 Col: Today's Plan & Badges */}
            <div className="space-y-6">
              
              {/* Today's Study Plan */}
              <div className="glass-panel rounded-2xl p-5 border border-purple-500/30 space-y-3">
                <h3 className="text-xs font-bold text-purple-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-purple-400" /> TODAY'S DETERMINISTIC PLAN
                </h3>
                
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-200">1. Complete Daily Challenge</span>
                    <p className="text-[11px] text-slate-400">10 Questions • Earn +50 XP</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-200">2. Revise Spaced Notebook</span>
                    <p className="text-[11px] text-slate-400">{stats.mistakesRemaining || 0} questions due today</p>
                  </div>
                  <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                    <span className="font-bold text-slate-200">3. Practice Weak Topic: Polity</span>
                    <p className="text-[11px] text-slate-400">Targeted 10-question practice set</p>
                  </div>
                </div>
              </div>

              {/* Badges Preview */}
              <div className="glass-panel rounded-2xl p-5 border border-slate-800 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-bold text-white flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-amber-400" /> BADGES & REWARDS
                  </h3>
                  <button onClick={() => setActiveTab('ACHIEVEMENTS')} className="text-[10px] text-purple-400 font-bold">
                    View All
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {achievements.slice(0, 3).map(b => (
                    <div key={b.code} className={`p-2.5 rounded-xl border text-[10px] space-y-1 ${
                      b.unlocked ? 'bg-amber-950/40 border-amber-500/60 text-amber-200 font-bold' : 'bg-slate-950 border-slate-800 text-slate-500'
                    }`}>
                      <Award className={`w-5 h-5 mx-auto ${b.unlocked ? 'text-amber-400' : 'text-slate-600'}`} />
                      <span className="block truncate">{b.title}</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>

          </div>

        </div>
      )}

      {/* LEADERBOARD TAB */}
      {activeTab === 'LEADERBOARD' && (
        <div className="space-y-4 max-w-3xl mx-auto">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Trophy className="w-4 h-4 text-amber-400" /> Public Student Leaderboard (Privacy Protected)
            </h2>
            <div className="flex gap-2">
              {['allTime', 'weekly', 'monthly'].map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setLeaderboardCategory(cat);
                    fetchLeaderboard(cat);
                  }}
                  className={`px-3 py-1 rounded text-xs font-bold border ${
                    leaderboardCategory === cat ? 'bg-purple-600 text-white border-purple-500' : 'bg-slate-900 border-slate-800 text-slate-400'
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-panel p-4 rounded-2xl border border-slate-800 space-y-2">
            {leaderboardData.map(entry => (
              <div key={entry.userId} className="flex justify-between items-center p-3 rounded-xl bg-slate-950 border border-slate-800 text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-[11px] ${
                    entry.rank === 1 ? 'bg-amber-500 text-slate-950 font-black' :
                    entry.rank === 2 ? 'bg-slate-300 text-slate-950 font-black' :
                    entry.rank === 3 ? 'bg-amber-700 text-white font-black' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="font-bold text-slate-200">{entry.displayName}</span>
                  <span className="bg-purple-950 text-purple-300 border border-purple-800 text-[10px] font-bold px-2 py-0.5 rounded">
                    ⭐ Level {entry.level}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-amber-400 font-bold">{entry.xp} XP</span>
                  <span className="text-amber-500 font-bold">🔥 {entry.streak}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS TAB */}
      {activeTab === 'ACHIEVEMENTS' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Award className="w-4 h-4 text-amber-400" /> All Badges & Learning Achievements
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map(b => (
              <div key={b.code} className={`p-4 rounded-xl border flex items-center gap-3 ${
                b.unlocked ? 'bg-amber-950/40 border-amber-500/60 text-amber-100' : 'bg-slate-950 border-slate-800 text-slate-500'
              }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  b.unlocked ? 'bg-amber-500/20 text-amber-400 border border-amber-500/40' : 'bg-slate-900 text-slate-700'
                }`}>
                  <Award className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-slate-100">{b.title}</span>
                    {b.unlocked && <span className="bg-emerald-950 text-emerald-400 border border-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded">UNLOCKED</span>}
                  </div>
                  <p className="text-slate-400 text-xs mt-0.5">{b.description}</p>
                  <span className="text-[10px] text-amber-400 font-bold mt-1 block">Reward: +{b.rewardXp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

