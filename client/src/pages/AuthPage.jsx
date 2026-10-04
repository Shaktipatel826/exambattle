import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { Swords, Check, AlertCircle, Shield, UserCheck, ArrowLeft } from 'lucide-react';

export const AuthPage = ({ initialMode = 'login', initialRole = 'STUDENT', onBackToHome }) => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(initialMode === 'login');
  const [role, setRole] = useState(initialRole); // STUDENT | ADMIN
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetExams, setTargetExams] = useState(['SSC CGL', 'UP Police']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setIsLogin(initialMode === 'login');
    setRole(initialRole);
    if (initialMode === 'register') {
      setRole('STUDENT'); // Public sign up is strictly STUDENT
    }
  }, [initialMode, initialRole]);

  const availableExams = [
    'SSC CGL', 'SSC CHSL', 'SSC MTS', 'SSC GD',
    'Railway NTPC', 'Railway ALP', 'Railway Group D',
    'IBPS PO / Clerk', 'SBI PO / Clerk',
    'UP Police Constable', 'UP Police SI / UPSI', 'UPSSSC PET', 'UP Lekhpal'
  ];

  const toggleExam = (exam) => {
    if (targetExams.includes(exam)) {
      setTargetExams(targetExams.filter(e => e !== exam));
    } else {
      setTargetExams([...targetExams, exam]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/register';
    const payload = isLogin 
      ? { email, password }
      : { name, email, password, targetExams, role: 'STUDENT' };

    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (data.success) {
        login(data.user, data.token);
      } else {
        setError(data.message || 'Authentication failed');
      }
    } catch (err) {
      setError('Unable to connect to server');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[#F7F3EA] text-[#252525] relative">
      <div className="w-full max-w-md bg-[#FFFDF8] rounded-2xl p-6 sm:p-8 relative z-10 border border-[#E2DACB] shadow-md">
        
        {/* Back to Home Button */}
        {onBackToHome && (
          <button
            onClick={onBackToHome}
            className="mb-4 text-xs font-bold text-[#66635D] hover:text-[#244A73] flex items-center gap-1.5 transition-all"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Public Home</span>
          </button>
        )}

        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-[#244A73] flex items-center justify-center shadow-sm mb-3">
            <Swords className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-[#244A73]">EXAMBATTLE</h1>
          <p className="text-xs text-[#66635D] mt-1 font-medium">
            {isLogin 
              ? (role === 'ADMIN' ? 'Admin Portal Sign In' : 'Sign in to access your Student Dashboard')
              : 'Create your aspirant student account'}
          </p>
        </div>

        {/* Quick Demo Credentials Banner */}
        <div className="mb-5 p-3 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-xs text-[#252525]">
          <p className="font-bold text-[#244A73] mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> Demo Login Credentials:
          </p>
          <div className="flex justify-between items-center text-[11px] text-[#66635D]">
            <span>Student: <code className="text-[#2D6A4F] font-bold">student@shakti.com</code> / <code>student123</code></span>
            <button type="button" onClick={() => { setEmail('student@shakti.com'); setPassword('student123'); setRole('STUDENT'); setIsLogin(true); }} className="text-[#244A73] underline font-bold">Use</button>
          </div>
          <div className="flex justify-between items-center text-[11px] text-[#66635D] mt-1">
            <span>Admin: <code className="text-[#8C6B1B] font-bold">admin@shakti.com</code> / <code>admin123</code></span>
            <button type="button" onClick={() => { setEmail('admin@shakti.com'); setPassword('admin123'); setRole('ADMIN'); setIsLogin(true); }} className="text-[#8C6B1B] underline font-bold">Use</button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-[#FDF2F2] border border-[#F87171] text-[#9E2A2B] text-xs flex items-center space-x-2 font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-bold text-[#252525] mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shakti Patel"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#244A73]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#252525] mb-1">Account Role</label>
                <div className="p-2.5 rounded-lg bg-[#EFE9DC] border border-[#D5CDBF] text-xs font-bold text-[#244A73] flex items-center justify-between">
                  <span>STUDENT (Competitive Exam Aspirant)</span>
                  <span className="text-[10px] text-[#66635D] font-normal">Public Sign Up</span>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#252525] mb-1">Target Examinations</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-[#F7F3EA] rounded-lg border border-[#E2DACB]">
                  {availableExams.map(exam => {
                    const active = targetExams.includes(exam);
                    return (
                      <button
                        key={exam}
                        type="button"
                        onClick={() => toggleExam(exam)}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-bold transition-all flex items-center space-x-1 border ${
                          active
                            ? 'bg-[#244A73] border-[#1B3857] text-white'
                            : 'bg-white border-[#D5CDBF] text-[#66635D]'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-white" />}
                        <span>{exam}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold text-[#252525] mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="student@shakti.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#244A73]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-[#252525] mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] rounded-lg px-3 py-2 text-xs focus:outline-none focus:border-[#244A73]"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold text-xs tracking-wider uppercase shadow-sm transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'SIGN IN TO DASHBOARD' : 'CREATE ASPIRANT ACCOUNT'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-[#244A73] hover:underline font-bold"
          >
            {isLogin ? "Don't have an account? Register here" : 'Already registered? Sign in'}
          </button>
        </div>

      </div>
    </div>
  );
};
