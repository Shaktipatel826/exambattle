import React from 'react';
import { 
  Home, Swords, BookOpen, Sparkles, RefreshCw, Trophy, 
  Users, User, Shield, UploadCloud, Cpu, AlertTriangle, LogOut
} from 'lucide-react';

export const Navigation = ({ activeTab, setActiveTab, user, onLogout }) => {
  const isAdmin = user && user.role === 'ADMIN';

  const studentNavItems = [
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

  const items = isAdmin ? [...adminNavItems, ...studentNavItems] : studentNavItems;

  return (
    <nav className="bg-slate-950/90 border-b border-slate-800 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16">
          
          {/* Logo & Title */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setActiveTab(isAdmin ? 'ADMIN_DASH' : 'HOME')}>
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight bg-gradient-to-r from-blue-400 via-indigo-300 to-purple-400 bg-clip-text text-transparent">
                EXAMIQ
              </span>
              <span className="block text-[10px] text-slate-400 font-semibold tracking-wider uppercase">AI Exam & Battle</span>
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
                  onClick={() => setActiveTab(item.id)}
                  className={`flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30'
                      : item.highlight
                      ? 'bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30'
                      : 'text-slate-300 hover:text-white hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>

          {/* User Status / Badge */}
          <div className="flex items-center space-x-3">
            {user && (
              <div className="flex items-center space-x-2 bg-slate-900 border border-slate-800 rounded-full px-3 py-1 text-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                <span className="font-semibold text-slate-200">{user.name}</span>
                <span className="bg-blue-900/60 text-blue-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                  Lvl {user.level || 1}
                </span>
                {user.role === 'ADMIN' && (
                  <span className="bg-purple-900/60 text-purple-300 text-[10px] px-2 py-0.5 rounded-full font-bold">
                    ADMIN
                  </span>
                )}
              </div>
            )}

            <button
              onClick={onLogout}
              title="Logout"
              className="p-2 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>

        </div>
      </div>

      {/* Mobile Bottom Navigation Bar */}
      <div className="lg:hidden fixed bottom-0 left-0 right-0 bg-slate-950/95 border-t border-slate-800 backdrop-blur-lg px-2 py-2 z-50 flex justify-around">
        {studentNavItems.slice(0, 5).map((item) => {
          const Icon = item.icon;
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`flex flex-col items-center py-1 px-2 rounded-lg text-[10px] font-medium transition-all ${
                isActive ? 'text-blue-400 font-bold' : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-5 h-5 mb-0.5" />
              <span>{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
