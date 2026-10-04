import React from 'react';
import { 
  Swords, BookOpen, Shield, Sparkles, RefreshCw, Trophy, Users, ArrowRight, UserCheck, CheckCircle2, Lock
} from 'lucide-react';

export const PublicHomePage = ({ onSelectMode }) => {
  return (
    <div className="min-h-screen bg-[#F7F3EA] text-[#252525] selection:bg-[#244A73] selection:text-white flex flex-col">
      
      {/* Top Header Bar */}
      <header className="bg-[#EFE9DC] border-b border-[#E2DACB] sticky top-0 z-40 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#244A73] flex items-center justify-center shadow-sm">
              <Swords className="w-6 h-6 text-white" />
            </div>
            <div>
              <span className="font-extrabold text-xl tracking-tight text-[#244A73]">EXAMBATTLE</span>
              <span className="block text-[10px] text-[#66635D] font-bold tracking-wider uppercase">Competitive Exam Preparation</span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onSelectMode('login', 'STUDENT')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-[#244A73] bg-[#FFFDF8] border border-[#D5CDBF] hover:bg-[#F7F3EA] transition-all"
            >
              Student Sign In
            </button>
            <button
              onClick={() => onSelectMode('register', 'STUDENT')}
              className="px-3.5 py-2 rounded-xl text-xs font-bold text-white bg-[#244A73] hover:bg-[#1B3857] shadow-sm transition-all hidden sm:inline-block"
            >
              Student Sign Up
            </button>
            <button
              onClick={() => onSelectMode('login', 'ADMIN')}
              className="px-3 py-2 rounded-xl text-xs font-bold text-[#8C6B1B] bg-[#FFF8E6] border border-[#E6C875] hover:bg-[#FCEFCA] transition-all flex items-center gap-1.5"
            >
              <Shield className="w-3.5 h-3.5" />
              <span>Admin Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Banner Section */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-12">
        
        <div className="bg-[#FFFDF8] rounded-3xl p-6 sm:p-12 border border-[#E2DACB] shadow-md text-center space-y-6 relative overflow-hidden">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#EFE9DC] border border-[#D5CDBF] text-xs font-extrabold text-[#244A73]">
            <Sparkles className="w-4 h-4 text-amber-600" />
            <span>Official Competitive Exam Preparation & Battle Engine</span>
          </div>

          <h1 className="text-3xl sm:text-5xl font-black text-[#244A73] tracking-tight max-w-4xl mx-auto leading-tight">
            Master SSC, Railways, Banking & State Exams with Live Battles & AI
          </h1>

          <p className="text-sm sm:text-base text-[#66635D] font-medium max-w-2xl mx-auto leading-relaxed">
            ExamBattle combines real-time multiplayer 1v1 quizzes, unconstrained Gemini AI question extraction, spaced revision notebooks, and full mock tests into a unified academic platform.
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
            <button
              onClick={() => onSelectMode('register', 'STUDENT')}
              className="px-6 py-3.5 rounded-2xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold text-xs uppercase tracking-wider shadow-md hover:scale-105 active:scale-95 transition-all flex items-center gap-2"
            >
              <span>Get Started as Student</span>
              <ArrowRight className="w-4 h-4" />
            </button>
            
            <button
              onClick={() => onSelectMode('login', 'ADMIN')}
              className="px-6 py-3.5 rounded-2xl bg-[#FFFDF8] hover:bg-[#F7F3EA] text-[#244A73] border-2 border-[#244A73] font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center gap-2"
            >
              <Shield className="w-4 h-4 text-[#8C6B1B]" />
              <span>Admin Portal Login</span>
            </button>
          </div>
        </div>

        {/* Account Selection Section ("Choose Your Account") */}
        <div className="space-y-6">
          <div className="text-center space-y-1">
            <h2 className="text-2xl font-black text-[#244A73] tracking-tight">Choose Your Account</h2>
            <p className="text-xs text-[#66635D] font-medium">Select your role to access the corresponding workspace</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            
            {/* Student Account Portal Card */}
            <div className="bg-[#FFFDF8] p-6 sm:p-8 rounded-3xl border-2 border-[#E2DACB] hover:border-[#244A73] transition-all shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#EFE9DC] text-[#244A73] flex items-center justify-center font-bold">
                  <BookOpen className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="text-xl font-extrabold text-[#252525]">Aspirant & Student Portal</h3>
                  <p className="text-xs text-[#66635D] mt-1 font-medium leading-relaxed">
                    Designed for students preparing for SSC CGL, Railway NTPC, Banking, UP Police, and State Competitive Examinations.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[#252525] pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span>Live 1v1 Multiplayer Quiz Battles with Real-Time Leaderboards</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span>Solo Exam Practice with Instant Explanations</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#2D6A4F] shrink-0" />
                    <span>AI Study Lab & Spaced Revision Notebook</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#E2DACB]">
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => onSelectMode('login', 'STUDENT')}
                    className="w-full py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all"
                  >
                    Student Sign In
                  </button>
                  <button
                    onClick={() => onSelectMode('register', 'STUDENT')}
                    className="w-full py-3 rounded-xl bg-[#EFE9DC] hover:bg-[#E2DACB] text-[#244A73] border border-[#D5CDBF] font-extrabold text-xs uppercase tracking-wider transition-all"
                  >
                    Student Sign Up
                  </button>
                </div>

                {/* Demo Credentials Note */}
                <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-[11px] text-[#66635D] flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold text-[#244A73]">
                    <UserCheck className="w-3.5 h-3.5" /> Demo Student:
                  </span>
                  <code>student@shakti.com / student123</code>
                </div>
              </div>
            </div>

            {/* Admin Account Portal Card */}
            <div className="bg-[#FFFDF8] p-6 sm:p-8 rounded-3xl border-2 border-[#E2DACB] hover:border-[#8C6B1B] transition-all shadow-sm space-y-5 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-[#FFF8E6] text-[#8C6B1B] border border-[#E6C875] flex items-center justify-center font-bold">
                  <Shield className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-xl font-extrabold text-[#252525]">Admin & Educator Portal</h3>
                    <span className="px-2 py-0.5 rounded-md bg-[#FFF8E6] border border-[#E6C875] text-[10px] font-bold text-[#8C6B1B]">SECURE</span>
                  </div>
                  <p className="text-xs text-[#66635D] mt-1 font-medium leading-relaxed">
                    Protected administration interface for managing question banks, bulk file imports, and Gemini AI question generation.
                  </p>
                </div>

                <ul className="space-y-2 text-xs text-[#252525] pt-2">
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8C6B1B] shrink-0" />
                    <span>Unconstrained Gemini AI Question Generator across complete PDFs/transcripts</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8C6B1B] shrink-0" />
                    <span>Question Bank Management with filters, status approvals & versioning</span>
                  </li>
                  <li className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-[#8C6B1B] shrink-0" />
                    <span>Bulk Question Import (JSON/CSV) & Report Queue management</span>
                  </li>
                </ul>
              </div>

              <div className="space-y-3 pt-4 border-t border-[#E2DACB]">
                <button
                  onClick={() => onSelectMode('login', 'ADMIN')}
                  className="w-full py-3 rounded-xl bg-[#8C6B1B] hover:bg-[#6D5213] text-white font-extrabold text-xs uppercase tracking-wider shadow-sm transition-all flex items-center justify-center gap-2"
                >
                  <Shield className="w-4 h-4" />
                  <span>Admin Sign In</span>
                </button>

                {/* Admin Note */}
                <div className="p-2.5 rounded-xl bg-[#FFF8E6] border border-[#E6C875] text-[11px] text-[#8C6B1B] flex items-center justify-between">
                  <span className="flex items-center gap-1 font-bold">
                    <Lock className="w-3.5 h-3.5" /> Demo Admin:
                  </span>
                  <code>admin@shakti.com / admin123</code>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid sm:grid-cols-3 gap-6 pt-4">
          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-[#EFE9DC] text-[#244A73] flex items-center justify-center mx-auto sm:mx-0">
              <Swords className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#244A73]">Live Quiz Battles</h4>
            <p className="text-xs text-[#66635D]">Compete head-to-head with aspirants across India in real-time speed battles.</p>
          </div>

          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-[#EFE9DC] text-[#244A73] flex items-center justify-center mx-auto sm:mx-0">
              <Cpu className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#244A73]">Unconstrained AI MCQ Generator</h4>
            <p className="text-xs text-[#66635D]">Process 50+ page PDFs or 1-hour transcripts into high-yield source-grounded MCQs.</p>
          </div>

          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] space-y-2 text-center sm:text-left">
            <div className="w-10 h-10 rounded-xl bg-[#EFE9DC] text-[#244A73] flex items-center justify-center mx-auto sm:mx-0">
              <RefreshCw className="w-5 h-5" />
            </div>
            <h4 className="font-extrabold text-sm text-[#244A73]">Spaced Revision System</h4>
            <p className="text-xs text-[#66635D]">Automatically track wrong answers and reinforce weak topics before your real exam.</p>
          </div>
        </div>

      </main>

      {/* Footer */}
      <footer className="bg-[#EFE9DC] border-t border-[#E2DACB] py-6 text-center text-xs text-[#66635D] font-medium mt-auto">
        <p>© 2026 ExamBattle Platform — Professional Competitive Exam Preparation System</p>
      </footer>
    </div>
  );
};
