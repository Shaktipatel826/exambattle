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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-xs text-[#252525]">
      
      {/* Top Navigation Sub-Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E2DACB] pb-3">
        {[
          { id: 'DASHBOARD', label: 'Student Home', icon: BookOpen },
          { id: 'LEADERBOARD', label: 'Leaderboard', icon: Trophy },
          { id: 'ACHIEVEMENTS', label: 'Badges & Rewards', icon: Award }
        ].map(tab => {
          const Icon = tab.icon;
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                active
                  ? 'bg-[#244A73] text-white border-[#1B3857] shadow-sm'
                  : 'bg-[#FFFDF8] border-[#E2DACB] text-[#66635D] hover:text-[#252525] hover:bg-[#EFE9DC]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {activeTab === 'DASHBOARD' && (
        <div className="space-y-6">
          
          {/* Top Banner: Greeting, XP, Level, Streak & Profile/Logout Launcher */}
          <div className="bg-[#FFFDF8] rounded-2xl p-6 relative border border-[#E2DACB] shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
              
              <div className="space-y-2 flex-1">
                <div className="flex items-center space-x-2 text-xs font-bold text-[#244A73] uppercase tracking-wider">
                  <span>Target Exams Aspirant</span>
                  <span>•</span>
                  <span className="text-[#D97706] font-bold flex items-center gap-1">
                    <Flame className="w-4 h-4 fill-[#D97706] text-[#D97706]" />
                    {streak} Day Streak (Best: {longestStreak}d)
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <h1 className="text-2xl sm:text-3xl font-black text-[#244A73]">
                    Welcome back, <span>{user?.name || 'Aspirant'} 👋</span>
                  </h1>
                </div>
                
                {/* Level & XP Progress Bar */}
                <div className="space-y-1 max-w-md pt-1">
                  <div className="flex justify-between text-[11px] font-bold text-[#66635D]">
                    <span className="text-[#244A73]">Level {levelInfo.level}</span>
                    <span className="text-[#D97706] font-mono">{levelInfo.xpInCurrentLevel} / {levelInfo.xpRequiredForNext} XP</span>
                  </div>
                  <div className="w-full h-2.5 bg-[#EFE9DC] rounded-full overflow-hidden border border-[#D5CDBF]">
                    <div
                      className="h-full bg-[#244A73] transition-all duration-500"
                      style={{ width: `${levelInfo.progressPercentage}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Gamification Counters */}
              <div className="flex items-center space-x-3 bg-[#F7F3EA] p-4 rounded-xl border border-[#E2DACB]">
                <div className="text-center px-3 border-r border-[#E2DACB]">
                  <span className="text-[10px] text-[#66635D] font-bold uppercase tracking-wider block">LEVEL</span>
                  <span className="text-xl font-black text-[#244A73]">⭐ {levelInfo.level}</span>
                </div>
                <div className="text-center px-3 border-r border-[#E2DACB]">
                  <span className="text-[10px] text-[#66635D] font-bold uppercase tracking-wider block">XP</span>
                  <span className="text-xl font-black text-[#D97706] flex items-center justify-center gap-1">
                    <Zap className="w-4 h-4 fill-[#D97706] text-[#D97706]" />
                    {xp.toLocaleString()}
                  </span>
                </div>
                <div className="text-center px-3">
                  <span className="text-[10px] text-[#66635D] font-bold uppercase tracking-wider block">COINS</span>
                  <span className="text-xl font-black text-[#D97706] flex items-center justify-center gap-1">
                    <Coins className="w-4 h-4 fill-[#D97706] text-[#D97706]" />
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
              className="bg-[#FFFDF8] p-4 rounded-xl flex flex-col items-center justify-center border border-[#E2DACB] hover:border-[#2D6A4F] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#E8F5E9] flex items-center justify-center mb-2 text-[#2D6A4F]">
                <Target className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-[#252525]">DAILY CHALLENGE</span>
              <span className="text-[10px] text-[#2D6A4F] font-bold mt-0.5">+50 XP • +25 Coins</span>
            </button>

            <button
              onClick={() => onNavigate('REVISION')}
              className="bg-[#FFFDF8] p-4 rounded-xl flex flex-col items-center justify-center border border-[#E2DACB] hover:border-[#9E2A2B] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FDF2F2] flex items-center justify-center mb-2 text-[#9E2A2B]">
                <RefreshCw className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-[#252525]">REVISION DUE</span>
              <span className="text-[10px] text-[#9E2A2B] font-bold mt-0.5">{stats.mistakesRemaining || 0} Mistakes Due</span>
            </button>

            <button
              onClick={() => onNavigate('PRACTICE')}
              className="bg-[#FFFDF8] p-4 rounded-xl flex flex-col items-center justify-center border border-[#E2DACB] hover:border-[#244A73] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#EFE9DC] flex items-center justify-center mb-2 text-[#244A73]">
                <BookOpen className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-[#252525]">SOLO TEST ENGINE</span>
              <span className="text-[10px] text-[#244A73] font-bold mt-0.5">Mock & PYQ Sets</span>
            </button>

            <button
              onClick={() => onNavigate('BATTLE')}
              className="bg-[#FFFDF8] p-4 rounded-xl flex flex-col items-center justify-center border border-[#E2DACB] hover:border-[#D97706] hover:shadow-md transition-all group"
            >
              <div className="w-12 h-12 rounded-xl bg-[#FFF8E1] flex items-center justify-center mb-2 text-[#D97706]">
                <Swords className="w-6 h-6" />
              </div>
              <span className="text-xs font-extrabold text-[#252525]">BATTLE FRIENDS</span>
              <span className="text-[10px] text-[#D97706] font-bold mt-0.5">Realtime 1v1 / 3P</span>
            </button>
          </div>

          {/* Main Content Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            
            {/* Left 2 Cols: Progress Stats & Subject Breakdown */}
            <div className="lg:col-span-2 space-y-6">
              
              {/* Performance Counters */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm">
                  <span className="text-[10px] text-[#66635D] font-bold block">QUESTIONS ATTEMPTED</span>
                  <span className="text-xl font-black text-[#252525]">{stats.totalQuestions || 0}</span>
                </div>
                <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm">
                  <span className="text-[10px] text-[#66635D] font-bold block">OVERALL ACCURACY</span>
                  <span className="text-xl font-black text-[#2D6A4F]">{stats.accuracy || 0}%</span>
                </div>
                <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm">
                  <span className="text-[10px] text-[#66635D] font-bold block">TESTS COMPLETED</span>
                  <span className="text-xl font-black text-[#244A73]">{stats.testsCompleted || 0}</span>
                </div>
                <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm">
                  <span className="text-[10px] text-[#66635D] font-bold block">MISTAKES MASTERED</span>
                  <span className="text-xl font-black text-[#D97706]">{stats.masteredCount || 0}</span>
                </div>
              </div>

              {/* Subject Performance Progress Bars */}
              <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#E2DACB] shadow-sm space-y-4">
                <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-[#D97706]" /> Subject Accuracy Breakdown
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
                        <span className="font-bold text-[#252525]">{sub.subject}</span>
                        <span className={`font-bold ${sub.accuracy < 50 ? 'text-[#9E2A2B]' : 'text-[#2D6A4F]'}`}>
                          {sub.accuracy}% Accuracy
                        </span>
                      </div>
                      <div className="w-full h-2.5 bg-[#EFE9DC] rounded-full overflow-hidden border border-[#D5CDBF]">
                        <div
                          className={`h-full transition-all duration-500 ${
                            sub.accuracy >= 75 ? 'bg-[#2D6A4F]' : sub.accuracy >= 50 ? 'bg-[#D97706]' : 'bg-[#9E2A2B]'
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
              <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#E2DACB] shadow-sm space-y-3">
                <h3 className="text-xs font-extrabold text-[#244A73] flex items-center gap-1.5 uppercase tracking-wider">
                  <Calendar className="w-4 h-4 text-[#244A73]" /> TODAY'S STUDY PLAN
                </h3>
                
                <div className="space-y-2">
                  <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] space-y-1">
                    <span className="font-bold text-[#252525]">1. Complete Daily Challenge</span>
                    <p className="text-[11px] text-[#66635D]">10 Questions • Earn +50 XP</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] space-y-1">
                    <span className="font-bold text-[#252525]">2. Revise Spaced Notebook</span>
                    <p className="text-[11px] text-[#66635D]">{stats.mistakesRemaining || 0} questions due today</p>
                  </div>
                  <div className="p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] space-y-1">
                    <span className="font-bold text-[#252525]">3. Practice Weak Topic: Polity</span>
                    <p className="text-[11px] text-[#66635D]">Targeted 10-question practice set</p>
                  </div>
                </div>
              </div>

              {/* Badges Preview */}
              <div className="bg-[#FFFDF8] rounded-2xl p-5 border border-[#E2DACB] shadow-sm space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-xs font-extrabold text-[#252525] flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-[#D97706]" /> BADGES & REWARDS
                  </h3>
                  <button onClick={() => setActiveTab('ACHIEVEMENTS')} className="text-[10px] text-[#244A73] font-bold">
                    View All
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  {achievements.slice(0, 3).map(b => (
                    <div key={b.code} className={`p-2.5 rounded-xl border text-[10px] space-y-1 ${
                      b.unlocked ? 'bg-[#FFF8E1] border-[#D97706]/60 text-[#252525] font-bold' : 'bg-[#F7F3EA] border-[#E2DACB] text-[#66635D]'
                    }`}>
                      <Award className={`w-5 h-5 mx-auto ${b.unlocked ? 'text-[#D97706]' : 'text-[#66635D]'}`} />
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
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <Trophy className="w-4 h-4 text-[#D97706]" /> Public Student Leaderboard
            </h2>
            <div className="flex gap-2">
              {['allTime', 'weekly', 'monthly'].map(cat => (
                <button
                  key={cat}
                  onClick={() => {
                    setLeaderboardCategory(cat);
                    fetchLeaderboard(cat);
                  }}
                  className={`px-3 py-1 rounded-lg text-xs font-bold border ${
                    leaderboardCategory === cat ? 'bg-[#244A73] text-white border-[#1B3857]' : 'bg-[#FFFDF8] border-[#E2DACB] text-[#66635D]'
                  }`}
                >
                  {cat.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] space-y-2 shadow-sm">
            {leaderboardData.map(entry => (
              <div key={entry.userId} className="flex justify-between items-center p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-xs">
                <div className="flex items-center gap-3">
                  <span className={`w-6 h-6 rounded-full flex items-center justify-center font-black text-[11px] ${
                    entry.rank === 1 ? 'bg-[#D97706] text-white' :
                    entry.rank === 2 ? 'bg-[#244A73] text-white' :
                    entry.rank === 3 ? 'bg-[#2D6A4F] text-white' : 'bg-[#EFE9DC] text-[#252525]'
                  }`}>
                    {entry.rank}
                  </span>
                  <span className="font-bold text-[#252525]">{entry.displayName}</span>
                  <span className="bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] text-[10px] font-bold px-2 py-0.5 rounded">
                    Level {entry.level}
                  </span>
                </div>

                <div className="flex items-center gap-4">
                  <span className="text-[#D97706] font-bold">{entry.xp} XP</span>
                  <span className="text-[#D97706] font-bold">🔥 {entry.streak}d</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ACHIEVEMENTS TAB */}
      {activeTab === 'ACHIEVEMENTS' && (
        <div className="space-y-4 max-w-4xl mx-auto">
          <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
            <Award className="w-4 h-4 text-[#D97706]" /> All Badges & Learning Achievements
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {achievements.map(b => (
              <div key={b.code} className={`p-4 rounded-xl border flex items-center gap-3 ${
                b.unlocked ? 'bg-[#FFF8E1] border-[#D97706]/60 text-[#252525]' : 'bg-[#FFFDF8] border-[#E2DACB] text-[#66635D]'
              }`}>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${
                  b.unlocked ? 'bg-[#D97706] text-white' : 'bg-[#EFE9DC] text-[#66635D]'
                }`}>
                  <Award className="w-6 h-6" />
                </div>

                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-sm text-[#252525]">{b.title}</span>
                    {b.unlocked && <span className="bg-[#E8F5E9] text-[#2D6A4F] border border-[#A5D6A7] text-[10px] font-bold px-2 py-0.5 rounded">UNLOCKED</span>}
                  </div>
                  <p className="text-[#66635D] text-xs mt-0.5">{b.description}</p>
                  <span className="text-[10px] text-[#D97706] font-bold mt-1 block">Reward: +{b.rewardXp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

