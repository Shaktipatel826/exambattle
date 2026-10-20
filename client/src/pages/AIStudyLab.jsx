import React, { useState, useEffect } from 'react';
import { 
  Sparkles, UploadCloud, FileText, CheckCircle2, AlertCircle, 
  HelpCircle, BookOpen, Clock, Tag, Cpu
} from 'lucide-react';
import { DocToTestPanel } from './DocToTestPanel';

export const AIStudyLab = ({ token, user }) => {
  const [activeTab, setActiveTab] = useState('studypack'); // 'studypack' | 'doctotest'
  const [pastedText, setPastedText] = useState('');
  const [file, setFile] = useState(null);
  const [subject, setSubject] = useState('Indian Polity');
  const [topic, setTopic] = useState('Fundamental Rights');
  
  const [processing, setProcessing] = useState(false);
  const [progressStep, setProgressStep] = useState(0); // 0..5
  const [studyPacks, setStudyPacks] = useState([]);
  const [activePack, setActivePack] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchStudyPacks();
  }, []);

  const fetchStudyPacks = async () => {
    try {
      const res = await fetch('/api/ai/study-packs', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.studyPacks.length > 0) {
        setStudyPacks(data.studyPacks);
        setActivePack(data.studyPacks[0]);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleProcess = async (e) => {
    e.preventDefault();
    if (!file && !pastedText.trim()) {
      setError('Please attach a file (TXT, CSV, PDF, DOCX, XLSX) or paste study material.');
      return;
    }

    setError('');
    setProcessing(true);
    setProgressStep(1); // Uploading

    setTimeout(() => setProgressStep(2), 800);  // Extracting
    setTimeout(() => setProgressStep(3), 1600); // Topics & Notes
    setTimeout(() => setProgressStep(4), 2500); // Creating MCQs

    const formData = new FormData();
    if (file) formData.append('file', file);
    if (pastedText) formData.append('pastedText', pastedText);
    formData.append('subject', subject);
    formData.append('topic', topic);
    formData.append('title', file ? file.name : `Notes: ${topic}`);

    try {
      const res = await fetch('/api/ai/process-material', {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        setProgressStep(5);
        setActivePack(data.studyPack);
        setStudyPacks([data.studyPack, ...studyPacks]);
        setPastedText('');
        setFile(null);
      } else {
        setError(data.message || 'Processing failed');
      }
    } catch (err) {
      setError('Processing error occurred.');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      
      {/* Header */}
      <div className="glass-panel p-6 rounded-2xl bg-gradient-to-r from-purple-950/40 via-slate-900 to-slate-900 border border-purple-500/30">
        <div className="flex items-center space-x-3">
          <div className="w-12 h-12 rounded-xl bg-purple-600/30 flex items-center justify-center text-purple-300 border border-purple-500/40">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white">AI STUDY LAB</h1>
            <p className="text-xs text-slate-400">
              Upload lectures, transcripts, PDFs or notes ➔ Instantly generate Short Notes, One-Liners, Exam Points & MCQs.
            </p>
          </div>
        </div>
      </div>

      {/* Tab Bar */}
      <div className="flex gap-2 bg-slate-900/50 p-1.5 rounded-2xl border border-slate-700/50 w-fit">
        <button
          onClick={() => setActiveTab('studypack')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'studypack' ? 'bg-purple-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}>
          <Sparkles className="w-4 h-4" /> AI Study Pack
        </button>
        <button
          onClick={() => setActiveTab('doctotest')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'doctotest' ? 'bg-[#244A73] text-white shadow' : 'text-slate-400 hover:text-white'}`}>
          <Cpu className="w-4 h-4" /> Multi-AI Doc → Test
        </button>
      </div>

      {/* Multi-AI Pipeline Tab */}
      {activeTab === 'doctotest' && (
        <DocToTestPanel token={token} user={user} />
      )}

      {/* Study Pack Tab */}
      {activeTab === 'studypack' && (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Upload Form & Processing Status */}
        <div className="space-y-6">
          
          <div className="glass-panel rounded-xl p-5 border border-slate-700/80 space-y-4">
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              <UploadCloud className="w-4 h-4 text-purple-400" />
              Upload Learning Material
            </h2>

            {error && (
              <div className="p-3 rounded-lg bg-red-950/60 border border-red-800 text-red-200 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleProcess} className="space-y-4">
              
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Target Subject & Topic</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={subject}
                    onChange={e => setSubject(e.target.value)}
                    className="glass-input text-xs"
                  >
                    <option value="Indian Polity">Indian Polity</option>
                    <option value="History">History</option>
                    <option value="Geography">Geography</option>
                    <option value="Economics">Economics</option>
                    <option value="Science">Science</option>
                    <option value="Computer">Computer</option>
                    <option value="Mathematics">Mathematics</option>
                  </select>
                  <input
                    type="text"
                    placeholder="e.g. Fundamental Rights"
                    value={topic}
                    onChange={e => setTopic(e.target.value)}
                    className="glass-input text-xs"
                  />
                </div>
              </div>

              {/* File Attachment Box */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Attach File (PDF, DOCX, CSV, TXT, XLSX)</label>
                <label className="flex flex-col items-center justify-center p-4 border-2 border-dashed border-slate-700 hover:border-purple-500/60 rounded-xl cursor-pointer bg-slate-950/60 transition-all">
                  <FileText className="w-8 h-8 text-purple-400 mb-1" />
                  <span className="text-xs text-slate-300 font-medium">
                    {file ? file.name : 'Click to select transcript/document'}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-0.5">Supports CSV transcripts (start,end,text)</span>
                  <input
                    type="file"
                    accept=".txt,.csv,.pdf,.docx,.xlsx"
                    onChange={e => setFile(e.target.files[0])}
                    className="hidden"
                  />
                </label>
              </div>

              {/* Or Paste Text */}
              <div>
                <label className="block text-xs font-semibold text-slate-300 mb-1">Or Paste Text Material</label>
                <textarea
                  rows="4"
                  placeholder="Paste lecture text, notes, or transcript lines here..."
                  value={pastedText}
                  onChange={e => setPastedText(e.target.value)}
                  className="w-full glass-input text-xs custom-scrollbar"
                ></textarea>
              </div>

              <button
                type="submit"
                disabled={processing}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
              >
                {processing ? 'GENERATING AI STUDY PACK...' : 'GENERATE AI STUDY PACK'}
              </button>

            </form>
          </div>

          {/* Real-time File Processing Pipeline Visualizer */}
          {processing && (
            <div className="glass-panel p-5 rounded-xl border border-purple-500/40 bg-slate-950 space-y-3">
              <h3 className="text-xs font-bold text-purple-300 uppercase tracking-wider">Processing Pipeline</h3>
              
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">1. Uploading Content</span>
                  <CheckCircle2 className={`w-4 h-4 ${progressStep >= 1 ? 'text-emerald-400' : 'text-slate-700'}`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">2. Text Extraction & Cleaning</span>
                  <CheckCircle2 className={`w-4 h-4 ${progressStep >= 2 ? 'text-emerald-400' : 'text-slate-700'}`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">3. Extracting Key Notes & One-Liners</span>
                  <CheckCircle2 className={`w-4 h-4 ${progressStep >= 3 ? 'text-emerald-400' : 'text-slate-700'}`} />
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-slate-300">4. Creating Verified Exam MCQs</span>
                  <CheckCircle2 className={`w-4 h-4 ${progressStep >= 4 ? 'text-emerald-400' : 'text-slate-700'}`} />
                </div>
              </div>
            </div>
          )}

          {/* Previous Packs List */}
          <div className="glass-panel rounded-xl p-4 border border-slate-700/80">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider mb-3">Saved Study Packs</h3>
            <div className="space-y-2 max-h-56 overflow-y-auto custom-scrollbar">
              {studyPacks.map(pack => (
                <button
                  key={pack._id}
                  onClick={() => setActivePack(pack)}
                  className={`w-full text-left p-2.5 rounded-lg text-xs font-semibold transition-all border ${
                    activePack?._id === pack._id
                      ? 'bg-purple-600/30 border-purple-500 text-purple-200'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <p className="truncate">{pack.title}</p>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {new Date(pack.createdAt).toLocaleDateString()} • {pack.newMCQs?.length || 0} MCQs
                  </span>
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: AI Study Pack Output View */}
        <div className="lg:col-span-2 space-y-6">
          
          {activePack ? (
            <div className="glass-panel rounded-2xl p-6 border border-slate-700/80 space-y-6">
              
              {/* Study Pack Title & Metadata */}
              <div className="border-b border-slate-800 pb-4">
                <div className="flex items-center space-x-2 text-[11px] font-bold text-purple-400 uppercase tracking-wider mb-1">
                  <Tag className="w-3.5 h-3.5" />
                  <span>AI Processed Pack</span>
                  <span>•</span>
                  <span className="text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800/60">
                    Source Verified ({activePack.sourceType})
                  </span>
                </div>
                <h2 className="text-xl font-black text-white">{activePack.title}</h2>
              </div>

              {/* Section A: Short Notes */}
              {activePack.shortNotes?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-blue-400 uppercase tracking-wider flex items-center gap-1.5">
                    <BookOpen className="w-4 h-4" /> A. Short Exam Notes
                  </h3>
                  <div className="bg-slate-950/80 p-4 rounded-xl border border-slate-800 space-y-2">
                    {activePack.shortNotes.map((note, i) => (
                      <p key={i} className="text-xs text-slate-300 leading-relaxed flex items-start space-x-2">
                        <span className="text-blue-400 font-bold">•</span>
                        <span>{note}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}

              {/* Section B: One-Liners */}
              {activePack.oneLiners?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4" /> B. High-Priority One-Liners
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {activePack.oneLiners.map((item, i) => (
                      <div key={i} className="p-3 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-200">
                        <span className="text-amber-400 font-bold mr-1">#{i + 1}</span> {item}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section C: Key Concepts */}
              {activePack.keyConcepts?.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4" /> C. Key Conceptual Breakdown
                  </h3>
                  <div className="space-y-2">
                    {activePack.keyConcepts.map((kc, i) => (
                      <div key={i} className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-800/40">
                        <h4 className="text-xs font-bold text-purple-300">{kc.concept}</h4>
                        <p className="text-xs text-slate-300 mt-1">{kc.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Section D: Generated MCQs */}
              {activePack.newMCQs?.length > 0 && (
                <div className="space-y-3">
                  <h3 className="text-xs font-bold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4" /> D. Generated MCQs ({activePack.newMCQs.length} Questions)
                  </h3>

                  <div className="space-y-3">
                    {activePack.newMCQs.map((q, qIdx) => (
                      <div key={qIdx} className="p-4 rounded-xl bg-slate-950/80 border border-slate-800 space-y-2">
                        <div className="flex justify-between items-start">
                          <p className="text-xs font-bold text-slate-100">
                            Q{qIdx + 1}. {q.question}
                          </p>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-900/60 text-blue-300">
                            {q.sourceType || 'SOURCE_BASED'}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          {q.options?.map((opt, oIdx) => (
                            <div
                              key={oIdx}
                              className={`p-2 rounded-lg text-xs font-medium border ${
                                oIdx === q.correctAnswer
                                  ? 'bg-emerald-950/60 border-emerald-500/60 text-emerald-200'
                                  : 'bg-slate-900 border-slate-800 text-slate-400'
                              }`}
                            >
                              <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                            </div>
                          ))}
                        </div>

                        {q.explanation && (
                          <div className="mt-2 text-[11px] text-slate-400 bg-slate-900/60 p-2 rounded border border-slate-800">
                            <span className="font-bold text-blue-400">Explanation:</span> {q.explanation}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          ) : (
            <div className="glass-panel rounded-2xl p-12 text-center text-slate-400 border border-slate-800">
              <Sparkles className="w-12 h-12 mx-auto text-purple-400/40 mb-3" />
              <h3 className="text-base font-bold text-slate-200">No Study Pack Selected</h3>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Upload a document or paste lecture notes on the left panel to build your instant AI study pack.
              </p>
            </div>
          )}

        </div>

      </div>
      )}

    </div>
  );
};
