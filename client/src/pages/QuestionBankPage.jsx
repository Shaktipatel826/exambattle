import React, { useState, useEffect } from 'react';
import { Search, Filter, BookOpen, AlertTriangle, CheckCircle2, ShieldCheck, Tag } from 'lucide-react';

export const QuestionBankPage = ({ token, onStartPractice }) => {
  const [questions, setQuestions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [subject, setSubject] = useState('All');
  const [topic, setTopic] = useState('All');
  const [exam, setExam] = useState('All');
  const [difficulty, setDifficulty] = useState('All');
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState('TYPO');
  const [reportMsg, setReportMsg] = useState('');

  useEffect(() => {
    fetchQuestions();
  }, [subject, topic, exam, difficulty]);

  const fetchQuestions = async () => {
    setLoading(true);
    try {
      const query = new URLSearchParams({
        subject,
        topic,
        exam,
        difficulty,
        search
      }).toString();

      const res = await fetch(`/api/questions?${query}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setQuestions(data.questions);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportingId) return;

    try {
      const res = await fetch(`/api/questions/${reportingId}/report`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: reportReason, comments: reportMsg })
      });
      const data = await res.json();
      if (data.success) {
        alert('Question report submitted for admin review!');
        setReportingId(null);
        setReportMsg('');
      }
    } catch (e) {
      alert('Report submission error');
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6 text-[#252525]">
      
      {/* Header */}
      <div className="bg-[#FFFDF8] p-6 rounded-2xl border border-[#E2DACB] shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#244A73] flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#244A73]" /> CENTRAL QUESTION BANK & PYQ
          </h1>
          <p className="text-xs text-[#66635D] mt-1">
            Browse verified official PYQs, exam questions, and subject-wise taxonomies.
          </p>
        </div>

        <button
          onClick={() => onStartPractice && onStartPractice({ subject, topic, exam })}
          className="py-2.5 px-5 rounded-xl bg-[#244A73] hover:bg-[#1B3857] text-white font-bold text-xs shadow-sm transition-all self-start md:self-auto"
        >
          PRACTICE THESE QUESTIONS
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-[#FFFDF8] p-4 rounded-xl border border-[#E2DACB] shadow-sm space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3">
          
          {/* Search */}
          <div className="relative md:col-span-1">
            <Search className="w-4 h-4 text-[#66635D] absolute left-3 top-3" />
            <input
              type="text"
              placeholder="Search questions..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && fetchQuestions()}
              className="w-full bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] text-xs pl-9 pr-3 py-2 rounded-lg focus:outline-none focus:border-[#244A73]"
            />
          </div>

          {/* Subject */}
          <select value={subject} onChange={e => setSubject(e.target.value)} className="bg-white border border-[#D5CDBF] text-[#252525] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#244A73]">
            <option value="All">All Subjects</option>
            <option value="Indian Polity">Indian Polity</option>
            <option value="History">History</option>
            <option value="Geography">Geography</option>
            <option value="Economics">Economics</option>
            <option value="Science">Science</option>
            <option value="Computer">Computer</option>
            <option value="Mathematics">Mathematics</option>
          </select>

          {/* Topic */}
          <select value={topic} onChange={e => setTopic(e.target.value)} className="bg-white border border-[#D5CDBF] text-[#252525] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#244A73]">
            <option value="All">All Topics</option>
            <option value="Fundamental Rights">Fundamental Rights</option>
            <option value="President">President</option>
            <option value="Revolt of 1857">Revolt of 1857</option>
            <option value="Mauryan Empire">Mauryan Empire</option>
            <option value="Rivers">Rivers</option>
            <option value="RBI">RBI</option>
            <option value="Chemistry">Chemistry</option>
          </select>

          {/* Exam Filter */}
          <select value={exam} onChange={e => setExam(e.target.value)} className="bg-white border border-[#D5CDBF] text-[#252525] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#244A73]">
            <option value="All">All Target Exams</option>
            <option value="SSC CGL">SSC CGL</option>
            <option value="UP Police">UP Police</option>
            <option value="Railway NTPC">Railway NTPC</option>
            <option value="IBPS PO">IBPS PO</option>
          </select>

          {/* Difficulty */}
          <select value={difficulty} onChange={e => setDifficulty(e.target.value)} className="bg-white border border-[#D5CDBF] text-[#252525] text-xs px-3 py-2 rounded-lg focus:outline-none focus:border-[#244A73]">
            <option value="All">All Difficulties</option>
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>

        </div>
      </div>

      {/* Questions List */}
      {loading ? (
        <div className="text-center py-12 text-[#66635D] text-xs font-bold">Loading question bank database...</div>
      ) : questions.length === 0 ? (
        <div className="bg-[#FFFDF8] p-12 text-center rounded-2xl border border-[#E2DACB] text-[#66635D]">
          <BookOpen className="w-12 h-12 mx-auto text-[#66635D] mb-2" />
          <p className="text-sm font-bold text-[#252525]">No questions found matching selected filters.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {questions.map((q, idx) => (
            <div key={q._id} className="bg-[#FFFDF8] rounded-xl p-5 border border-[#E2DACB] shadow-sm space-y-3">
              
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#E2DACB] pb-2">
                <div className="flex items-center space-x-2 text-[11px] font-semibold">
                  <span className="bg-[#EFE9DC] text-[#244A73] px-2.5 py-0.5 rounded-full font-bold border border-[#D5CDBF]">
                    {q.subject}
                  </span>
                  <span className="text-[#66635D]">• {q.topic}</span>
                  {q.examYear && <span className="text-[#D97706] font-bold">• {q.exam} {q.examYear}</span>}
                </div>

                <div className="flex items-center space-x-2">
                  {q.sourceType === 'VERIFIED_PYQ' ? (
                    <span className="bg-[#E8F5E9] text-[#2D6A4F] text-[10px] px-2 py-0.5 rounded font-bold border border-[#A5D6A7] flex items-center gap-1">
                      <ShieldCheck className="w-3 h-3" /> VERIFIED PYQ
                    </span>
                  ) : (
                    <span className="bg-[#EFE9DC] text-[#252525] text-[10px] px-2 py-0.5 rounded font-medium border border-[#D5CDBF]">
                      {q.sourceType}
                    </span>
                  )}

                  <button
                    onClick={() => setReportingId(q._id)}
                    className="text-[#66635D] hover:text-[#9E2A2B] text-[10px] font-bold"
                  >
                    Report Issue
                  </button>
                </div>
              </div>

              {/* Question Text */}
              <p className="text-xs sm:text-sm font-bold text-[#252525] leading-relaxed">
                Q{idx + 1}. {q.question}
              </p>

              {/* Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                {q.options.map((opt, oIdx) => (
                  <div
                    key={oIdx}
                    className={`p-2.5 rounded-lg text-xs font-semibold border ${
                      oIdx === q.correctAnswer
                        ? 'bg-[#E8F5E9] border-[#2D6A4F] text-[#2D6A4F]'
                        : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
                    }`}
                  >
                    <span className="font-bold mr-1">{String.fromCharCode(65 + oIdx)}.</span> {opt}
                  </div>
                ))}
              </div>

              {q.explanation && (
                <div className="p-3 rounded-lg bg-[#F7F3EA] border border-[#E2DACB] text-xs text-[#252525] space-y-1">
                  <span className="font-bold text-[#244A73]">Official Rationale:</span>
                  <p>{q.explanation}</p>
                </div>
              )}

            </div>
          ))}
        </div>
      )}

      {/* Report Modal */}
      {reportingId && (
        <div className="fixed inset-0 z-50 bg-[#252525]/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-[#FFFDF8] w-full max-w-md p-6 rounded-2xl border border-[#E2DACB] shadow-xl space-y-4 text-[#252525]">
            <h3 className="text-sm font-bold text-[#252525] flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-[#9E2A2B]" /> Report Question Issue
            </h3>

            <form onSubmit={handleReportSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-[#252525] mb-1">Issue Type</label>
                <select
                  value={reportReason}
                  onChange={e => setReportReason(e.target.value)}
                  className="w-full bg-white border border-[#D5CDBF] text-[#252525] text-xs px-3 py-2 rounded-lg"
                >
                  <option value="WRONG_ANSWER">Incorrect Answer Key</option>
                  <option value="INCORRECT_EXPLANATION">Flawed Explanation</option>
                  <option value="DUPLICATE">Duplicate Question</option>
                  <option value="TYPO">Typo / Grammatical Error</option>
                  <option value="WRONG_PYQ_LABEL">Incorrect PYQ Label</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#252525] mb-1">Comments</label>
                <textarea
                  rows="3"
                  placeholder="Explain why this question needs admin correction..."
                  value={reportMsg}
                  onChange={e => setReportMsg(e.target.value)}
                  className="w-full bg-white border border-[#D5CDBF] text-[#252525] placeholder-[#8C867A] text-xs p-3 rounded-lg"
                ></textarea>
              </div>

              <div className="flex justify-end space-x-2 pt-2">
                <button
                  type="button"
                  onClick={() => setReportingId(null)}
                  className="px-4 py-2 rounded-lg text-xs font-bold text-[#66635D] hover:text-[#252525]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg text-xs font-bold bg-[#9E2A2B] hover:bg-[#7E2223] text-white"
                >
                  Submit Report
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
};
