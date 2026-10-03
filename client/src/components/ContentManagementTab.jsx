import React, { useState, useEffect } from 'react';
import { 
  BookOpen, Plus, Search, Edit3, CheckCircle2, XCircle, RefreshCw, FolderPlus, Layers, ListChecks, Award, AlertCircle
} from 'lucide-react';

export const ContentManagementTab = ({ token }) => {
  const [activeTaxonomyTab, setActiveTaxonomyTab] = useState('SUBJECTS'); // SUBJECTS | SUB_SUBJECTS | TOPICS | EXAMS
  
  // Data States
  const [subjects, setSubjects] = useState([]);
  const [subSubjects, setSubSubjects] = useState([]);
  const [topics, setTopics] = useState([]);
  const [exams, setExams] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Modal / Form State
  const [showModal, setShowModal] = useState(false);
  const [editingItem, setEditingItem] = useState(null);

  // Form Field States
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', description: '', icon: 'BookOpen' });
  const [subSubjectForm, setSubSubjectForm] = useState({ subjectId: '', name: '', description: '' });
  const [topicForm, setTopicForm] = useState({ subjectId: '', subSubjectId: '', name: '', description: '' });
  const [examForm, setExamForm] = useState({ name: '', shortName: '', organization: '', category: 'SSC', description: '' });

  useEffect(() => {
    fetchAllData();
  }, []);

  const fetchAllData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [subRes, subSubRes, topRes, exRes] = await Promise.all([
        fetch('/api/admin/subjects', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/sub-subjects', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/topics', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/admin/exams', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      const subData = await subRes.json();
      const subSubData = await subSubRes.json();
      const topData = await topRes.json();
      const exData = await exRes.json();

      if (subData.success) setSubjects(subData.subjects || []);
      if (subSubData.success) setSubSubjects(subSubData.subSubjects || []);
      if (topData.success) setTopics(topData.topics || []);
      if (exData.success) setExams(exData.exams || []);
    } catch (e) {
      setErrorMsg('Failed to load content management data: ' + e.message);
    } finally {
      setLoading(false);
    }
  };

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    setErrorMsg('');
    setSuccessMsg('');
    setSubjectForm({ name: '', code: '', description: '', icon: 'BookOpen' });
    setSubSubjectForm({ subjectId: subjects[0]?._id || '', name: '', description: '' });
    setTopicForm({ subjectId: subjects[0]?._id || '', subSubjectId: '', name: '', description: '' });
    setExamForm({ name: '', shortName: '', organization: '', category: 'SSC', description: '' });
    setShowModal(true);
  };

  const handleOpenEditModal = (item) => {
    setEditingItem(item);
    setErrorMsg('');
    setSuccessMsg('');
    if (activeTaxonomyTab === 'SUBJECTS') {
      setSubjectForm({ name: item.name, code: item.code || '', description: item.description || '', icon: item.icon || 'BookOpen' });
    } else if (activeTaxonomyTab === 'SUB_SUBJECTS') {
      setSubSubjectForm({ subjectId: item.subjectId, name: item.name, description: item.description || '' });
    } else if (activeTaxonomyTab === 'TOPICS') {
      setTopicForm({ subjectId: item.subjectId, subSubjectId: item.subSubjectId || '', name: item.name, description: item.description || '' });
    } else if (activeTaxonomyTab === 'EXAMS') {
      setExamForm({ name: item.name, shortName: item.shortName || '', organization: item.organization || '', category: item.category || 'SSC', description: item.description || '' });
    }
    setShowModal(true);
  };

  const handleToggleActive = async (item) => {
    const newStatus = !item.active;
    const confirmMsg = newStatus ? `Activate "${item.name}"?` : `Deactivate "${item.name}"?`;
    if (!window.confirm(confirmMsg)) return;

    try {
      let endpoint = '';
      if (activeTaxonomyTab === 'SUBJECTS') endpoint = `/api/admin/subjects/${item._id}`;
      else if (activeTaxonomyTab === 'SUB_SUBJECTS') endpoint = `/api/admin/sub-subjects/${item._id}`;
      else if (activeTaxonomyTab === 'TOPICS') endpoint = `/api/admin/topics/${item._id}`;
      else if (activeTaxonomyTab === 'EXAMS') endpoint = `/api/admin/exams/${item._id}`;

      const res = await fetch(endpoint, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ active: newStatus })
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.message);

      setSuccessMsg(`Status updated for "${item.name}"!`);
      fetchAllData();
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    try {
      let endpoint = '';
      let method = editingItem ? 'PUT' : 'POST';
      let payload = {};

      if (activeTaxonomyTab === 'SUBJECTS') {
        endpoint = editingItem ? `/api/admin/subjects/${editingItem._id}` : '/api/admin/subjects';
        payload = subjectForm;
      } else if (activeTaxonomyTab === 'SUB_SUBJECTS') {
        endpoint = editingItem ? `/api/admin/sub-subjects/${editingItem._id}` : '/api/admin/sub-subjects';
        payload = subSubjectForm;
      } else if (activeTaxonomyTab === 'TOPICS') {
        endpoint = editingItem ? `/api/admin/topics/${editingItem._id}` : '/api/admin/topics';
        payload = topicForm;
      } else if (activeTaxonomyTab === 'EXAMS') {
        endpoint = editingItem ? `/api/admin/exams/${editingItem._id}` : '/api/admin/exams';
        payload = examForm;
      }

      const res = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'Operation failed.');
      }

      setSuccessMsg(data.message || 'Saved successfully!');
      setShowModal(false);
      fetchAllData();
    } catch (e) {
      setErrorMsg(e.message);
    }
  };

  // Filter items by search
  const filteredSubjects = subjects.filter(s => s.name.toLowerCase().includes(searchTerm.toLowerCase()) || (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredSubSubjects = subSubjects.filter(ss => ss.name.toLowerCase().includes(searchTerm.toLowerCase()) || (ss.subjectName && ss.subjectName.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredTopics = topics.filter(t => t.name.toLowerCase().includes(searchTerm.toLowerCase()) || (t.subjectName && t.subjectName.toLowerCase().includes(searchTerm.toLowerCase())));
  const filteredExams = exams.filter(ex => ex.name.toLowerCase().includes(searchTerm.toLowerCase()) || (ex.category && ex.category.toLowerCase().includes(searchTerm.toLowerCase())));

  return (
    <div className="space-y-6">
      {/* Header Notification Banners */}
      {errorMsg && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 text-red-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-red-400 hover:text-red-300">✕</button>
        </div>
      )}

      {successMsg && (
        <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 text-emerald-400 text-xs font-semibold flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>{successMsg}</span>
          </div>
          <button onClick={() => setSuccessMsg('')} className="text-emerald-400 hover:text-emerald-300">✕</button>
        </div>
      )}

      {/* Control Bar: Sub-Tabs & Action Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-800/80 p-4 rounded-2xl border border-slate-700/60">
        
        {/* Navigation Tabs */}
        <div className="flex items-center space-x-1 overflow-x-auto pb-2 sm:pb-0 scrollbar-none">
          <button
            onClick={() => { setActiveTaxonomyTab('SUBJECTS'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTaxonomyTab === 'SUBJECTS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <BookOpen className="w-4 h-4" />
            <span>Subjects ({subjects.length})</span>
          </button>

          <button
            onClick={() => { setActiveTaxonomyTab('SUB_SUBJECTS'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTaxonomyTab === 'SUB_SUBJECTS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <FolderPlus className="w-4 h-4" />
            <span>Sub Subjects ({subSubjects.length})</span>
          </button>

          <button
            onClick={() => { setActiveTaxonomyTab('TOPICS'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTaxonomyTab === 'TOPICS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>Topics ({topics.length})</span>
          </button>

          <button
            onClick={() => { setActiveTaxonomyTab('EXAMS'); setSearchTerm(''); }}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center space-x-2 shrink-0 ${
              activeTaxonomyTab === 'EXAMS' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30' : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700/50'
            }`}
          >
            <Award className="w-4 h-4" />
            <span>Exams ({exams.length})</span>
          </button>
        </div>

        {/* Search & Add Action */}
        <div className="flex items-center space-x-3">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              placeholder={`Search ${activeTaxonomyTab.toLowerCase()}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700/80 rounded-xl pl-9 pr-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-blue-500"
            />
          </div>

          <button
            onClick={handleOpenCreateModal}
            className="px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-blue-600/30 transition-all flex items-center space-x-1.5 shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>Add New</span>
          </button>
        </div>
      </div>

      {/* Content Table / Cards Container */}
      <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-slate-400 text-xs font-semibold flex items-center justify-center space-x-2">
            <RefreshCw className="w-4 h-4 animate-spin text-blue-400" />
            <span>Loading Content Management Taxonomy...</span>
          </div>
        ) : (
          <div>
            {/* SUBJECTS TAB */}
            {activeTaxonomyTab === 'SUBJECTS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">Subject Name</th>
                      <th className="p-4">Code</th>
                      <th className="p-4">Description</th>
                      <th className="p-4">Usage (Questions)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredSubjects.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500 italic">No subjects found. Click "Add New" to create one.</td>
                      </tr>
                    ) : (
                      filteredSubjects.map((s) => (
                        <tr key={s._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 font-bold text-slate-100 flex items-center space-x-2">
                            <BookOpen className="w-4 h-4 text-blue-400" />
                            <span>{s.name}</span>
                          </td>
                          <td className="p-4 text-slate-400 font-mono">{s.code || '-'}</td>
                          <td className="p-4 text-slate-400 max-w-xs truncate">{s.description || 'No description'}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-bold">
                              {s.questionCount || 0} Qs
                            </span>
                          </td>
                          <td className="p-4">
                            {s.active ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold inline-flex items-center space-x-1">
                                <CheckCircle2 className="w-3 h-3" />
                                <span>Active</span>
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-[10px] font-bold inline-flex items-center space-x-1">
                                <XCircle className="w-3 h-3" />
                                <span>Inactive</span>
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(s)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg transition-all"
                              title="Edit Subject"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(s)}
                              className={`px-2 py-1.5 rounded-lg font-bold text-[10px] transition-all ${
                                s.active ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              }`}
                            >
                              {s.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* SUB SUBJECTS TAB */}
            {activeTaxonomyTab === 'SUB_SUBJECTS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">SubSubject Name</th>
                      <th className="p-4">Parent Subject</th>
                      <th className="p-4">Usage (Questions)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredSubSubjects.length === 0 ? (
                      <tr>
                        <td colSpan="5" className="p-8 text-center text-slate-500 italic">No sub-subjects found. Click "Add New" to create one.</td>
                      </tr>
                    ) : (
                      filteredSubSubjects.map((ss) => (
                        <tr key={ss._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 font-bold text-slate-100">{ss.name}</td>
                          <td className="p-4 text-blue-400 font-medium">{ss.subjectName}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-bold">
                              {ss.questionCount || 0} Qs
                            </span>
                          </td>
                          <td className="p-4">
                            {ss.active ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold">Active</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-[10px] font-bold">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(ss)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(ss)}
                              className={`px-2 py-1.5 rounded-lg font-bold text-[10px] ${
                                ss.active ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              }`}
                            >
                              {ss.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* TOPICS TAB */}
            {activeTaxonomyTab === 'TOPICS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">Topic Name</th>
                      <th className="p-4">Parent Subject</th>
                      <th className="p-4">SubSubject</th>
                      <th className="p-4">Usage (Questions)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredTopics.length === 0 ? (
                      <tr>
                        <td colSpan="6" className="p-8 text-center text-slate-500 italic">No topics found. Click "Add New" to create one.</td>
                      </tr>
                    ) : (
                      filteredTopics.map((t) => (
                        <tr key={t._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 font-bold text-slate-100">{t.name}</td>
                          <td className="p-4 text-blue-400 font-medium">{t.subjectName}</td>
                          <td className="p-4 text-slate-400">{t.subSubjectName || '-'}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-bold">
                              {t.questionCount || 0} Qs
                            </span>
                          </td>
                          <td className="p-4">
                            {t.active ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold">Active</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-[10px] font-bold">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(t)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(t)}
                              className={`px-2 py-1.5 rounded-lg font-bold text-[10px] ${
                                t.active ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              }`}
                            >
                              {t.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* EXAMS TAB */}
            {activeTaxonomyTab === 'EXAMS' && (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900/80 text-slate-400 font-bold uppercase tracking-wider border-b border-slate-700/80">
                    <tr>
                      <th className="p-4">Exam Name</th>
                      <th className="p-4">Short Name</th>
                      <th className="p-4">Category</th>
                      <th className="p-4">Organization</th>
                      <th className="p-4">Usage (Questions)</th>
                      <th className="p-4">Status</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-700/40">
                    {filteredExams.length === 0 ? (
                      <tr>
                        <td colSpan="7" className="p-8 text-center text-slate-500 italic">No exams found. Click "Add New" to create one.</td>
                      </tr>
                    ) : (
                      filteredExams.map((ex) => (
                        <tr key={ex._id} className="hover:bg-slate-700/30 transition-colors">
                          <td className="p-4 font-bold text-slate-100 flex items-center space-x-2">
                            <Award className="w-4 h-4 text-purple-400" />
                            <span>{ex.name}</span>
                          </td>
                          <td className="p-4 text-slate-400 font-mono">{ex.shortName || '-'}</td>
                          <td className="p-4">
                            <span className="px-2 py-0.5 bg-purple-500/10 border border-purple-500/30 text-purple-300 rounded-md font-bold text-[10px]">
                              {ex.category}
                            </span>
                          </td>
                          <td className="p-4 text-slate-400">{ex.organization || '-'}</td>
                          <td className="p-4">
                            <span className="px-2.5 py-1 bg-slate-900 border border-slate-700 rounded-lg text-slate-300 font-bold">
                              {ex.questionCount || 0} Qs
                            </span>
                          </td>
                          <td className="p-4">
                            {ex.active ? (
                              <span className="px-2.5 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 rounded-lg text-[10px] font-bold">Active</span>
                            ) : (
                              <span className="px-2.5 py-1 bg-rose-500/10 border border-rose-500/30 text-rose-400 rounded-lg text-[10px] font-bold">Inactive</span>
                            )}
                          </td>
                          <td className="p-4 text-right space-x-2">
                            <button
                              onClick={() => handleOpenEditModal(ex)}
                              className="p-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded-lg"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleToggleActive(ex)}
                              className={`px-2 py-1.5 rounded-lg font-bold text-[10px] ${
                                ex.active ? 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30' : 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                              }`}
                            >
                              {ex.active ? 'Deactivate' : 'Activate'}
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* CREATE / EDIT MODAL */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="font-bold text-sm text-slate-100 flex items-center space-x-2">
                <Plus className="w-4 h-4 text-blue-400" />
                <span>
                  {editingItem ? 'Edit' : 'Create New'}{' '}
                  {activeTaxonomyTab === 'SUBJECTS' && 'Subject'}
                  {activeTaxonomyTab === 'SUB_SUBJECTS' && 'SubSubject'}
                  {activeTaxonomyTab === 'TOPICS' && 'Topic'}
                  {activeTaxonomyTab === 'EXAMS' && 'Exam'}
                </span>
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-200 font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4 text-xs">
              
              {/* SUBJECT FORM */}
              {activeTaxonomyTab === 'SUBJECTS' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Subject Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Indian Polity"
                      value={subjectForm.name}
                      onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Subject Code</label>
                    <input
                      type="text"
                      placeholder="e.g. POLITY"
                      value={subjectForm.code}
                      onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Description</label>
                    <textarea
                      rows={2}
                      placeholder="Brief overview of subject coverage..."
                      value={subjectForm.description}
                      onChange={(e) => setSubjectForm({ ...subjectForm, description: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* SUB SUBJECT FORM */}
              {activeTaxonomyTab === 'SUB_SUBJECTS' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Parent Subject *</label>
                    <select
                      required
                      value={subSubjectForm.subjectId}
                      onChange={(e) => setSubSubjectForm({ ...subSubjectForm, subjectId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {subjects.map(s => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">SubSubject Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Constitutional History"
                      value={subSubjectForm.name}
                      onChange={(e) => setSubSubjectForm({ ...subSubjectForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* TOPIC FORM */}
              {activeTaxonomyTab === 'TOPICS' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Parent Subject *</label>
                    <select
                      required
                      value={topicForm.subjectId}
                      onChange={(e) => setTopicForm({ ...topicForm, subjectId: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      {subjects.map(s => (
                        <option key={s._id} value={s._id}>{s.name}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Topic Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Fundamental Rights (Articles 12-35)"
                      value={topicForm.name}
                      onChange={(e) => setTopicForm({ ...topicForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* EXAM FORM */}
              {activeTaxonomyTab === 'EXAMS' && (
                <>
                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Exam Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SSC CGL Examination"
                      value={examForm.name}
                      onChange={(e) => setExamForm({ ...examForm, name: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Short Name</label>
                    <input
                      type="text"
                      placeholder="e.g. SSC CGL"
                      value={examForm.shortName}
                      onChange={(e) => setExamForm({ ...examForm, shortName: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Category *</label>
                    <select
                      value={examForm.category}
                      onChange={(e) => setExamForm({ ...examForm, category: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    >
                      <option value="SSC">SSC</option>
                      <option value="Railway">Railway</option>
                      <option value="Banking">Banking</option>
                      <option value="UP State">UP State</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-slate-400 font-bold mb-1">Conducting Organization</label>
                    <input
                      type="text"
                      placeholder="e.g. Staff Selection Commission"
                      value={examForm.organization}
                      onChange={(e) => setExamForm({ ...examForm, organization: e.target.value })}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 focus:outline-none focus:border-blue-500"
                    />
                  </div>
                </>
              )}

              {/* Modal Buttons */}
              <div className="flex items-center justify-end space-x-3 pt-4 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 font-bold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl shadow-lg shadow-blue-600/30"
                >
                  {editingItem ? 'Update' : 'Save'} Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
