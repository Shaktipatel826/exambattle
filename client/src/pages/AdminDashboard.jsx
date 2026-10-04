import React, { useState, useEffect } from 'react';
import { 
  Shield, UploadCloud, Cpu, AlertTriangle, BookOpen, Users, CheckCircle2, XCircle, Plus, Search, Filter, Edit3, Trash2, History, Copy, Layers
} from 'lucide-react';
import { ContentManagementTab } from '../components/ContentManagementTab';

export const AdminDashboard = ({ token }) => {
  const [activeSubTab, setActiveSubTab] = useState('BANK'); // STATS | BANK | APPROVALS | MANUAL | IMPORT | AI_GEN
  const [stats, setStats] = useState(null);
  
  // Question Bank State
  const [questions, setQuestions] = useState([]);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [filters, setFilters] = useState({
    subject: 'All',
    topic: 'All',
    exam: 'All',
    difficulty: 'All',
    sourceType: 'All',
    status: 'ALL',
    search: ''
  });
  const [loadingQuestions, setLoadingQuestions] = useState(false);

  // Question Edit Modal State
  const [editingQuestion, setEditingQuestion] = useState(null);
  const [showHistory, setShowHistory] = useState(false);

  // Duplicate Checker State
  const [duplicateWarning, setDuplicateWarning] = useState(null);

  // Pending Approvals Queue State
  const [pendingQuestions, setPendingQuestions] = useState([]);

  // Manual Entry State
  const [manualForm, setManualForm] = useState({
    subject: 'Indian Polity',
    topic: 'Fundamental Rights',
    exam: 'SSC CGL',
    examYear: 2024,
    question: '',
    options: ['', '', '', ''],
    correctAnswer: 0,
    explanation: '',
    difficulty: 'Medium',
    tags: 'polity, static-gk'
  });

  // AI Generator State
  const [aiForm, setAiForm] = useState({
    subject: 'History',
    topic: 'Revolt of 1857',
    difficulty: 'Hard',
    count: 5
  });

  // Bulk Import File State
  const [importFile, setImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [autoPublishImport, setAutoPublishImport] = useState(false);

  useEffect(() => {
    fetchStats();
    fetchPendingQuestions();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'BANK') {
      fetchQuestions();
    }
  }, [activeSubTab, page, filters]);

  const fetchStats = async () => {
    try {
      const res = await fetch('/api/admin/stats', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setStats(data.stats);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const queryParams = new URLSearchParams({
        page,
        limit: 10,
        ...(filters.subject !== 'All' && { subject: filters.subject }),
        ...(filters.topic !== 'All' && { topic: filters.topic }),
        ...(filters.exam !== 'All' && { exam: filters.exam }),
        ...(filters.difficulty !== 'All' && { difficulty: filters.difficulty }),
        ...(filters.sourceType !== 'All' && { sourceType: filters.sourceType }),
        ...(filters.status !== 'ALL' && { status: filters.status }),
        ...(filters.search.trim() !== '' && { search: filters.search.trim() })
      });

      const res = await fetch(`/api/questions?${queryParams.toString()}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions || []);
        setTotalQuestions(data.total || 0);
        setTotalPages(data.totalPages || 1);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingQuestions(false);
    }
  };

  const fetchPendingQuestions = async () => {
    try {
      const res = await fetch('/api/questions?status=PENDING_REVIEW', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setPendingQuestions(data.questions || []);
    } catch (e) {
      console.error(e);
    }
  };

  const checkDuplicate = async (questionText) => {
    if (!questionText || questionText.length < 10) {
      setDuplicateWarning(null);
      return;
    }
    try {
      const res = await fetch('/api/questions/duplicate-check', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ question: questionText })
      });
      const data = await res.json();
      if (data.success && data.isDuplicate) {
        setDuplicateWarning(data.matches);
      } else {
        setDuplicateWarning(null);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleManualSave = async (e) => {
    e.preventDefault();
    try {
      const tagsArray = manualForm.tags ? manualForm.tags.split(',').map(t => t.trim()) : [];
      const res = await fetch('/api/questions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          ...manualForm,
          tags: tagsArray
        })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Question published to question bank!');
        setManualForm({
          subject: 'Indian Polity',
          topic: 'Fundamental Rights',
          exam: 'SSC CGL',
          examYear: 2024,
          question: '',
          options: ['', '', '', ''],
          correctAnswer: 0,
          explanation: '',
          difficulty: 'Medium',
          tags: 'polity, static-gk'
        });
        setDuplicateWarning(null);
        fetchStats();
        if (activeSubTab === 'BANK') fetchQuestions();
      }
    } catch (e) {
      alert('Error creating question');
    }
  };

  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!editingQuestion) return;

    try {
      const res = await fetch(`/api/questions/${editingQuestion._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(editingQuestion)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message || 'Question updated successfully!');
        setEditingQuestion(null);
        fetchQuestions();
        fetchPendingQuestions();
        fetchStats();
      }
    } catch (e) {
      alert('Error updating question');
    }
  };

  const handleDeleteQuestion = async (qId) => {
    if (!window.confirm('Are you sure you want to delete this question?')) return;
    try {
      const res = await fetch(`/api/questions/${qId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchQuestions();
        fetchStats();
      }
    } catch (e) {
      alert('Delete error');
    }
  };

  const handleAIGenerate = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/admin/ai-generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(aiForm)
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        fetchStats();
        fetchPendingQuestions();
      }
    } catch (e) {
      alert('AI Generation error');
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!importFile) return alert('Select a CSV or JSON file to import');
    
    const formData = new FormData();
    formData.append('file', importFile);
    formData.append('autoPublish', autoPublishImport ? 'true' : 'false');
    formData.append('subject', 'General Studies');

    try {
      const res = await fetch('/api/import/bulk-questions', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setImportSummary(data.summary);
        fetchStats();
        fetchPendingQuestions();
      } else {
        alert(data.message || 'Import error');
      }
    } catch (e) {
      alert('Import error');
    }
  };

  const handleUpdateStatus = async (qId, status, verified) => {
    try {
      const res = await fetch(`/api/admin/questions/${qId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ status, verified })
      });
      const data = await res.json();
      if (data.success) {
        fetchPendingQuestions();
        if (activeSubTab === 'BANK') fetchQuestions();
        fetchStats();
      }
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/40 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-300 border border-purple-500/40">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">ADMIN CONTROL DASHBOARD</h1>
            <p className="text-xs text-slate-400">Manage Question Bank, Review Queue, Audit Trails, Bulk Imports, & Storage Pipeline.</p>
          </div>
        </div>
      </div>

      {/* Admin Sub-Navigation */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-3">
        {[
          { id: 'BANK', label: `Question Bank (${totalQuestions || stats?.totalQuestions || 0})`, icon: BookOpen },
          { id: 'CONTENT', label: 'Content Management', icon: Layers },
          { id: 'APPROVALS', label: `Pending Reviews (${stats?.pendingReviews || pendingQuestions.length || 0})`, icon: CheckCircle2 },
          { id: 'MANUAL', label: 'Manual Entry', icon: Plus },
          { id: 'IMPORT', label: 'Bulk Import', icon: UploadCloud },
          { id: 'AI_GEN', label: 'AI Generator', icon: Cpu },
          { id: 'STATS', label: 'System Stats', icon: Shield }
        ].map(sub => {
          const Icon = sub.icon;
          const active = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => {
                setActiveSubTab(sub.id);
                setPage(1);
              }}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                active
                  ? 'bg-purple-600 text-white border-purple-500 shadow-md shadow-purple-600/30'
                  : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* 0. CONTENT MANAGEMENT */}
      {activeSubTab === 'CONTENT' && (
        <ContentManagementTab token={token} />
      )}

      {/* 1. QUESTION BANK BROWSER */}
      {activeSubTab === 'BANK' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="glass-panel p-4 rounded-xl border border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Search</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search question text..."
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                  className="w-full glass-input pl-8"
                />
                <Search className="w-4 h-4 text-slate-500 absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Status</label>
              <select
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full glass-input"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Difficulty</label>
              <select
                value={filters.difficulty}
                onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
                className="w-full glass-input"
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-400 mb-1 font-semibold">Source Type</label>
              <select
                value={filters.sourceType}
                onChange={e => setFilters({ ...filters, sourceType: e.target.value })}
                className="w-full glass-input"
              >
                <option value="All">All Sources</option>
                <option value="ADMIN_CREATED">Admin Created</option>
                <option value="VERIFIED_PYQ">Verified PYQ</option>
                <option value="AI_GENERATED">AI Generated</option>
                <option value="IMPORTED">Imported</option>
                <option value="SOURCE_TRANSCRIPT">Transcript/PDF</option>
              </select>
            </div>
          </div>

          {/* Question List */}
          {loadingQuestions ? (
            <div className="glass-panel p-8 text-center text-slate-400 text-xs">Loading question bank...</div>
          ) : questions.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-400 text-xs">No questions matched the selected filters.</div>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <div key={q._id} className="glass-panel p-4 rounded-xl border border-slate-800 flex justify-between items-start text-xs space-y-2 gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        q.status === 'PUBLISHED' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                        q.status === 'PENDING_REVIEW' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                        'bg-red-950 text-red-400 border border-red-800'
                      }`}>
                        {q.status}
                      </span>
                      <span className="bg-purple-950 text-purple-300 text-[10px] font-bold px-2 py-0.5 rounded border border-purple-800">
                        {q.sourceType}
                      </span>
                      <span className="bg-slate-800 text-slate-300 text-[10px] px-2 py-0.5 rounded">
                        {q.subject} • {q.topic}
                      </span>
                      {q.duplicateFlag && (
                        <span className="bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" /> Duplicate Warning
                        </span>
                      )}
                      {q.versionHistory && q.versionHistory.length > 0 && (
                        <span className="bg-blue-500/20 text-blue-300 border border-blue-500/40 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <History className="w-3 h-3" /> {q.versionHistory.length} Edits
                        </span>
                      )}
                    </div>

                    <p className="font-extrabold text-[#252525] text-sm opacity-100">{q.question}</p>

                    <div className="grid grid-cols-2 gap-2 text-slate-300">
                      {q.options.map((opt, idx) => (
                        <div key={idx} className={`p-2 rounded border ${idx === q.correctAnswer ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' : 'bg-slate-900 border-slate-800'}`}>
                          <span className="font-bold mr-1">{String.fromCharCode(65 + idx)}:</span> {opt}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="text-slate-400 text-[11px] italic bg-slate-950 p-2 rounded border border-slate-800">
                        Explanation: {q.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <button
                      onClick={() => setEditingQuestion({ ...q })}
                      className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    {q.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => handleUpdateStatus(q._id, 'PUBLISHED', true)}
                        className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {q.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleUpdateStatus(q._id, 'REJECTED', false)}
                        className="px-3 py-1.5 rounded bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] flex items-center justify-center gap-1"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteQuestion(q._id)}
                      className="px-3 py-1.5 rounded bg-red-900/60 hover:bg-red-800 text-red-200 font-bold text-[11px] flex items-center justify-center gap-1 border border-red-700/50"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-between items-center text-xs text-slate-400 pt-2">
              <span>Page {page} of {totalPages} ({totalQuestions} questions total)</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded bg-slate-900 border border-slate-800 disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 2. PENDING APPROVAL QUEUE */}
      {activeSubTab === 'APPROVALS' && (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-amber-400" /> Pending Admin Review Queue ({pendingQuestions.length})
          </h2>
          {pendingQuestions.length === 0 ? (
            <div className="glass-panel p-8 text-center text-slate-400 text-xs">No pending questions awaiting review.</div>
          ) : (
            pendingQuestions.map(q => (
              <div key={q._id} className="glass-panel p-5 rounded-xl border border-slate-700 space-y-3 text-xs">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <span className="bg-amber-950 text-amber-300 text-[10px] px-2 py-0.5 rounded font-bold border border-amber-800">{q.sourceType}</span>
                    <span className="ml-2 text-slate-400 text-[10px]">{q.subject} • {q.topic}</span>
                    <p className="font-extrabold text-[#252525] text-sm mt-1 opacity-100">{q.question}</p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => setEditingQuestion({ ...q })}
                      className="px-3 py-1.5 rounded bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs"
                    >
                      Review & Edit
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(q._id, 'PUBLISHED', true)}
                      className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(q._id, 'REJECTED', false)}
                      className="px-3 py-1.5 rounded bg-red-600 hover:bg-red-500 text-white font-bold text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-slate-300">
                  {q.options.map((opt, i) => (
                    <div key={i} className={`p-2 rounded border ${i === q.correctAnswer ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200' : 'bg-slate-900 border-slate-800'}`}>
                      <span className="font-bold mr-1">{String.fromCharCode(65 + i)}:</span> {opt}
                    </div>
                  ))}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* 3. MANUAL ENTRY FORM */}
      {activeSubTab === 'MANUAL' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-4 max-w-3xl">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Plus className="w-4 h-4 text-purple-400" /> Manual Question Entry Form
          </h2>

          <form onSubmit={handleManualSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Subject</label>
                <input
                  type="text"
                  value={manualForm.subject}
                  onChange={e => setManualForm({ ...manualForm, subject: e.target.value })}
                  className="w-full glass-input"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Topic</label>
                <input
                  type="text"
                  value={manualForm.topic}
                  onChange={e => setManualForm({ ...manualForm, topic: e.target.value })}
                  className="w-full glass-input"
                />
              </div>
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Exam</label>
                <input
                  type="text"
                  value={manualForm.exam}
                  onChange={e => setManualForm({ ...manualForm, exam: e.target.value })}
                  className="w-full glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Question Text</label>
              <textarea
                rows="3"
                required
                value={manualForm.question}
                onChange={e => {
                  setManualForm({ ...manualForm, question: e.target.value });
                  checkDuplicate(e.target.value);
                }}
                className="w-full glass-input"
                placeholder="Enter MCQ question statement..."
              ></textarea>
              
              {/* Duplicate Warning */}
              {duplicateWarning && (
                <div className="mt-2 p-3 bg-amber-950/80 border border-amber-500/60 rounded-xl text-amber-200 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs text-amber-300">
                    <AlertTriangle className="w-4 h-4 text-amber-400" /> Duplicate Question Detected!
                  </div>
                  <p className="text-[11px]">Similar question found in database: "{duplicateWarning[0]?.question}"</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              {manualForm.options.map((opt, i) => (
                <div key={i}>
                  <label className="block text-slate-300 mb-1 font-semibold">Option {String.fromCharCode(65 + i)}</label>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={e => {
                      const newOpts = [...manualForm.options];
                      newOpts[i] = e.target.value;
                      setManualForm({ ...manualForm, options: newOpts });
                    }}
                    className="w-full glass-input"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Correct Answer</label>
                <select
                  value={manualForm.correctAnswer}
                  onChange={e => setManualForm({ ...manualForm, correctAnswer: Number(e.target.value) })}
                  className="w-full glass-input"
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Difficulty</label>
                <select
                  value={manualForm.difficulty}
                  onChange={e => setManualForm({ ...manualForm, difficulty: e.target.value })}
                  className="w-full glass-input"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Explanation</label>
              <textarea
                rows="2"
                value={manualForm.explanation}
                onChange={e => setManualForm({ ...manualForm, explanation: e.target.value })}
                className="w-full glass-input"
                placeholder="Explain why the answer is correct..."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold uppercase tracking-wider shadow-lg shadow-purple-600/30"
            >
              PUBLISH TO QUESTION BANK
            </button>
          </form>
        </div>
      )}

      {/* 4. BULK IMPORT */}
      {activeSubTab === 'IMPORT' && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-4 max-w-2xl text-xs">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-purple-400" /> Bulk Import Question Papers (CSV, JSON, PDF, TXT)
          </h2>

          <form onSubmit={handleBulkImportSubmit} className="space-y-4">
            <div>
              <label className="block text-slate-300 mb-1 font-semibold">Select CSV or JSON File</label>
              <input
                type="file"
                accept=".csv, .json"
                onChange={e => setImportFile(e.target.files[0])}
                className="w-full glass-input text-xs"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPublish"
                checked={autoPublishImport}
                onChange={e => setAutoPublishImport(e.target.checked)}
                className="rounded border-slate-800"
              />
              <label htmlFor="autoPublish" className="text-slate-300">
                Auto-publish imported questions (Skip Pending Review queue)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider"
            >
              RUN BULK IMPORT & DUPLICATE CHECK
            </button>
          </form>

          {importSummary && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs space-y-2">
              <h3 className="font-bold text-emerald-400">Bulk Import Validation Summary:</h3>
              <p>Total Questions Found: <span className="font-bold text-white">{importSummary.totalFound}</span></p>
              <p>Valid Questions Imported: <span className="font-bold text-emerald-400">{importSummary.valid}</span></p>
              <p>Duplicates Flagged: <span className="font-bold text-amber-400">{importSummary.duplicates}</span></p>
              <p>Queued for Review: <span className="font-bold text-purple-400">{importSummary.needReview}</span></p>
            </div>
          )}
        </div>
      )}

      {/* 5. AI GENERATOR ENGINE */}
      {activeSubTab === 'AI_GEN' && (
        <div className="space-y-6 text-xs">
          <div className="glass-panel p-6 rounded-2xl border border-slate-700/80 space-y-4 max-w-2xl">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <Cpu className="w-4 h-4 text-purple-400" /> Gemini AI Study & Content Generation Engine
            </h2>

            <form onSubmit={async (e) => {
              e.preventDefault();
              const formData = new FormData();
              if (importFile) formData.append('file', importFile);
              if (aiForm.pastedText) formData.append('pastedText', aiForm.pastedText);
              formData.append('generationType', aiForm.generationType || 'ALL');
              formData.append('subject', aiForm.subject);
              formData.append('topic', aiForm.topic);
              formData.append('exam', aiForm.exam || 'SSC CGL');
              formData.append('difficulty', aiForm.difficulty);
              formData.append('mcqCount', aiForm.count);

              try {
                const res = await fetch('/api/ai/admin-generate-job', {
                  method: 'POST',
                  headers: { Authorization: `Bearer ${token}` },
                  body: formData
                });
                const data = await res.json();
                if (data.success) {
                  alert(data.message);
                  fetchStats();
                  fetchPendingQuestions();
                } else {
                  alert(data.message || 'AI Generation error');
                }
              } catch (err) {
                alert('AI Job invocation failed.');
              }
            }} className="space-y-4">
              
              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Attach Document File (PDF, TXT, DOCX, CSV)</label>
                <input
                  type="file"
                  onChange={e => setImportFile(e.target.files[0])}
                  className="w-full glass-input text-xs"
                />
              </div>

              <div>
                <label className="block text-slate-300 mb-1 font-semibold">Or Paste Lecture Transcript / Study Content</label>
                <textarea
                  rows="3"
                  value={aiForm.pastedText || ''}
                  onChange={e => setAiForm({ ...aiForm, pastedText: e.target.value })}
                  placeholder="Paste lecture notes or transcript text..."
                  className="w-full glass-input"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Output Content Types</label>
                  <select
                    value={aiForm.generationType || 'ALL'}
                    onChange={e => setAiForm({ ...aiForm, generationType: e.target.value })}
                    className="w-full glass-input"
                  >
                    <option value="ALL">All (Notes + One-Liners + MCQs + Test)</option>
                    <option value="MCQS">MCQs Only</option>
                    <option value="ONE_LINERS">One-Liner Notes Only</option>
                    <option value="STUDY_NOTES">Detailed Study Notes Only</option>
                    <option value="PRACTICE_TEST">Practice Test Questions Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Target Exam</label>
                  <select
                    value={aiForm.exam || 'SSC CGL'}
                    onChange={e => setAiForm({ ...aiForm, exam: e.target.value })}
                    className="w-full glass-input"
                  >
                    <option value="SSC CGL">SSC CGL / CHSL</option>
                    <option value="RRB NTPC">RRB NTPC / Railway ALP</option>
                    <option value="SBI PO">Banking (SBI PO / IBPS)</option>
                    <option value="UP Police">UP Police / UPSI / Lekhpal</option>
                    <option value="General State Exam">General State Exams</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Subject</label>
                  <input
                    type="text"
                    value={aiForm.subject}
                    onChange={e => setAiForm({ ...aiForm, subject: e.target.value })}
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">Topic</label>
                  <input
                    type="text"
                    value={aiForm.topic}
                    onChange={e => setAiForm({ ...aiForm, topic: e.target.value })}
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1 font-semibold">MCQ Count</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={aiForm.count}
                    onChange={e => setAiForm({ ...aiForm, count: Number(e.target.value) })}
                    className="w-full glass-input"
                  />
                </div>
              </div>

              <button
                type="submit"
                className="w-full py-3.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-purple-600/30 flex items-center justify-center gap-2"
              >
                <Cpu className="w-4 h-4" /> EXECUTE GEMINI CHUNKING & GENERATION PIPELINE
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 6. STATS OVERVIEW */}
      {activeSubTab === 'STATS' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">TOTAL QUESTIONS</span>
            <span className="text-2xl font-black text-white">{stats?.totalQuestions || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">VERIFIED PYQS</span>
            <span className="text-2xl font-black text-emerald-400">{stats?.pyqQuestions || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">PENDING REVIEWS</span>
            <span className="text-2xl font-black text-amber-400">{stats?.pendingReviews || 0}</span>
          </div>
          <div className="glass-panel p-4 rounded-xl border border-slate-800">
            <span className="text-[10px] text-slate-400 font-bold block">TOTAL USERS</span>
            <span className="text-2xl font-black text-purple-400">{stats?.totalUsers || 0}</span>
          </div>
        </div>
      )}

      {/* EDIT QUESTION MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4">
          <div className="glass-panel p-6 rounded-2xl border border-purple-500/40 max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-xs">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-purple-400" /> Edit Question & Review Audit History
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-slate-400 hover:text-white font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Subject</label>
                  <input
                    type="text"
                    value={editingQuestion.subject}
                    onChange={e => setEditingQuestion({ ...editingQuestion, subject: e.target.value })}
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Topic</label>
                  <input
                    type="text"
                    value={editingQuestion.topic}
                    onChange={e => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                    className="w-full glass-input"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Status</label>
                  <select
                    value={editingQuestion.status}
                    onChange={e => setEditingQuestion({ ...editingQuestion, status: e.target.value })}
                    className="w-full glass-input"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Question Text</label>
                <textarea
                  rows="3"
                  value={editingQuestion.question}
                  onChange={e => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  className="w-full glass-input"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {editingQuestion.options.map((opt, i) => (
                  <div key={i}>
                    <label className="block text-slate-400 mb-1 font-semibold">Option {String.fromCharCode(65 + i)}</label>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[i] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                      className="w-full glass-input"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Correct Answer</label>
                  <select
                    value={editingQuestion.correctAnswer}
                    onChange={e => setEditingQuestion({ ...editingQuestion, correctAnswer: Number(e.target.value) })}
                    className="w-full glass-input"
                  >
                    <option value={0}>Option A</option>
                    <option value={1}>Option B</option>
                    <option value={2}>Option C</option>
                    <option value={3}>Option D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-slate-400 mb-1 font-semibold">Difficulty</label>
                  <select
                    value={editingQuestion.difficulty}
                    onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                    className="w-full glass-input"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-slate-400 mb-1 font-semibold">Explanation</label>
                <textarea
                  rows="2"
                  value={editingQuestion.explanation}
                  onChange={e => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  className="w-full glass-input"
                ></textarea>
              </div>

              {/* Version History Toggle */}
              {editingQuestion.versionHistory && editingQuestion.versionHistory.length > 0 && (
                <div className="border-t border-slate-800 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-purple-400 font-bold flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" /> {showHistory ? 'Hide Edit Audit Trail' : `View Prior Versions (${editingQuestion.versionHistory.length})`}
                  </button>

                  {showHistory && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto bg-slate-950 p-3 rounded-xl border border-slate-800">
                      {editingQuestion.versionHistory.map((hist, idx) => (
                        <div key={idx} className="border-b border-slate-900 pb-2 text-[11px]">
                          <span className="text-slate-400 font-bold">Version {idx + 1} - Edited by {hist.editedBy} on {new Date(hist.editedAt).toLocaleString()}</span>
                          <p className="text-slate-200 mt-0.5">"{hist.question}"</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingQuestion(null)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold"
                >
                  Save Changes & Record Audit
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};

