/**
 * SavedTestsPage — Personal saved tests library.
 * Actions per test: Preview, Create Room (battle), Delete.
 *
 * Battle flow:
 *  1. Student clicks Battle → Question Count Selector modal opens.
 *  2. Student picks a preset (10 / 20 / 30 / 50) or enters a custom number.
 *  3. Confirm → self-contained socket emits create_room_from_saved_test with
 *     the chosen count. Server does Fisher-Yates random sampling server-side.
 *  4. All players in the same room receive the identical randomly-sampled set.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  BookOpen, Swords, Trash2, Eye, Loader2, Plus, AlertCircle,
  CheckCircle2, Calendar, HelpCircle, Cpu, ChevronDown, ChevronUp,
  RefreshCw, Shuffle, X
} from 'lucide-react';
import { getSocketUrl } from '../lib/apiConfig';

const LANG_LABELS = { en: 'English', hi: 'Hindi', bilingual: 'Bilingual' };
const QUICK_COUNTS = [10, 20, 30, 50];

// ── Question Count Selector Modal ────────────────────────────────────────────
const QuestionCountModal = ({ test, onConfirm, onClose }) => {
  const total = test.questionCount || 0;
  const defaultCount = Math.min(20, total);
  const [selected, setSelected] = useState(
    QUICK_COUNTS.includes(defaultCount) ? defaultCount : Math.min(QUICK_COUNTS[0], total)
  );
  const [customMode, setCustomMode] = useState(false);
  const [customVal, setCustomVal] = useState(String(defaultCount));
  const [validationErr, setValidationErr] = useState('');

  const effectiveCount = customMode ? parseInt(customVal, 10) || 0 : selected;

  const validate = (val) => {
    const n = parseInt(val, 10);
    if (!val.trim() || isNaN(n) || n < 1) return 'Please enter a valid number (minimum 1).';
    if (n > total) return `Only ${total} questions available. Enter ${total} or fewer.`;
    return '';
  };

  const handleCustomChange = (v) => {
    setCustomVal(v);
    setValidationErr(validate(v));
  };

  const handleQuickPick = (n) => {
    setCustomMode(false);
    setValidationErr('');
    setSelected(n);
  };

  const handleConfirm = () => {
    if (customMode) {
      const err = validate(customVal);
      if (err) { setValidationErr(err); return; }
    }
    onConfirm(effectiveCount);
  };

  const isConfirmDisabled = customMode
    ? (!!validationErr || !customVal.trim() || parseInt(customVal, 10) < 1)
    : false;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/50 backdrop-blur-sm p-4">
      <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl shadow-2xl w-full max-w-sm space-y-5 p-6">

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h2 className="font-black text-[#252525] text-base leading-snug">Select Questions</h2>
            <p className="text-xs text-[#66635D] mt-0.5 leading-relaxed">
              <span className="font-bold text-[#244A73]">{total}</span> questions available in this test.
              A random selection will be used for the battle.
            </p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#F7F3EA] text-[#66635D] transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Test title */}
        <div className="px-3 py-2 rounded-xl bg-[#F7F3EA] border border-[#E2DACB]">
          <p className="text-[11px] text-[#66635D] font-semibold truncate">{test.title}</p>
        </div>

        {/* Quick picks */}
        <div>
          <p className="text-[11px] font-bold text-[#66635D] uppercase tracking-wide mb-2">Quick Select</p>
          <div className="grid grid-cols-4 gap-2">
            {QUICK_COUNTS.map(n => {
              const disabled = n > total;
              const active = !customMode && selected === n;
              return (
                <button
                  key={n}
                  onClick={() => !disabled && handleQuickPick(n)}
                  disabled={disabled}
                  className={`py-2.5 rounded-xl text-xs font-bold border transition-all ${
                    disabled
                      ? 'bg-[#F7F3EA] border-[#E2DACB] text-[#D5CDBF] cursor-not-allowed'
                      : active
                      ? 'bg-[#244A73] border-[#244A73] text-white shadow-sm'
                      : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525] hover:border-[#244A73] hover:bg-[#EFE9DC]'
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </div>

        {/* Custom number */}
        <div>
          <p className="text-[11px] font-bold text-[#66635D] uppercase tracking-wide mb-2">Custom Number</p>
          <div className="flex gap-2">
            <input
              type="number"
              min={1}
              max={total}
              value={customVal}
              onFocus={() => setCustomMode(true)}
              onChange={e => { setCustomMode(true); handleCustomChange(e.target.value); }}
              placeholder={`1 – ${total}`}
              className={`flex-1 px-3 py-2.5 rounded-xl text-xs font-semibold border focus:outline-none transition-colors ${
                customMode
                  ? 'bg-[#EFE9DC] border-[#244A73] text-[#252525]'
                  : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
              }`}
            />
            {customMode && !validationErr && parseInt(customVal, 10) >= 1 && parseInt(customVal, 10) <= total && (
              <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-green-50 border border-green-200">
                <CheckCircle2 className="w-4 h-4 text-green-600" />
              </div>
            )}
          </div>
          {validationErr && (
            <p className="mt-1.5 text-[11px] text-red-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3 shrink-0" /> {validationErr}
            </p>
          )}
        </div>

        {/* Selected count summary */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#244A73]/8 border border-[#244A73]/20">
          <Shuffle className="w-3.5 h-3.5 text-[#244A73] shrink-0" />
          <p className="text-xs text-[#244A73] font-semibold">
            {effectiveCount >= 1 && effectiveCount <= total
              ? `${effectiveCount} questions will be randomly picked from ${total}`
              : 'Enter a valid count to continue'}
          </p>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl border border-[#E2DACB] text-[#66635D] text-xs font-semibold hover:bg-[#F7F3EA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
            className="flex-1 py-2.5 rounded-xl bg-[#244A73] text-white text-xs font-bold hover:bg-[#1a3a5c] disabled:opacity-50 flex items-center justify-center gap-1.5 transition-colors"
          >
            <Swords className="w-3.5 h-3.5" />
            Start Battle
          </button>
        </div>
      </div>
    </div>
  );
};

// ── Main Page ────────────────────────────────────────────────────────────────
export const SavedTestsPage = ({ token, user, onNavigate }) => {
  const [tests, setTests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState(null);
  const [previewTest, setPreviewTest] = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingRoom, setCreatingRoom] = useState(null);   // testId while socket is working
  const [roomResults, setRoomResults] = useState({});
  // Question count selector: stores the test object when modal is open
  const [battleSetup, setBattleSetup] = useState(null);

  const fetchTests = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await fetch('/api/saved-tests', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setTests(data.tests || []);
      else setError(data.message || 'Failed to load saved tests.');
    } catch (err) {
      setError(`Network error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { fetchTests(); }, [fetchTests]);

  const handleDelete = async (testId) => {
    setDeleting(true);
    try {
      const res = await fetch(`/api/saved-tests/${testId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setTests(prev => prev.filter(t => t._id !== testId));
        setDeleteConfirm(null);
        if (previewId === testId) { setPreviewId(null); setPreviewTest(null); }
      } else {
        setError(data.message || 'Delete failed.');
      }
    } catch (err) {
      setError(`Delete error: ${err.message}`);
    } finally {
      setDeleting(false);
    }
  };

  const handlePreview = async (testId) => {
    if (previewId === testId) {
      setPreviewId(null);
      setPreviewTest(null);
      return;
    }
    setPreviewId(testId);
    setPreviewTest(null);
    setPreviewLoading(true);
    try {
      const res = await fetch(`/api/saved-tests/${testId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) setPreviewTest(data.test);
    } catch { /* silent */ }
    finally { setPreviewLoading(false); }
  };

  // Opens the question count selector modal
  const openBattleSetup = (test) => {
    setRoomResults(prev => ({ ...prev, [test._id]: {} }));
    setBattleSetup(test);
  };

  // Called when student confirms count in the modal
  const handleCreateRoom = async (test, questionCount) => {
    setBattleSetup(null);
    setCreatingRoom(test._id);
    setRoomResults(prev => ({ ...prev, [test._id]: {} }));

    let tempSocket = null;
    let timedOut = false;

    const cleanup = () => {
      if (tempSocket) {
        tempSocket.off('connect');
        tempSocket.disconnect();
        tempSocket = null;
      }
    };

    try {
      const { io } = await import('socket.io-client');
      tempSocket = io(getSocketUrl(), {
        transports: ['websocket', 'polling'],
        timeout: 10000,
        reconnection: false,
      });

      const timeoutId = setTimeout(() => {
        timedOut = true;
        cleanup();
        setCreatingRoom(null);
        setRoomResults(prev => ({
          ...prev,
          [test._id]: { error: 'Could not connect to battle server. Please try again.' }
        }));
      }, 12000);

      const doCreate = () => {
        if (timedOut) return;
        tempSocket.emit('create_room_from_saved_test', {
          user: { id: user?.id || user?._id, name: user?.name },
          savedTestId: test._id,
          config: {
            questionCount,
            timeLimitMinutes: Math.max(5, Math.ceil(questionCount * 1.5)),
            negativeMarking: 0.25,
          }
        }, (ack) => {
          clearTimeout(timeoutId);
          cleanup();
          setCreatingRoom(null);
          if (ack?.success) {
            setRoomResults(prev => ({ ...prev, [test._id]: { code: ack.roomCode } }));
            if (onNavigate) onNavigate('BATTLE', { joinRoomCode: ack.roomCode });
          } else {
            setRoomResults(prev => ({
              ...prev,
              [test._id]: { error: ack?.message || 'Room creation failed. Please try again.' }
            }));
          }
        });
      };

      if (tempSocket.connected) {
        doCreate();
      } else {
        tempSocket.once('connect', doCreate);
        tempSocket.once('connect_error', (err) => {
          if (timedOut) return;
          clearTimeout(timeoutId);
          cleanup();
          setCreatingRoom(null);
          setRoomResults(prev => ({
            ...prev,
            [test._id]: { error: `Connection error: ${err.message}. Please try again.` }
          }));
        });
      }
    } catch (err) {
      setCreatingRoom(null);
      setRoomResults(prev => ({
        ...prev,
        [test._id]: { error: err.message }
      }));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 pb-24 lg:pb-8 space-y-6">

      {/* Question Count Selector Modal */}
      {battleSetup && (
        <QuestionCountModal
          test={battleSetup}
          onConfirm={(count) => handleCreateRoom(battleSetup, count)}
          onClose={() => setBattleSetup(null)}
        />
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#252525]/40 backdrop-blur-sm p-4">
          <div className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl p-6 max-w-sm w-full shadow-xl space-y-4">
            <h3 className="font-bold text-[#252525]">Delete this test?</h3>
            <p className="text-xs text-[#66635D]">This cannot be undone. The test will be permanently removed from your library.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteConfirm(null)}
                className="flex-1 py-2.5 rounded-xl border border-[#E2DACB] text-[#66635D] text-xs font-semibold hover:bg-[#F7F3EA] transition-colors">
                Cancel
              </button>
              <button onClick={() => handleDelete(deleteConfirm)} disabled={deleting}
                className="flex-1 py-2.5 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                {deleting && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#244A73] rounded-xl flex items-center justify-center">
            <BookOpen className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-black text-[#252525]">Saved Tests</h1>
            <p className="text-xs text-[#66635D]">Your personal test library</p>
          </div>
        </div>
        <button onClick={() => onNavigate?.('CREATE_TEST')}
          className="flex items-center gap-1.5 px-4 py-2 bg-[#244A73] text-white text-xs font-bold rounded-xl hover:bg-[#1a3a5c] transition-colors">
          <Plus className="w-4 h-4" /> Create New Test
        </button>
      </div>

      {/* API error */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchTests} className="ml-auto flex items-center gap-1 underline font-semibold">
            <RefreshCw className="w-3 h-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-[#244A73] mx-auto mb-3" />
          <p className="text-xs text-[#66635D]">Loading your saved tests…</p>
        </div>
      ) : tests.length === 0 ? (
        /* Empty state */
        <div className="text-center py-16 bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl">
          <Cpu className="w-12 h-12 text-[#244A73]/20 mx-auto mb-3" />
          <h3 className="font-bold text-[#252525] mb-1">No saved tests yet</h3>
          <p className="text-xs text-[#66635D] mb-5">Create a test from study material and save it here to battle with friends.</p>
          <button onClick={() => onNavigate?.('CREATE_TEST')}
            className="px-5 py-2.5 bg-[#244A73] text-white text-xs font-bold rounded-xl hover:bg-[#1a3a5c] transition-colors">
            Create Your First Test
          </button>
        </div>
      ) : (
        /* Test list */
        <div className="space-y-3">
          {tests.map(test => {
            const roomRes = roomResults[test._id] || {};
            const isCreating = creatingRoom === test._id;
            return (
              <div key={test._id} className="bg-[#FFFDF8] border border-[#E2DACB] rounded-2xl shadow-sm overflow-hidden">

                {/* Card body */}
                <div className="p-4">
                  <div className="flex items-start justify-between gap-3">

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-[#252525] text-sm leading-snug truncate">{test.title}</h3>
                      <div className="flex flex-wrap gap-1.5 mt-1.5">
                        <span className="text-[10px] font-semibold bg-[#244A73]/10 text-[#244A73] px-2 py-0.5 rounded-full">
                          {test.subject}
                        </span>
                        {test.topic && test.topic !== test.subject && (
                          <span className="text-[10px] text-[#66635D] bg-[#F7F3EA] border border-[#E2DACB] px-2 py-0.5 rounded-full">
                            {test.topic}
                          </span>
                        )}
                        <span className="text-[10px] text-[#66635D] bg-[#F7F3EA] border border-[#E2DACB] px-2 py-0.5 rounded-full">
                          {LANG_LABELS[test.language] || test.language || 'English'}
                        </span>
                        <span className="text-[10px] text-[#66635D] bg-[#F7F3EA] border border-[#E2DACB] px-2 py-0.5 rounded-full">
                          {test.difficulty || 'Mixed'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-[11px] text-[#66635D]">
                        <span className="flex items-center gap-1">
                          <HelpCircle className="w-3 h-3" />
                          {test.questionCount} question{test.questionCount !== 1 ? 's' : ''}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" />
                          {new Date(test.createdAt).toLocaleDateString('en-IN', {
                            day: 'numeric', month: 'short', year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={() => handlePreview(test._id)}
                        title="Preview questions"
                        className={`p-2 rounded-lg border text-xs transition-colors ${
                          previewId === test._id
                            ? 'bg-[#244A73] text-white border-[#244A73]'
                            : 'text-[#66635D] border-[#E2DACB] hover:bg-[#F7F3EA]'
                        }`}>
                        {previewId === test._id
                          ? <ChevronUp className="w-4 h-4" />
                          : <Eye className="w-4 h-4" />}
                      </button>

                      {/* Battle button — opens question count picker */}
                      <button
                        onClick={() => openBattleSetup(test)}
                        disabled={isCreating}
                        title="Select questions and create Battle Room"
                        className="flex items-center gap-1 px-3 py-2 text-xs font-bold rounded-lg transition-colors disabled:opacity-50 bg-[#244A73] hover:bg-[#1a3a5c] text-white">
                        {isCreating
                          ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          : <Swords className="w-3.5 h-3.5" />}
                        {isCreating ? 'Creating…' : 'Battle'}
                      </button>

                      <button
                        onClick={() => setDeleteConfirm(test._id)}
                        className="p-2 rounded-lg border border-[#E2DACB] text-[#66635D] hover:text-red-600 hover:bg-red-50 hover:border-red-200 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Room result feedback */}
                  {roomRes.code && (
                    <div className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Room <strong>{roomRes.code}</strong> created — navigating to Battle…
                    </div>
                  )}
                  {roomRes.error && (
                    <div className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 flex items-center gap-2">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      {roomRes.error}
                      <button
                        onClick={() => openBattleSetup(test)}
                        className="ml-auto font-bold underline whitespace-nowrap">
                        Retry
                      </button>
                    </div>
                  )}
                </div>

                {/* Preview panel */}
                {previewId === test._id && (
                  <div className="border-t border-[#E2DACB] bg-[#F7F3EA] p-4">
                    {previewLoading ? (
                      <div className="flex items-center gap-2 text-xs text-[#66635D]">
                        <Loader2 className="w-4 h-4 animate-spin" /> Loading questions…
                      </div>
                    ) : previewTest?.questions?.length > 0 ? (
                      <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
                        {previewTest.questions.map((q, qi) => (
                          <div key={qi} className="bg-[#FFFDF8] border border-[#E2DACB] rounded-xl p-3 text-xs">
                            <p className="font-semibold text-[#252525] mb-2">
                              <span className="text-[#244A73] font-bold">Q{qi + 1}.</span> {q.question}
                            </p>
                            {/* Short-answer: show reference answer */}
                            {q.questionType === 'short_answer' ? (
                              <div className="flex items-start gap-2 px-2 py-1.5 rounded-lg bg-green-50 border border-green-200 text-[11px] text-green-800">
                                <CheckCircle2 className="w-3 h-3 shrink-0 mt-0.5 text-green-600" />
                                <span><strong>Answer:</strong> {q.referenceAnswer}</span>
                              </div>
                            ) : (
                              /* MCQ: show options */
                              <div className="grid grid-cols-2 gap-1">
                                {q.options?.map((opt, oi) => (
                                  <div key={oi}
                                    className={`px-2 py-1 rounded-lg border text-[11px] ${
                                      oi === q.correctAnswer
                                        ? 'bg-green-50 border-green-200 text-green-800 font-semibold'
                                        : 'bg-[#F7F3EA] border-[#E2DACB] text-[#252525]'
                                    }`}>
                                    <span className="font-bold">{String.fromCharCode(65 + oi)})</span> {opt}
                                  </div>
                                ))}
                              </div>
                            )}
                            {q.explanation && (
                              <p className="mt-1.5 text-[10px] text-[#66635D] italic">{q.explanation}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-[#66635D]">No questions available to preview.</p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
