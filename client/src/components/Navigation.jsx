import React, { useState } from 'react';
import { 
  Home, Swords, BookOpen, Sparkles, RefreshCw, Trophy, 
  Users, User, Shield, UploadCloud, Cpu, AlertTriangle, LogOut, X, Mail, Award, Target
} from 'lucide-react';

export const Navigation = ({ activeTab, setActiveTab, user, onLogout, profileOpen: externalProfileOpen, setProfileOpen: externalSetProfileOpen }) => {
  const [internalProfileOpen, setInternalProfileOpen] = useState(false);
  const profileOpen = externalProfileOpen !== undefined ? externalProfileOpen : internalProfileOpen;
  const setProfileOpen = externalSetProfileOpen || setInternalProfileOpen;

  const isAdmin = user && user.role === 'ADMIN';

  const studentNavItems = [
    { id: 'HOME', label: 'Home', icon: Home },
    { id: 'BATTLE', label: 'Battle', icon: Swords, highlight: true },
    { id: 'PRACTICE', label: 'Practice', icon: BookOpen },
    { id: 'AI_STUDY', label: 'AI Study Lab', icon: Sparkles },
    { id: 'PROFILE', label: 'Profile / Logout', icon: User, isProfile: true },
    { id: 'REVISION', label: 'Revision', icon: RefreshCw },
    { id: 'GAMIFICATION', label: 'Progress', icon: Trophy },
    { id: 'SOCIAL', label: 'Friends', icon: Users },
    { id: 'QUESTIONS', label: 'Question Bank', icon: BookOpen }
  ];

  const adminNavItems = [
    { id: 'ADMIN_DASH', label: 'Admin Dashboard', icon: Shield },
    { id: 'ADMIN_QUESTIONS', label: 'Manage Questions', icon: BookOpen },
    { id: 'ADMIN_IMPORT', label: 'Bulk Import', icon: UploadCloud },
    { id: 'ADMIN_AI_GEN', label: 'AI Question Gen', icon: Cpu },
    { id: 'ADMIN_REPORTS', label: 'Report Queue', icon: AlertTriangle }
  ];

  const items = isAdmin ? [...adminNavItems, ...studentNavItems] : studentNavItems;

  const handleLogoutClick = () => {
    setProfileOpen(false);
    onLogout();
  };

  const handleItemClick = (item) => {
    if (item.isProfile) {
      setProfileOpen(true);
    } else {
      setActiveTab(item.id);
    }
  };

  return (
    <>
      <nav className="bg-slate-950/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Title */}
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab(isAdmin ? 'ADMIN_DASH' : 'HOME')}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
                <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-lg sm:text-xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                  EXAMIQ
                </span>
                <span className="block text-[9px] sm:text-[10px] text-slate-400 font-semibold tracking-wider uppercase">AI Exam & Battle</span>
              </div>
            </div>

            {/* Desktop Links */}
            <div className="hidden lg:flex items-center space-x-1">
              {items.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => handleItemClick(item)}
                    className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                      isActive
                        ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                        : item.highlight
                        ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                        : item.isProfile
                        ? 'bg-purple-950/60 text-purple-300 border border-purple-800/80 hover:bg-purple-900/80 font-bold'
                        : 'text-slate-300 hover:text-white hover:bg-slate-800'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Touch-Friendly High-Visibility Top-Right Profile / Account Launcher */}
            <div className="flex items-center space-x-2">
              {user && (
                <button
                  onClick={() => setProfileOpen(true)}
                  aria-label="Account Profile & Logout"
                  className="flex items-center space-x-1.5 bg-gradient-to-r from-purple-950/90 via-indigo-950/90 to-slate-900 border border-purple-500/50 hover:border-purple-400 rounded-full px-3 py-1.5 text-xs transition-all active:scale-95 shadow-md shadow-purple-950/50"
                >
                  <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-purple-500 to-indigo-600 flex items-center justify-center text-white font-black text-[11px] shadow-sm">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="font-extrabold text-purple-200 text-[11px]">
                    Profile & Logout
                  </span>
                  <LogOut className="w-3.5 h-3.5 text-red-400 ml-0.5 shrink-0" />
                </button>
              )}

              {/* Direct Desktop/Quick Logout Button */}
              <button
                onClick={onLogout}
                title="Logout Account"
                className="hidden sm:flex p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
              >
                <LogOut className="w-4.5 h-4.5" />
              </button>
            </div>

          </div>
        </div>

        {/* Mobile Bottom Navigation Bar - includes explicit Profile / Logout tab */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-1 py-1.5 z-50 flex justify-around items-center">
          {studentNavItems.slice(0, 5).map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex flex-col items-center py-1 px-1.5 rounded-xl text-[10px] font-medium transition-all ${
                  item.isProfile
                    ? 'text-purple-300 font-bold bg-purple-950/60 border border-purple-800/80 px-2'
                    : isActive
                    ? 'text-blue-400 font-bold bg-blue-950/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Icon className={`w-5 h-5 mb-0.5 ${item.isProfile ? 'text-red-400' : ''}`} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Profile & Account Details Modal / Bottom Sheet */}
      {profileOpen && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
          <div 
            className="w-full sm:max-w-md bg-slate-900 border border-slate-800 rounded-t-2xl sm:rounded-2xl p-5 shadow-2xl space-y-5 animate-slideUp"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-blue-400" />
                <h3 className="font-bold text-base text-slate-100">Account Profile</h3>
              </div>
              <button 
                onClick={() => setProfileOpen(false)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar & Primary Info */}
            <div className="flex items-center space-x-4 bg-slate-950/60 p-3.5 rounded-xl border border-slate-800/80">
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-purple-600 flex items-center justify-center text-white font-black text-xl shadow-lg shadow-blue-500/20 relative">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-emerald-500 border-2 border-slate-900 rounded-full"></span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-extrabold text-slate-100 text-sm truncate">{user.name}</h4>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full ${
                    user.role === 'ADMIN' ? 'bg-purple-950 text-purple-300 border border-purple-800' : 'bg-blue-950 text-blue-300 border border-blue-800'
                  }`}>
                    {user.role || 'STUDENT'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-slate-400 mt-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-400">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Account Level</span>
                  <span className="font-extrabold text-slate-100 text-sm">Level {user.level || 1}</span>
                </div>
              </div>

              <div className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-blue-500/10 text-blue-400">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-slate-400 uppercase font-semibold">Experience</span>
                  <span className="font-extrabold text-slate-100 text-sm">{user.xp || 0} XP</span>
                </div>
              </div>
            </div>

            {/* Target Exams */}
            {user.targetExams && user.targetExams.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Target Exams</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.targetExams.map((ex, idx) => (
                    <span key={idx} className="bg-slate-800 text-slate-300 text-[11px] font-medium px-2.5 py-1 rounded-md border border-slate-700/50">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Action Buttons: Logout */}
            <div className="pt-2">
              <button
                onClick={handleLogoutClick}
                className="w-full py-3 px-4 bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center space-x-2 text-xs shadow-lg shadow-red-600/30 transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout Account</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
