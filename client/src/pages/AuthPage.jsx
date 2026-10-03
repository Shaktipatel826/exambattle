import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Swords, Check, AlertCircle, Shield, UserCheck } from 'lucide-react';

export const AuthPage = () => {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  const [role, setRole] = useState('STUDENT'); // STUDENT | ADMIN
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [targetExams, setTargetExams] = useState(['SSC CGL', 'UP Police']);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      : { name, email, password, targetExams, role };

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
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 relative overflow-hidden">
      {/* Background Glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-96 h-96 bg-blue-600/20 blur-3xl rounded-full pointer-events-none"></div>

      <div className="w-full max-w-md glass-panel rounded-2xl p-6 sm:p-8 relative z-10 border border-slate-700/80 shadow-2xl">
        
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 flex items-center justify-center shadow-lg shadow-blue-500/30 mb-3">
            <Swords className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">EXAMIQ PLATFORM</h1>
          <p className="text-xs text-slate-400 mt-1">
            {isLogin ? 'Sign in to access your Study Lab & Battle Arena' : 'Create your competitive exam aspirant account'}
          </p>
        </div>

        {/* Quick Demo Credentials Banner */}
        <div className="mb-5 p-3 rounded-xl bg-slate-900/80 border border-slate-700 text-xs text-slate-300">
          <p className="font-semibold text-blue-400 mb-1 flex items-center gap-1">
            <UserCheck className="w-3.5 h-3.5" /> Demo Login Credentials:
          </p>
          <div className="flex justify-between items-center text-[11px] text-slate-400">
            <span>Student: <code className="text-emerald-400">student@shakti.com</code> / <code>student123</code></span>
            <button onClick={() => { setEmail('student@shakti.com'); setPassword('student123'); }} className="text-blue-400 underline font-bold">Use</button>
          </div>
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
            <span>Admin: <code className="text-purple-400">admin@shakti.com</code> / <code>admin123</code></span>
            <button onClick={() => { setEmail('admin@shakti.com'); setPassword('admin123'); }} className="text-purple-400 underline font-bold">Use</button>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-lg bg-red-950/60 border border-red-800/80 text-red-200 text-xs flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isLogin && (
            <>
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Shakti Patel"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Account Role</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRole('STUDENT')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      role === 'STUDENT'
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    STUDENT
                  </button>
                  <button
                    type="button"
                    onClick={() => setRole('ADMIN')}
                    className={`py-2 rounded-lg text-xs font-bold transition-all border ${
                      role === 'ADMIN'
                        ? 'bg-purple-600 border-purple-500 text-white'
                        : 'bg-slate-900 border-slate-800 text-slate-400'
                    }`}
                  >
                    ADMIN
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Examinations</label>
                <div className="flex flex-wrap gap-1.5 max-h-32 overflow-y-auto custom-scrollbar p-2 bg-slate-950/80 rounded-lg border border-slate-800">
                  {availableExams.map(exam => {
                    const active = targetExams.includes(exam);
                    return (
                      <button
                        key={exam}
                        type="button"
                        onClick={() => toggleExam(exam)}
                        className={`text-[10px] px-2.5 py-1 rounded-md font-semibold transition-all flex items-center space-x-1 border ${
                          active
                            ? 'bg-blue-600/30 border-blue-500 text-blue-200'
                            : 'bg-slate-900 border-slate-800 text-slate-400'
                        }`}
                      >
                        {active && <Check className="w-3 h-3 text-blue-400" />}
                        <span>{exam}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Email Address</label>
            <input
              type="email"
              required
              placeholder="student@exam.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full glass-input text-xs"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Password</label>
            <input
              type="password"
              required
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full glass-input text-xs"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs tracking-wider uppercase shadow-lg shadow-blue-600/30 transition-all disabled:opacity-50"
          >
            {loading ? 'Processing...' : isLogin ? 'SIGN IN TO DASHBOARD' : 'CREATE ASPIRANT ACCOUNT'}
          </button>
        </form>

        <div className="mt-6 text-center">
          <button
            onClick={() => { setIsLogin(!isLogin); setError(''); }}
            className="text-xs text-blue-400 hover:underline font-semibold"
          >
            {isLogin ? "Don't have an account? Register here" : 'Already registered? Sign in'}
          </button>
        </div>

      </div>
    </div>
  );
};
