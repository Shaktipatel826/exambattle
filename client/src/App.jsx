import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
import { PublicHomePage } from './pages/PublicHomePage';
import { AuthPage } from './pages/AuthPage';
import { StudentDashboard } from './pages/StudentDashboard';
import { AIStudyLab } from './pages/AIStudyLab';
import { QuestionBankPage } from './pages/QuestionBankPage';
import { SoloPracticePage } from './pages/SoloPracticePage';
import { MultiplayerBattlePage } from './pages/MultiplayerBattlePage';
import { WrongQuestionNotebook } from './pages/WrongQuestionNotebook';
import { WeakTopicAnalysis } from './pages/WeakTopicAnalysis';
import { SocialFriendsPage } from './pages/SocialFriendsPage';
import { GamificationPage } from './pages/GamificationPage';
import { AIStudyAssistantModal } from './pages/AIStudyAssistantModal';
import { AdminDashboard } from './pages/AdminDashboard';
import { Bot } from 'lucide-react';

const AppContent = () => {
  const { user, token, loading, logout } = useAuth();
  
  // Auth Flow state for unauthenticated visitors: PUBLIC_HOME | AUTH_FORM
  const [authFlow, setAuthFlow] = useState({ view: 'PUBLIC_HOME', mode: 'login', role: 'STUDENT' });
  
  // Navigation active tab for authenticated users
  const [activeTab, setActiveTab] = useState('HOME');
  const [profileOpen, setProfileOpen] = useState(false);
  const [customTestConfig, setCustomTestConfig] = useState(null);
  const [assistantOpen, setAssistantOpen] = useState(false);

  const handleLaunchAdminTest = (testConfig) => {
    setCustomTestConfig(testConfig);
    setActiveTab('PRACTICE');
  };

  const handleLogout = () => {
    setProfileOpen(false);
    logout();
    setActiveTab('HOME');
    setAuthFlow({ view: 'PUBLIC_HOME', mode: 'login', role: 'STUDENT' });
  };

  // Route user automatically based on authenticated role
  useEffect(() => {
    if (user) {
      if (user.role === 'ADMIN') {
        if (!activeTab || !activeTab.startsWith('ADMIN')) {
          setActiveTab('ADMIN_DASH');
        }
      } else {
        if (activeTab && activeTab.startsWith('ADMIN')) {
          setActiveTab('HOME');
        }
      }
    }
  }, [user]);

  // Hardware Back Button listener for Android Capacitor APK
  useEffect(() => {
    let handler;
    const registerBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        handler = await CapApp.addListener('backButton', () => {
          if (profileOpen) {
            setProfileOpen(false);
          } else if (assistantOpen) {
            setAssistantOpen(false);
          } else if (activeTab !== 'HOME' && user?.role !== 'ADMIN') {
            setActiveTab('HOME');
          } else if (activeTab !== 'ADMIN_DASH' && user?.role === 'ADMIN') {
            setActiveTab('ADMIN_DASH');
          } else {
            CapApp.minimizeApp();
          }
        });
      } catch (e) {
        // Web environment gracefully ignores Capacitor native back handler
      }
    };
    registerBackButton();

    return () => {
      if (handler && typeof handler.remove === 'function') {
        handler.remove();
      }
    };
  }, [activeTab, assistantOpen, profileOpen, user]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3EA] text-[#252525] text-xs font-bold">
        Loading ExamBattle Platform...
      </div>
    );
  }

  // Unauthenticated Flow: Public Home Page or Authentication Form
  if (!token || !user) {
    if (authFlow.view === 'AUTH_FORM') {
      return (
        <AuthPage
          initialMode={authFlow.mode}
          initialRole={authFlow.role}
          onBackToHome={() => setAuthFlow({ view: 'PUBLIC_HOME', mode: 'login', role: 'STUDENT' })}
        />
      );
    }

    return (
      <PublicHomePage
        onSelectMode={(mode, role) => setAuthFlow({ view: 'AUTH_FORM', mode, role })}
      />
    );
  }

  // Authenticated Main View Router
  return (
    <div className="min-h-screen bg-[#F7F3EA] text-[#252525] flex flex-col selection:bg-[#244A73] selection:text-white pb-16 lg:pb-0">
      
      {/* Top Header Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={handleLogout}
        profileOpen={profileOpen}
        setProfileOpen={setProfileOpen}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'HOME' && (
          <StudentDashboard
            token={token}
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
            onOpenProfile={() => setProfileOpen(true)}
            onLogout={handleLogout}
          />
        )}

        {activeTab === 'BATTLE' && (
          <MultiplayerBattlePage token={token} user={user} />
        )}

        {activeTab === 'PRACTICE' && (
          <SoloPracticePage
            token={token}
            initialConfig={customTestConfig}
            autoStart={!!customTestConfig}
            onComplete={() => {
              setCustomTestConfig(null);
              setActiveTab(user?.role === 'ADMIN' ? 'ADMIN_DASH' : 'HOME');
            }}
          />
        )}

        {activeTab === 'AI_STUDY' && (
          <AIStudyLab token={token} />
        )}

        {activeTab === 'REVISION' && (
          <WrongQuestionNotebook token={token} />
        )}

        {activeTab === 'QUESTIONS' && (
          <QuestionBankPage
            token={token}
            onStartPractice={() => setActiveTab('PRACTICE')}
          />
        )}

        {activeTab === 'GAMIFICATION' && (
          <GamificationPage token={token} user={user} />
        )}

        {activeTab === 'SOCIAL' && (
          <SocialFriendsPage
            token={token}
            onChallengeFriend={() => setActiveTab('BATTLE')}
          />
        )}

        {activeTab === 'WEAK_TOPICS' && (
          <WeakTopicAnalysis
            token={token}
            onPracticeWeak={() => setActiveTab('PRACTICE')}
          />
        )}

        {/* Admin Section (Protected for ADMIN role) */}
        {activeTab.startsWith('ADMIN') && user?.role === 'ADMIN' && (
          <AdminDashboard
            token={token}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            onTakeTest={handleLaunchAdminTest}
            onChallengeFriend={() => setActiveTab('BATTLE')}
          />
        )}
      </main>

      {/* Floating AI Assistant Launcher Button - Academic Theme */}
      <button
        onClick={() => setAssistantOpen(!assistantOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 px-4 py-3 rounded-full bg-[#244A73] hover:bg-[#1B3857] text-white shadow-md border border-[#1B3857] hover:scale-105 active:scale-95 transition-all flex items-center space-x-2 text-xs font-bold"
      >
        <Bot className="w-5 h-5 text-amber-300" />
        <span className="hidden sm:inline">Ask AI Assistant</span>
      </button>

      {/* AI Assistant Drawer */}
      <AIStudyAssistantModal
        token={token}
        isOpen={assistantOpen}
        onClose={() => setAssistantOpen(false)}
      />

    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
