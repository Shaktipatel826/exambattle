import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { Navigation } from './components/Navigation';
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
  const [activeTab, setActiveTab] = useState('HOME');
  const [profileOpen, setProfileOpen] = useState(false);
  const [assistantOpen, setAssistantOpen] = useState(false);

  // Automatically route ADMIN user to Admin Dashboard on login
  useEffect(() => {
    if (user && user.role === 'ADMIN' && activeTab === 'HOME') {
      setActiveTab('ADMIN_DASH');
    }
  }, [user]);

  // Hardware Back Button listener for Android Capacitor APK
  useEffect(() => {
    let handler;
    const registerBackButton = async () => {
      try {
        const { App: CapApp } = await import('@capacitor/app');
        handler = await CapApp.addListener('backButton', ({ canGoBack }) => {
          if (profileOpen) {
            setProfileOpen(false);
          } else if (assistantOpen) {
            setAssistantOpen(false);
          } else if (activeTab !== 'HOME') {
            setActiveTab('HOME');
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
  }, [activeTab, assistantOpen, profileOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F7F3EA] text-[#252525] text-xs font-bold">
        Loading ExamBattle Platform...
      </div>
    );
  }

  if (!token || !user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-[#F7F3EA] text-[#252525] flex flex-col selection:bg-[#244A73] selection:text-white pb-16 lg:pb-0">
      
      {/* Top Header Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={logout}
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
            onLogout={logout}
          />
        )}

        {activeTab === 'BATTLE' && (
          <MultiplayerBattlePage token={token} user={user} />
        )}

        {activeTab === 'PRACTICE' && (
          <SoloPracticePage
            token={token}
            onComplete={() => setActiveTab('HOME')}
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

        {/* Admin Section */}
        {activeTab.startsWith('ADMIN') && (
          <AdminDashboard token={token} />
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
