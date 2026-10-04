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
    { id: 'AI_STUDY', label: 'AI Study', icon: Sparkles },
    { id: 'PROFILE', label: 'Profile', icon: User, isProfile: true }
  ];

  const desktopStudentItems = [
    { id: 'HOME', label: 'Home', icon: Home },
    { id: 'BATTLE', label: 'Battle', icon: Swords, highlight: true },
    { id: 'PRACTICE', label: 'Practice', icon: BookOpen },
    { id: 'AI_STUDY', label: 'AI Study Lab', icon: Sparkles },
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

  const items = isAdmin ? [...adminNavItems, ...desktopStudentItems] : desktopStudentItems;

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
      <nav className="bg-[#EFE9DC] border-b border-[#E2DACB] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6">
          <div className="flex items-center justify-between h-16">
            
            {/* Logo & Title */}
            <div className="flex items-center space-x-2.5 cursor-pointer" onClick={() => setActiveTab(isAdmin ? 'ADMIN_DASH' : 'HOME')}>
              <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl bg-[#244A73] flex items-center justify-center shadow-sm">
                <Swords className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
              </div>
              <div>
                <span className="font-extrabold text-lg sm:text-xl tracking-tight text-[#244A73]">
                  EXAMBATTLE
                </span>
                <span className="block text-[9px] sm:text-[10px] text-[#66635D] font-bold tracking-wider uppercase">Competitive Exam Preparation</span>
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
                    className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                      isActive
                        ? 'bg-[#244A73] text-white shadow-sm'
                        : item.highlight
                        ? 'bg-[#FFFDF8] text-[#244A73] border border-[#244A73]/30 hover:bg-[#F7F3EA]'
                        : 'text-[#66635D] hover:text-[#252525] hover:bg-[#E2DACB]/50'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Single Touch-Friendly Profile Launcher in Header */}
            <div className="flex items-center space-x-2">
              {user && (
                <button
                  onClick={() => setProfileOpen(true)}
                  aria-label="Account Profile"
                  className="flex items-center space-x-2 bg-[#FFFDF8] border border-[#D5CDBF] hover:border-[#244A73] rounded-full px-3 py-1.5 text-xs transition-all active:scale-95 shadow-sm"
                >
                  <div className="w-6 h-6 rounded-full bg-[#244A73] flex items-center justify-center text-white font-bold text-[11px]">
                    {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <span className="font-bold text-[#252525] text-[11px]">
                    Profile
                  </span>
                </button>
              )}
            </div>

          </div>
        </div>

        {/* Mobile Bottom Navigation Bar - includes single Profile tab */}
        <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#EFE9DC] border-t border-[#E2DACB] px-1 py-1.5 z-50 flex justify-around items-center shadow-lg">
          {studentNavItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleItemClick(item)}
                className={`flex flex-col items-center py-1 px-2 rounded-xl text-[10px] font-semibold transition-all ${
                  item.isProfile
                    ? 'text-[#244A73] font-bold bg-[#FFFDF8] border border-[#E2DACB] px-2.5 shadow-sm'
                    : isActive
                    ? 'text-[#244A73] font-bold bg-[#FFFDF8] border border-[#E2DACB] px-2 shadow-sm'
                    : 'text-[#66635D] hover:text-[#252525]'
                }`}
              >
                <Icon className="w-5 h-5 mb-0.5" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Account Profile Details Modal / Sheet */}
      {profileOpen && user && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-[#252525]/40 backdrop-blur-xs animate-fadeIn">
          <div 
            className="w-full sm:max-w-md bg-[#FFFDF8] border border-[#E2DACB] rounded-t-2xl sm:rounded-2xl p-5 shadow-xl space-y-5 animate-slideUp text-[#252525]"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-[#E2DACB] pb-3">
              <div className="flex items-center space-x-2">
                <User className="w-5 h-5 text-[#244A73]" />
                <h3 className="font-extrabold text-base text-[#252525]">Account Profile</h3>
              </div>
              <button 
                onClick={() => setProfileOpen(false)}
                className="p-1.5 text-[#66635D] hover:text-[#252525] rounded-lg hover:bg-[#EFE9DC] transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Profile Avatar & Primary Info */}
            <div className="flex items-center space-x-4 bg-[#F7F3EA] p-3.5 rounded-xl border border-[#E2DACB]">
              <div className="w-14 h-14 rounded-2xl bg-[#244A73] flex items-center justify-center text-white font-black text-xl shadow-sm relative">
                {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                <span className="absolute -bottom-1 -right-1 w-4 h-4 bg-[#2D6A4F] border-2 border-white rounded-full"></span>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2">
                  <h4 className="font-bold text-[#252525] text-sm truncate">{user.name}</h4>
                  <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${
                    user.role === 'ADMIN' ? 'bg-[#244A73] text-white border-[#1B3857]' : 'bg-[#EFE9DC] text-[#244A73] border-[#D5CDBF]'
                  }`}>
                    {user.role || 'STUDENT'}
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-xs text-[#66635D] mt-1 truncate">
                  <Mail className="w-3.5 h-3.5 text-[#66635D] shrink-0" />
                  <span className="truncate">{user.email}</span>
                </div>
              </div>
            </div>

            {/* Stats Overview */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="bg-[#F7F3EA] border border-[#E2DACB] p-3 rounded-xl flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-[#EFE9DC] text-[#D97706]">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-[#66635D] uppercase font-bold">Account Level</span>
                  <span className="font-black text-[#252525] text-sm">Level {user.level || 1}</span>
                </div>
              </div>

              <div className="bg-[#F7F3EA] border border-[#E2DACB] p-3 rounded-xl flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-[#EFE9DC] text-[#244A73]">
                  <Target className="w-5 h-5" />
                </div>
                <div>
                  <span className="block text-[10px] text-[#66635D] uppercase font-bold">Experience</span>
                  <span className="font-black text-[#252525] text-sm">{user.xp || 0} XP</span>
                </div>
              </div>
            </div>

            {/* Target Exams */}
            {user.targetExams && user.targetExams.length > 0 && (
              <div className="space-y-1.5">
                <span className="text-[11px] font-bold text-[#66635D] uppercase tracking-wider">Target Exams</span>
                <div className="flex flex-wrap gap-1.5">
                  {user.targetExams.map((ex, idx) => (
                    <span key={idx} className="bg-[#EFE9DC] text-[#244A73] text-[11px] font-bold px-2.5 py-1 rounded-md border border-[#D5CDBF]">
                      {ex}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Single Logout Button */}
            <div className="pt-2">
              <button
                onClick={handleLogoutClick}
                className="w-full py-3 px-4 bg-[#9E2A2B] hover:bg-[#7E2223] active:scale-[0.98] text-white rounded-xl font-bold flex items-center justify-center space-x-2 text-xs shadow-sm transition-all"
              >
                <LogOut className="w-4 h-4" />
                <span>Logout</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
