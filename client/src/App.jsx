import React, { useState } from 'react';
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
  const [assistantOpen, setAssistantOpen] = useState(false);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-slate-400 text-xs font-semibold">
        Loading ExamiQ Platform...
      </div>
    );
  }

  if (!token || !user) {
    return <AuthPage />;
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col selection:bg-blue-600 selection:text-white pb-16 lg:pb-0">
      
      {/* Top Header Navigation */}
      <Navigation
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        user={user}
        onLogout={logout}
      />

      {/* Main View Router */}
      <main className="flex-1">
        {activeTab === 'HOME' && (
          <StudentDashboard
            token={token}
            user={user}
            onNavigate={(tab) => setActiveTab(tab)}
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

      {/* Floating AI Study Assistant Launcher Button */}
      <button
        onClick={() => setAssistantOpen(!assistantOpen)}
        className="fixed bottom-20 right-4 lg:bottom-6 lg:right-6 z-40 p-3.5 rounded-full bg-gradient-to-tr from-purple-600 to-indigo-600 text-white shadow-xl shadow-purple-600/40 hover:scale-110 transition-all flex items-center space-x-2 text-xs font-bold"
      >
        <Bot className="w-5 h-5" />
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
