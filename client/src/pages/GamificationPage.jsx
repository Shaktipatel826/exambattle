import React, { useState, useEffect } from 'react';
import { Trophy, Zap, Shield, Award, Flame } from 'lucide-react';

export const GamificationPage = ({ token, user }) => {
  const [leaderboard, setLeaderboard] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeaderboard();
  }, []);

  const fetchLeaderboard = async () => {
    try {
      const res = await fetch('/api/users/leaderboard', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setLeaderboard(data.leaderboard || []);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const badgesList = [
    { code: 'FIRST_BATTLE', title: 'First Battle', desc: 'Completed your first 1v1 multiplayer battle round', icon: '⚔️' },
    { code: '7_DAY_STREAK', title: '7-Day Streak', desc: 'Maintained a 7-day study practice streak', icon: '🔥' },
    { code: '100_CORRECT', title: '100 Correct', desc: 'Answered 100 questions correctly', icon: '🎯' },
    { code: 'POLITY_PRO', title: 'Polity Pro', desc: 'Mastered Indian Polity Fundamental Rights & Articles', icon: '🏛️' },
    { code: 'HISTORY_PRO', title: 'History Pro', desc: 'Achieved 80%+ accuracy in Modern History', icon: '📜' },
    { code: 'REVISION_MASTER', title: 'Revision Master', desc: 'Cleared 20 spaced repetition revision cards', icon: '🔄' }
  ];

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-amber-950/40 via-slate-900 to-slate-900 border border-amber-500/30 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-white flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-400" /> PROGRESS, BADGES & LEADERBOARD
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Track your XP level advancement, unlock exam mastery badges, and view global rankings.
          </p>
        </div>

        <div className="flex items-center space-x-3 bg-slate-950 p-3 rounded-xl border border-slate-800 self-start md:self-auto">
          <div>
            <span className="text-[10px] text-slate-400 font-bold block">LEVEL {user?.level || 8}</span>
            <span className="text-base font-black text-amber-400">{(user?.xp || 2450).toLocaleString()} XP</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Badges Collection */}
        <div className="lg:col-span-2 glass-panel p-5 rounded-xl border border-slate-700/80 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <Award className="w-4 h-4 text-amber-400" /> Unlocked Aspirant Badges
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {badgesList.map(b => (
              <div key={b.code} className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 space-y-1">
                <div className="text-2xl mb-1">{b.icon}</div>
                <h3 className="text-xs font-bold text-slate-200">{b.title}</h3>
                <p className="text-[10px] text-slate-400 leading-tight">{b.desc}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Leaderboard */}
        <div className="glass-panel p-5 rounded-xl border border-slate-700/80 space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
            <Trophy className="w-4 h-4 text-amber-400" /> Global Aspirants Leaderboard
          </h2>

          <div className="space-y-2">
            {(leaderboard.length > 0 ? leaderboard : [
              { rank: 1, name: 'Shakti Student', xp: 2450, level: 8, targetExam: 'SSC CGL' },
              { rank: 2, name: 'Aman Verma', xp: 1980, level: 7, targetExam: 'UP Police' },
              { rank: 3, name: 'Rahul Sharma', xp: 1450, level: 5, targetExam: 'Railway NTPC' }
            ]).map(item => (
              <div key={item.rank} className="p-3 rounded-lg bg-slate-950 border border-slate-800 flex justify-between items-center text-xs font-bold">
                <div className="flex items-center space-x-2">
                  <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 flex items-center justify-center text-[10px] font-black text-amber-400">
                    {item.rank}
                  </span>
                  <div>
                    <h3 className="text-slate-200">{item.name}</h3>
                    <span className="text-[10px] text-slate-400 font-normal">Lvl {item.level} • {item.targetExam}</span>
                  </div>
                </div>
                <span className="text-amber-400 font-mono font-black">{item.xp} XP</span>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
};
