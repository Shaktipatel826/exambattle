import React, { useState, useEffect } from 'react';
import { 
  Shield, UploadCloud, Cpu, AlertTriangle, BookOpen, Users, CheckCircle2, XCircle, Plus, Search, Filter, Edit3, Trash2, History, Copy, Layers, FileText, RefreshCw, Check, Sparkles
} from 'lucide-react';
import { ContentManagementTab } from '../components/ContentManagementTab';

export const AdminDashboard = ({ token, activeTab, setActiveTab }) => {
  const [activeSubTab, setActiveSubTab] = useState('BANK'); // BANK | CONTENT | APPROVALS | MANUAL | IMPORT | AI_GEN | REPORTS | STATS
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

  // Report Queue State
  const [reports, setReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(false);

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

  // AI Generator Engine State
  const [aiForm, setAiForm] = useState({
    subject: 'Indian Polity',
    topic: 'President & Vice President',
    exam: 'SSC CGL',
    difficulty: 'Medium',
    count: 5,
    generationType: 'ALL',
    pastedText: ''
  });
  const [importFile, setImportFile] = useState(null);
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiJobResult, setAiJobResult] = useState(null);

  // Bulk Import File State
  const [bulkImportFile, setBulkImportFile] = useState(null);
  const [importSummary, setImportSummary] = useState(null);
  const [autoPublishImport, setAutoPublishImport] = useState(false);

  // Sync activeTab prop from App.jsx header navigation
  useEffect(() => {
    if (!activeTab) return;
    if (activeTab === 'ADMIN_QUESTIONS') setActiveSubTab('BANK');
    else if (activeTab === 'ADMIN_IMPORT') setActiveSubTab('IMPORT');
    else if (activeTab === 'ADMIN_AI_GEN') setActiveSubTab('AI_GEN');
    else if (activeTab === 'ADMIN_REPORTS') setActiveSubTab('REPORTS');
    else if (activeTab === 'ADMIN_CONTENT') setActiveSubTab('CONTENT');
    else if (activeTab === 'ADMIN_APPROVALS') setActiveSubTab('APPROVALS');
    else if (activeTab === 'ADMIN_MANUAL') setActiveSubTab('MANUAL');
    else if (activeTab === 'ADMIN_STATS') setActiveSubTab('STATS');
    else if (activeTab === 'ADMIN_DASH') setActiveSubTab('BANK');
  }, [activeTab]);

  useEffect(() => {
    fetchStats();
    fetchPendingQuestions();
  }, []);

  useEffect(() => {
    if (activeSubTab === 'BANK') {
      fetchQuestions();
    } else if (activeSubTab === 'REPORTS') {
      fetchReports();
    }
  }, [activeSubTab, page, filters]);

  const handleSubTabChange = (subId) => {
    setActiveSubTab(subId);
    setPage(1);
    if (setActiveTab) {
      if (subId === 'BANK') setActiveTab('ADMIN_QUESTIONS');
      else if (subId === 'IMPORT') setActiveTab('ADMIN_IMPORT');
      else if (subId === 'AI_GEN') setActiveTab('ADMIN_AI_GEN');
      else if (subId === 'REPORTS') setActiveTab('ADMIN_REPORTS');
      else if (subId === 'CONTENT') setActiveTab('ADMIN_CONTENT');
      else if (subId === 'APPROVALS') setActiveTab('ADMIN_APPROVALS');
      else if (subId === 'MANUAL') setActiveTab('ADMIN_MANUAL');
      else if (subId === 'STATS') setActiveTab('ADMIN_STATS');
    }
  };

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

  const fetchReports = async () => {
    setLoadingReports(true);
    try {
      const res = await fetch('/api/admin/reports', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setReports(data.reports || []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingReports(false);
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
        fetchPendingQuestions();
        fetchStats();
      }
    } catch (e) {
      alert('Delete error');
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

  const handleAIGenerateJobSubmit = async (e) => {
    e.preventDefault();
    if (!importFile && (!aiForm.pastedText || !aiForm.pastedText.trim())) {
      return alert('Please select a PDF/TXT/DOCX file OR paste study material / lecture transcript text.');
    }

    setIsGeneratingAI(true);
    setAiJobResult(null);

    const formData = new FormData();
    if (importFile) formData.append('file', importFile);
    if (aiForm.pastedText) formData.append('pastedText', aiForm.pastedText);
    formData.append('generationType', aiForm.generationType || 'ALL');
    formData.append('subject', aiForm.subject || 'General Studies');
    formData.append('topic', aiForm.topic || 'General');
    formData.append('exam', aiForm.exam || 'SSC CGL');
    formData.append('difficulty', aiForm.difficulty || 'Medium');
    formData.append('mcqCount', aiForm.count || 5);

    try {
      const res = await fetch('/api/ai/admin-generate-job', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setAiJobResult(data.job);
        fetchStats();
        fetchPendingQuestions();
      } else {
        alert(data.message || 'AI Generation error');
      }
    } catch (err) {
      alert('AI Job execution error: ' + err.message);
    } finally {
      setIsGeneratingAI(false);
    }
  };

  const handleBulkImportSubmit = async (e) => {
    e.preventDefault();
    if (!bulkImportFile) return alert('Select a CSV or JSON file to import');
    
    const formData = new FormData();
    formData.append('file', bulkImportFile);
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header Banner */}
      <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-[#244A73] flex items-center justify-center text-white shadow-sm shrink-0">
            <Shield className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-black text-[#252525]">ADMIN CONTROL DASHBOARD</h1>
            <p className="text-xs text-[#66635D] font-medium">Question Bank, Review Queue, Gemini AI Engine, Bulk Imports, & Storage Pipeline.</p>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <span className="px-3 py-1 bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] rounded-lg text-xs font-bold">
            Authenticated Admin
          </span>
        </div>
      </div>

      {/* Admin Sub-Navigation Tabs */}
      <div className="flex flex-wrap gap-2 border-b border-[#E2DACB] pb-3">
        {[
          { id: 'BANK', label: `Question Bank (${totalQuestions || stats?.totalQuestions || 0})`, icon: BookOpen },
          { id: 'CONTENT', label: 'Content Taxonomy', icon: Layers },
          { id: 'APPROVALS', label: `Pending Reviews (${stats?.pendingReviews || pendingQuestions.length || 0})`, icon: CheckCircle2 },
          { id: 'MANUAL', label: 'Manual Entry', icon: Plus },
          { id: 'IMPORT', label: 'Bulk Import', icon: UploadCloud },
          { id: 'AI_GEN', label: 'AI Generator', icon: Cpu },
          { id: 'REPORTS', label: `Report Queue (${stats?.totalReports || reports.length || 0})`, icon: AlertTriangle },
          { id: 'STATS', label: 'System Stats', icon: Shield }
        ].map(sub => {
          const Icon = sub.icon;
          const active = activeSubTab === sub.id;
          return (
            <button
              key={sub.id}
              onClick={() => handleSubTabChange(sub.id)}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 border ${
                active
                  ? 'bg-[#244A73] text-white border-[#1B3857] shadow-sm'
                  : 'bg-[#FFFDF8] border-[#E2DACB] text-[#66635D] hover:text-[#252525] hover:bg-[#F7F3EA]'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{sub.label}</span>
            </button>
          );
        })}
      </div>

      {/* 0. CONTENT MANAGEMENT TAXONOMY */}
      {activeSubTab === 'CONTENT' && (
        <ContentManagementTab token={token} />
      )}

      {/* 1. QUESTION BANK BROWSER */}
      {activeSubTab === 'BANK' && (
        <div className="space-y-4">
          
          {/* Filters Bar */}
          <div className="bg-[#FFFDF8] p-4 rounded-2xl border border-[#E2DACB] shadow-sm grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
            <div>
              <label className="block text-[#66635D] mb-1 font-bold">Search Statements</label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search question statement..."
                  value={filters.search}
                  onChange={e => setFilters({ ...filters, search: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl pl-8 pr-3 py-2 text-[#252525] focus:outline-none focus:border-[#244A73]"
                />
                <Search className="w-4 h-4 text-[#66635D] absolute left-2.5 top-2.5" />
              </div>
            </div>

            <div>
              <label className="block text-[#66635D] mb-1 font-bold">Status Filter</label>
              <select
                value={filters.status}
                onChange={e => setFilters({ ...filters, status: e.target.value })}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525] focus:outline-none focus:border-[#244A73]"
              >
                <option value="ALL">All Statuses</option>
                <option value="PUBLISHED">Published</option>
                <option value="PENDING_REVIEW">Pending Review</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            <div>
              <label className="block text-[#66635D] mb-1 font-bold">Difficulty Filter</label>
              <select
                value={filters.difficulty}
                onChange={e => setFilters({ ...filters, difficulty: e.target.value })}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525] focus:outline-none focus:border-[#244A73]"
              >
                <option value="All">All Difficulties</option>
                <option value="Easy">Easy</option>
                <option value="Medium">Medium</option>
                <option value="Hard">Hard</option>
              </select>
            </div>

            <div>
              <label className="block text-[#66635D] mb-1 font-bold">Source Type</label>
              <select
                value={filters.sourceType}
                onChange={e => setFilters({ ...filters, sourceType: e.target.value })}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525] focus:outline-none focus:border-[#244A73]"
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
            <div className="bg-[#FFFDF8] p-8 text-center text-[#66635D] text-xs font-bold rounded-2xl border border-[#E2DACB]">
              Loading question bank...
            </div>
          ) : questions.length === 0 ? (
            <div className="bg-[#FFFDF8] p-8 text-center text-[#66635D] text-xs font-bold rounded-2xl border border-[#E2DACB]">
              No questions matched the selected filters.
            </div>
          ) : (
            <div className="space-y-3">
              {questions.map(q => (
                <div key={q._id} className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm flex flex-col md:flex-row justify-between items-start text-xs space-y-3 md:space-y-0 gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded ${
                        q.status === 'PUBLISHED' ? 'bg-[#D1FAE5] text-[#065F46] border border-[#10B981]' :
                        q.status === 'PENDING_REVIEW' ? 'bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]' :
                        'bg-[#FEE2E2] text-[#991B1B] border border-[#EF4444]'
                      }`}>
                        {q.status}
                      </span>
                      <span className="bg-[#EFE9DC] text-[#244A73] text-[10px] font-bold px-2 py-0.5 rounded border border-[#D5CDBF]">
                        {q.sourceType}
                      </span>
                      <span className="bg-[#F7F3EA] text-[#66635D] text-[10px] font-bold px-2 py-0.5 rounded border border-[#E2DACB]">
                        {q.subject} • {q.topic}
                      </span>
                      {q.duplicateFlag && (
                        <span className="bg-[#FEF3C7] text-[#B45309] border border-[#F59E0B]/30 text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3 text-[#B45309]" /> Duplicate Warning
                        </span>
                      )}
                      {q.versionHistory && q.versionHistory.length > 0 && (
                        <span className="bg-[#EFE9DC] text-[#244A73] border border-[#D5CDBF] text-[10px] px-2 py-0.5 rounded font-bold flex items-center gap-1">
                          <History className="w-3 h-3 text-[#244A73]" /> {q.versionHistory.length} Edits
                        </span>
                      )}
                    </div>

                    <p className="font-extrabold text-[#252525] text-sm leading-relaxed opacity-100">{q.question}</p>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#252525]">
                      {q.options.map((opt, idx) => (
                        <div key={idx} className={`p-2.5 rounded-lg border text-xs ${idx === q.correctAnswer ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] font-bold' : 'bg-[#F7F3EA] border-[#E2DACB]'}`}>
                          <strong className="mr-1.5">{String.fromCharCode(65 + idx)}:</strong> {opt}
                        </div>
                      ))}
                    </div>

                    {q.explanation && (
                      <p className="text-[#66635D] text-[11px] italic bg-[#F7F3EA] p-2.5 rounded-xl border border-[#E2DACB]">
                        <strong className="text-[#244A73] not-italic mr-1">Explanation:</strong> {q.explanation}
                      </p>
                    )}
                  </div>

                  <div className="flex sm:flex-col gap-2 shrink-0">
                    <button
                      onClick={() => setEditingQuestion({ ...q })}
                      className="px-3 py-1.5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm"
                    >
                      <Edit3 className="w-3 h-3" /> Edit
                    </button>
                    {q.status !== 'PUBLISHED' && (
                      <button
                        onClick={() => handleUpdateStatus(q._id, 'PUBLISHED', true)}
                        className="px-3 py-1.5 rounded-xl bg-[#2D6A4F] hover:bg-[#1B4332] text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm"
                      >
                        <CheckCircle2 className="w-3 h-3" /> Approve
                      </button>
                    )}
                    {q.status !== 'REJECTED' && (
                      <button
                        onClick={() => handleUpdateStatus(q._id, 'REJECTED', false)}
                        className="px-3 py-1.5 rounded-xl bg-[#B45309] hover:bg-[#92400E] text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm"
                      >
                        <XCircle className="w-3 h-3" /> Reject
                      </button>
                    )}
                    <button
                      onClick={() => handleDeleteQuestion(q._id)}
                      className="px-3 py-1.5 rounded-xl bg-[#9E2A2B] hover:bg-[#7E2223] text-white font-bold text-[11px] flex items-center justify-center gap-1 shadow-sm"
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
            <div className="flex justify-between items-center text-xs text-[#66635D] font-bold pt-2">
              <span>Page {page} of {totalPages} ({totalQuestions} questions total)</span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                  className="px-3 py-1 rounded-xl bg-[#FFFDF8] border border-[#E2DACB] text-[#252525] disabled:opacity-40"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(page + 1)}
                  className="px-3 py-1 rounded-xl bg-[#FFFDF8] border border-[#E2DACB] text-[#252525] disabled:opacity-40"
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
          <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#B45309]" /> Pending Admin Review Queue ({pendingQuestions.length})
          </h2>
          {pendingQuestions.length === 0 ? (
            <div className="bg-[#FFFDF8] p-8 text-center text-[#66635D] text-xs font-bold rounded-2xl border border-[#E2DACB]">
              No pending questions awaiting review.
            </div>
          ) : (
            pendingQuestions.map(q => (
              <div key={q._id} className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row justify-between items-start gap-2">
                  <div className="space-y-1">
                    <span className="bg-[#FEF3C7] text-[#B45309] text-[10px] px-2.5 py-0.5 rounded font-bold border border-[#F59E0B]">{q.sourceType}</span>
                    <span className="ml-2 text-[#66635D] text-[10px] font-bold">{q.subject} • {q.topic}</span>
                    <p className="font-extrabold text-[#252525] text-sm mt-1 opacity-100">{q.question}</p>
                  </div>
                  <div className="flex space-x-2 shrink-0">
                    <button
                      onClick={() => setEditingQuestion({ ...q })}
                      className="px-3 py-1.5 rounded-xl bg-[#244A73] text-white font-bold text-xs"
                    >
                      Review & Edit
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(q._id, 'PUBLISHED', true)}
                      className="px-3 py-1.5 rounded-xl bg-[#2D6A4F] text-white font-bold text-xs"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => handleUpdateStatus(q._id, 'REJECTED', false)}
                      className="px-3 py-1.5 rounded-xl bg-[#9E2A2B] text-white font-bold text-xs"
                    >
                      Reject
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#252525]">
                  {q.options.map((opt, i) => (
                    <div key={i} className={`p-2.5 rounded-lg border text-xs ${i === q.correctAnswer ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] font-bold' : 'bg-[#F7F3EA] border-[#E2DACB]'}`}>
                      <strong className="mr-1">{String.fromCharCode(65 + i)}:</strong> {opt}
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
        <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4 max-w-3xl">
          <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
            <Plus className="w-4 h-4 text-[#244A73]" /> Manual Question Entry Form
          </h2>

          <form onSubmit={handleManualSave} className="space-y-4 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-[#252525] mb-1 font-bold">Subject</label>
                <input
                  type="text"
                  value={manualForm.subject}
                  onChange={e => setManualForm({ ...manualForm, subject: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                />
              </div>
              <div>
                <label className="block text-[#252525] mb-1 font-bold">Topic</label>
                <input
                  type="text"
                  value={manualForm.topic}
                  onChange={e => setManualForm({ ...manualForm, topic: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                />
              </div>
              <div>
                <label className="block text-[#252525] mb-1 font-bold">Exam</label>
                <input
                  type="text"
                  value={manualForm.exam}
                  onChange={e => setManualForm({ ...manualForm, exam: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                />
              </div>
            </div>

            <div>
              <label className="block text-[#252525] mb-1 font-bold">Question Text</label>
              <textarea
                rows="3"
                required
                value={manualForm.question}
                onChange={e => {
                  setManualForm({ ...manualForm, question: e.target.value });
                  checkDuplicate(e.target.value);
                }}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-3 text-[#252525]"
                placeholder="Enter MCQ question statement..."
              ></textarea>
              
              {duplicateWarning && (
                <div className="mt-2 p-3 bg-[#FEF3C7] border border-[#F59E0B] rounded-xl text-[#B45309] space-y-1">
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <AlertTriangle className="w-4 h-4 text-[#B45309]" /> Duplicate Question Detected!
                  </div>
                  <p className="text-[11px]">Similar question found: "{duplicateWarning[0]?.question}"</p>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {manualForm.options.map((opt, i) => (
                <div key={i}>
                  <label className="block text-[#252525] mb-1 font-bold">Option {String.fromCharCode(65 + i)}</label>
                  <input
                    type="text"
                    required
                    value={opt}
                    onChange={e => {
                      const newOpts = [...manualForm.options];
                      newOpts[i] = e.target.value;
                      setManualForm({ ...manualForm, options: newOpts });
                    }}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[#252525] mb-1 font-bold">Correct Answer</label>
                <select
                  value={manualForm.correctAnswer}
                  onChange={e => setManualForm({ ...manualForm, correctAnswer: Number(e.target.value) })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                >
                  <option value={0}>Option A</option>
                  <option value={1}>Option B</option>
                  <option value={2}>Option C</option>
                  <option value={3}>Option D</option>
                </select>
              </div>

              <div>
                <label className="block text-[#252525] mb-1 font-bold">Difficulty</label>
                <select
                  value={manualForm.difficulty}
                  onChange={e => setManualForm({ ...manualForm, difficulty: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                >
                  <option value="Easy">Easy</option>
                  <option value="Medium">Medium</option>
                  <option value="Hard">Hard</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-[#252525] mb-1 font-bold">Explanation</label>
              <textarea
                rows="2"
                value={manualForm.explanation}
                onChange={e => setManualForm({ ...manualForm, explanation: e.target.value })}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-3 text-[#252525]"
                placeholder="Explain why the answer is correct..."
              ></textarea>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold uppercase tracking-wider shadow-sm"
            >
              PUBLISH TO QUESTION BANK
            </button>
          </form>
        </div>
      )}

      {/* 4. BULK IMPORT */}
      {activeSubTab === 'IMPORT' && (
        <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4 max-w-2xl text-xs">
          <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
            <UploadCloud className="w-4 h-4 text-[#244A73]" /> Bulk Import Question Papers (CSV / JSON)
          </h2>

          <form onSubmit={handleBulkImportSubmit} className="space-y-4">
            <div>
              <label className="block text-[#252525] mb-1 font-bold">Select CSV or JSON File</label>
              <input
                type="file"
                accept=".csv, .json"
                onChange={e => setBulkImportFile(e.target.files[0])}
                className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-2 text-xs text-[#252525]"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="autoPublish"
                checked={autoPublishImport}
                onChange={e => setAutoPublishImport(e.target.checked)}
                className="rounded border-[#E2DACB]"
              />
              <label htmlFor="autoPublish" className="text-[#252525] font-semibold">
                Auto-publish imported questions (Skip Pending Review queue)
              </label>
            </div>

            <button
              type="submit"
              className="w-full py-3 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-extrabold text-xs uppercase tracking-wider shadow-sm"
            >
              RUN BULK IMPORT & DUPLICATE CHECK
            </button>
          </form>

          {importSummary && (
            <div className="p-4 rounded-xl bg-[#F7F3EA] border border-[#E2DACB] text-xs space-y-2 text-[#252525]">
              <h3 className="font-bold text-[#2D6A4F]">Bulk Import Summary:</h3>
              <p>Total Questions Found: <span className="font-bold text-[#244A73]">{importSummary.totalFound}</span></p>
              <p>Valid Questions Imported: <span className="font-bold text-[#2D6A4F]">{importSummary.valid}</span></p>
              <p>Duplicates Flagged: <span className="font-bold text-[#B45309]">{importSummary.duplicates}</span></p>
              <p>Queued for Review: <span className="font-bold text-[#244A73]">{importSummary.needReview}</span></p>
            </div>
          )}
        </div>
      )}

      {/* 5. AI GENERATOR ENGINE */}
      {activeSubTab === 'AI_GEN' && (
        <div className="space-y-6 text-xs">
          
          {/* Generator Input Form */}
          <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm space-y-4 max-w-3xl">
            <div className="flex items-center justify-between border-b border-[#E2DACB] pb-3">
              <h2 className="text-sm font-extrabold text-[#252525] flex items-center gap-2">
                <Cpu className="w-5 h-5 text-[#244A73]" /> Gemini AI Study & Question Generation Engine
              </h2>
              <span className="bg-[#EFE9DC] text-[#244A73] px-2.5 py-0.5 rounded text-[10px] font-bold border border-[#D5CDBF]">
                gemini-3.8-flash
              </span>
            </div>

            <form onSubmit={handleAIGenerateJobSubmit} className="space-y-4">
              
              <div>
                <label className="block text-[#252525] mb-1 font-bold">1. Attach Document File (PDF, TXT, DOCX, CSV)</label>
                <input
                  type="file"
                  onChange={e => setImportFile(e.target.files[0])}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-2 text-xs text-[#252525]"
                />
              </div>

              <div>
                <label className="block text-[#252525] mb-1 font-bold">2. Or Paste Lecture Transcript / Study Content</label>
                <textarea
                  rows="4"
                  value={aiForm.pastedText || ''}
                  onChange={e => setAiForm({ ...aiForm, pastedText: e.target.value })}
                  placeholder="Paste lecture notes, study chapter text, or video transcript..."
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-3 text-[#252525]"
                ></textarea>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Generation Output Type</label>
                  <select
                    value={aiForm.generationType || 'ALL'}
                    onChange={e => setAiForm({ ...aiForm, generationType: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  >
                    <option value="ALL">All (MCQs + One-Liners + Study Notes)</option>
                    <option value="MCQS">MCQs Only</option>
                    <option value="ONE_LINERS">One-Liner Notes Only</option>
                    <option value="STUDY_NOTES">Detailed Study Notes Only</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Target Exam</label>
                  <select
                    value={aiForm.exam || 'SSC CGL'}
                    onChange={e => setAiForm({ ...aiForm, exam: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  >
                    <option value="SSC CGL">SSC CGL / CHSL</option>
                    <option value="RRB NTPC">RRB NTPC / Railway ALP</option>
                    <option value="SBI PO">Banking (SBI PO / IBPS)</option>
                    <option value="UP Police">UP Police / UPSI / Lekhpal</option>
                    <option value="General State Exam">General State Exams</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Subject</label>
                  <input
                    type="text"
                    value={aiForm.subject}
                    onChange={e => setAiForm({ ...aiForm, subject: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Topic</label>
                  <input
                    type="text"
                    value={aiForm.topic}
                    onChange={e => setAiForm({ ...aiForm, topic: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">MCQ Count per Chunk</label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={aiForm.count}
                    onChange={e => setAiForm({ ...aiForm, count: Number(e.target.value) })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={isGeneratingAI}
                className="w-full py-3.5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] disabled:opacity-50 text-white font-extrabold text-xs uppercase tracking-wider shadow-sm flex items-center justify-center gap-2"
              >
                {isGeneratingAI ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-amber-300" />
                    <span>Gemini AI Analyzing Source Content & Generating Questions...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-amber-300" />
                    <span>RUN GEMINI CHUNKING & QUESTION GENERATION PIPELINE</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* AI Generation Output Preview Section */}
          {aiJobResult && (
            <div className="space-y-6">
              
              {/* Job Summary Banner */}
              <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-2">
                <div className="flex items-center justify-between border-b border-[#E2DACB] pb-2">
                  <h3 className="font-extrabold text-sm text-[#244A73] flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-[#2D6A4F]" /> AI Job Completed & Queued for Pending Review
                  </h3>
                  <span className="text-[11px] font-mono text-[#66635D] font-bold">Job ID: {aiJobResult.jobId}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center pt-2">
                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB]">
                    <span className="block text-[10px] text-[#66635D] font-bold">MCQs GENERATED</span>
                    <span className="text-lg font-black text-[#244A73]">{aiJobResult.generatedMcqCount || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB]">
                    <span className="block text-[10px] text-[#66635D] font-bold">ONE-LINERS</span>
                    <span className="text-lg font-black text-[#2D6A4F]">{aiJobResult.generatedOneLinersCount || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB]">
                    <span className="block text-[10px] text-[#66635D] font-bold">DUPLICATES FLAGGED</span>
                    <span className="text-lg font-black text-[#B45309]">{aiJobResult.duplicateCount || 0}</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F3EA] border border-[#E2DACB]">
                    <span className="block text-[10px] text-[#66635D] font-bold">REVIEW STATUS</span>
                    <span className="text-xs font-black text-[#B45309] block mt-1">PENDING_REVIEW</span>
                  </div>
                </div>
              </div>

              {/* Generated MCQs Preview */}
              {aiJobResult.generatedMcqs && aiJobResult.generatedMcqs.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-[#252525] flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#244A73]" /> Generated MCQs ({aiJobResult.generatedMcqs.length}) — Pending Admin Review
                  </h3>
                  {aiJobResult.generatedMcqs.map((q, idx) => (
                    <div key={idx} className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-3 text-xs">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <span className="bg-[#FEF3C7] text-[#B45309] text-[10px] px-2.5 py-0.5 rounded font-bold border border-[#F59E0B]">PENDING_REVIEW</span>
                          <span className="ml-2 text-[#66635D] text-[10px] font-bold">{q.subject} • {q.topic}</span>
                          {q.duplicateFlag && (
                            <span className="ml-2 bg-[#FEF3C7] text-[#B45309] text-[10px] px-2 py-0.5 rounded font-bold border border-[#F59E0B]">
                              Duplicate Match
                            </span>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleUpdateStatus(q.questionId, 'PUBLISHED', true)}
                            className="px-3 py-1.5 rounded-xl bg-[#2D6A4F] text-white font-bold text-xs"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(q.questionId, 'REJECTED', false)}
                            className="px-3 py-1.5 rounded-xl bg-[#9E2A2B] text-white font-bold text-xs"
                          >
                            Reject
                          </button>
                        </div>
                      </div>

                      <p className="font-extrabold text-[#252525] text-sm opacity-100">{q.question}</p>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[#252525]">
                        {q.options.map((opt, oIdx) => (
                          <div key={oIdx} className={`p-2.5 rounded-lg border text-xs ${oIdx === q.correctAnswer ? 'bg-[#D1FAE5] border-[#10B981] text-[#065F46] font-bold' : 'bg-[#F7F3EA] border-[#E2DACB]'}`}>
                            <strong className="mr-1">{String.fromCharCode(65 + oIdx)}:</strong> {opt}
                          </div>
                        ))}
                      </div>

                      {q.explanation && (
                        <p className="text-[#66635D] text-[11px] italic bg-[#F7F3EA] p-2.5 rounded-xl border border-[#E2DACB]">
                          <strong className="text-[#244A73] not-italic mr-1">Explanation:</strong> {q.explanation}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {/* Generated One-Liners Preview */}
              {aiJobResult.oneLiners && aiJobResult.oneLiners.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-extrabold text-sm text-[#252525]">Generated One-Liner Facts ({aiJobResult.oneLiners.length})</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {aiJobResult.oneLiners.map((ol, idx) => (
                      <div key={idx} className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm space-y-1">
                        <span className="bg-[#EFE9DC] text-[#244A73] text-[10px] font-bold px-2 py-0.5 rounded border border-[#D5CDBF]">
                          {ol.topic || 'Fact'}
                        </span>
                        <p className="font-extrabold text-[#252525] text-xs leading-relaxed">{ol.text || ol.question}</p>
                        {ol.answer && <p className="text-[#2D6A4F] text-[11px] font-bold">Ans: {ol.answer}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Generated Study Notes Preview */}
              {aiJobResult.studyNotes && (
                <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-3">
                  <h3 className="font-extrabold text-sm text-[#244A73]">Generated Concept Study Notes</h3>
                  <p className="text-[#252525] text-xs font-bold">{aiJobResult.studyNotes.title || 'Study Summary'}</p>
                  <p className="text-[#66635D] text-xs">{aiJobResult.studyNotes.overview || aiJobResult.studyNotes.summary}</p>
                </div>
              )}

            </div>
          )}

        </div>
      )}

      {/* 6. REPORT QUEUE */}
      {activeSubTab === 'REPORTS' && (
        <div className="space-y-4 text-xs">
          <div className="flex justify-between items-center">
            <h2 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#B45309]" /> Question Reports Queue ({reports.length})
            </h2>
            <button
              onClick={fetchReports}
              className="px-3 py-1.5 rounded-xl bg-[#FFFDF8] border border-[#E2DACB] text-[#244A73] font-bold text-xs"
            >
              Refresh Queue
            </button>
          </div>

          {loadingReports ? (
            <div className="bg-[#FFFDF8] p-8 text-center text-[#66635D] font-bold rounded-2xl border border-[#E2DACB]">
              Loading user reports...
            </div>
          ) : reports.length === 0 ? (
            <div className="bg-[#FFFDF8] p-8 text-center text-[#66635D] font-bold rounded-2xl border border-[#E2DACB]">
              No question reports submitted by students.
            </div>
          ) : (
            <div className="space-y-3">
              {reports.map((rep) => (
                <div key={rep._id} className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm space-y-2">
                  <div className="flex justify-between items-start">
                    <div className="space-y-1">
                      <span className="bg-[#FEF3C7] text-[#B45309] text-[10px] px-2.5 py-0.5 rounded font-bold border border-[#F59E0B]">
                        Reason: {rep.reason || 'Issue Reported'}
                      </span>
                      <span className="ml-2 text-[#66635D] text-[10px] font-bold">
                        Reported by: {rep.userName || 'Student'} on {new Date(rep.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                    <span className="bg-[#EFE9DC] text-[#244A73] text-[10px] px-2 py-0.5 rounded font-bold border border-[#D5CDBF]">
                      {rep.status || 'PENDING'}
                    </span>
                  </div>

                  {rep.comments && (
                    <p className="text-[#252525] font-semibold text-xs bg-[#F7F3EA] p-2.5 rounded-xl border border-[#E2DACB]">
                      Comments: "{rep.comments}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* 7. STATS OVERVIEW */}
      {activeSubTab === 'STATS' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm">
            <span className="text-[10px] text-[#66635D] font-bold block uppercase">Total Questions</span>
            <span className="text-2xl font-black text-[#252525]">{stats?.totalQuestions || 0}</span>
          </div>
          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm">
            <span className="text-[10px] text-[#66635D] font-bold block uppercase">Verified PYQs</span>
            <span className="text-2xl font-black text-[#2D6A4F]">{stats?.pyqQuestions || 0}</span>
          </div>
          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm">
            <span className="text-[10px] text-[#66635D] font-bold block uppercase">Pending Reviews</span>
            <span className="text-2xl font-black text-[#B45309]">{stats?.pendingReviews || 0}</span>
          </div>
          <div className="bg-[#FFFDF8] p-5 rounded-2xl border border-[#E2DACB] shadow-sm">
            <span className="text-[10px] text-[#66635D] font-bold block uppercase">Total Users</span>
            <span className="text-2xl font-black text-[#244A73]">{stats?.totalUsers || 0}</span>
          </div>
        </div>
      )}

      {/* EDIT QUESTION MODAL */}
      {editingQuestion && (
        <div className="fixed inset-0 z-50 bg-[#252525]/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] max-w-2xl w-full max-h-[90vh] overflow-y-auto space-y-4 text-xs shadow-xl">
            <div className="flex justify-between items-center border-b border-[#E2DACB] pb-3">
              <h3 className="text-sm font-bold text-[#252525] flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-[#244A73]" /> Edit Question & Audit Version History
              </h3>
              <button
                onClick={() => setEditingQuestion(null)}
                className="text-[#66635D] hover:text-[#252525] font-bold text-base"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Subject</label>
                  <input
                    type="text"
                    value={editingQuestion.subject}
                    onChange={e => setEditingQuestion({ ...editingQuestion, subject: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Topic</label>
                  <input
                    type="text"
                    value={editingQuestion.topic}
                    onChange={e => setEditingQuestion({ ...editingQuestion, topic: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  />
                </div>
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Status</label>
                  <select
                    value={editingQuestion.status}
                    onChange={e => setEditingQuestion({ ...editingQuestion, status: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  >
                    <option value="PUBLISHED">PUBLISHED</option>
                    <option value="PENDING_REVIEW">PENDING_REVIEW</option>
                    <option value="REJECTED">REJECTED</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#252525] mb-1 font-bold">Question Text</label>
                <textarea
                  rows="3"
                  value={editingQuestion.question}
                  onChange={e => setEditingQuestion({ ...editingQuestion, question: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-3 text-[#252525]"
                ></textarea>
              </div>

              <div className="grid grid-cols-2 gap-2">
                {editingQuestion.options.map((opt, i) => (
                  <div key={i}>
                    <label className="block text-[#252525] mb-1 font-bold">Option {String.fromCharCode(65 + i)}</label>
                    <input
                      type="text"
                      value={opt}
                      onChange={e => {
                        const newOpts = [...editingQuestion.options];
                        newOpts[i] = e.target.value;
                        setEditingQuestion({ ...editingQuestion, options: newOpts });
                      }}
                      className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                    />
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Correct Answer</label>
                  <select
                    value={editingQuestion.correctAnswer}
                    onChange={e => setEditingQuestion({ ...editingQuestion, correctAnswer: Number(e.target.value) })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  >
                    <option value={0}>Option A</option>
                    <option value={1}>Option B</option>
                    <option value={2}>Option C</option>
                    <option value={3}>Option D</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[#252525] mb-1 font-bold">Difficulty</label>
                  <select
                    value={editingQuestion.difficulty}
                    onChange={e => setEditingQuestion({ ...editingQuestion, difficulty: e.target.value })}
                    className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl px-3 py-2 text-[#252525]"
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[#252525] mb-1 font-bold">Explanation</label>
                <textarea
                  rows="2"
                  value={editingQuestion.explanation}
                  onChange={e => setEditingQuestion({ ...editingQuestion, explanation: e.target.value })}
                  className="w-full bg-[#F7F3EA] border border-[#E2DACB] rounded-xl p-3 text-[#252525]"
                ></textarea>
              </div>

              {/* Version History Toggle */}
              {editingQuestion.versionHistory && editingQuestion.versionHistory.length > 0 && (
                <div className="border-t border-[#E2DACB] pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs text-[#244A73] font-bold flex items-center gap-1"
                  >
                    <History className="w-3.5 h-3.5" /> {showHistory ? 'Hide Edit Audit Trail' : `View Prior Versions (${editingQuestion.versionHistory.length})`}
                  </button>

                  {showHistory && (
                    <div className="mt-2 space-y-2 max-h-40 overflow-y-auto bg-[#F7F3EA] p-3 rounded-xl border border-[#E2DACB]">
                      {editingQuestion.versionHistory.map((hist, idx) => (
                        <div key={idx} className="border-b border-[#E2DACB] pb-2 text-[11px]">
                          <span className="text-[#66635D] font-bold">Version {idx + 1} - Edited by {hist.editedBy} on {new Date(hist.editedAt).toLocaleString()}</span>
                          <p className="text-[#252525] mt-0.5">"{hist.question}"</p>
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
                  className="flex-1 py-2.5 rounded-xl bg-[#EFE9DC] text-[#252525] font-bold"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-bold"
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
