import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  RESIDENCY_SECTIONS, RESIDENCY_TOTAL,
  ResidencyQuestion, ResidencySection
} from '../data/residencyData';
import {
  ArrowLeft, RotateCcw, HelpCircle, Volume2, VolumeX,
  Shuffle, SortAsc, AlertTriangle, Eye, EyeOff,
  Scissors, Trash2, BarChart, Check, Clock,
  RefreshCw, SlidersHorizontal, X, List, Search
} from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface Props { onGoBack: () => void; }

type FlatQ = ResidencyQuestion & { sectionId: string; sectionTitle: string };

const ALL_FLAT: FlatQ[] = RESIDENCY_SECTIONS.flatMap(sec =>
  sec.questions.map(q => ({ ...q, sectionId: sec.id, sectionTitle: sec.title }))
);

function getActiveSectionIdx(globalIdx: number) {
  let active = 0;
  for (let i = 0; i < RESIDENCY_SECTIONS.length; i++) {
    if (globalIdx >= RESIDENCY_SECTIONS[i].startIndex) active = i;
    else break;
  }
  return active;
}

const formatTime = (s: number) =>
  `${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor((s % 3600) / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

export const ResidencyTestPage: React.FC<Props> = ({ onGoBack }) => {
  const [questions, setQuestions] = useState<FlatQ[]>(ALL_FLAT);
  const originalQuestions = ALL_FLAT;

  const [currentIdx, setCurrentIdx] = useState(0);
  const [jumpInput, setJumpInput] = useState('');
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [shuffledOptionsMapping, setShuffledOptionsMapping] = useState<number[] | null>(null);

  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [seconds, setSeconds] = useState(0);
  const [responses, setResponses] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});
  const [historicalWrongIds, setHistoricalWrongIds] = useState<string[]>([]);
  const [sessionWrongIds, setSessionWrongIds] = useState<string[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [mistakesSessionAnswers, setMistakesSessionAnswers] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});
  const [croppedIds, setCroppedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());

  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  const [searchCorrect, setSearchCorrect] = useState('');
  const [searchIncorrect, setSearchIncorrect] = useState('');

  const [soundEnabled, setSoundEnabled] = useState(false);
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [immediateShow, setImmediateShow] = useState(false);
  const [examMode, setExamMode] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [showToc, setShowToc] = useState(false);

  const activeTocRef = useRef<HTMLButtonElement>(null);

  const getClean = (t: string) => t.toLowerCase().trim();

  const activeQuestionsPool = questions
    .filter(q => !croppedIds.has(String(q.globalIndex)))
    .filter(q => !hiddenIds.has(String(q.globalIndex)))
    .filter(q => {
      if (onlyWrong) return historicalWrongIds.includes(String(q.globalIndex)) || !!mistakesSessionAnswers[String(q.globalIndex)];
      if (onlyFlagged) return flaggedIds.includes(String(q.globalIndex));
      return true;
    })
    .filter(q => {
      if (searchCorrect) return getClean(q.options[q.correctIndex] || '').includes(getClean(searchCorrect));
      if (searchIncorrect) return q.options.filter((_, i) => i !== q.correctIndex).some(o => getClean(o).includes(getClean(searchIncorrect)));
      return true;
    });

  const safeIdx = currentIdx >= 0 && currentIdx < activeQuestionsPool.length ? currentIdx : 0;
  const currentQ = activeQuestionsPool[safeIdx];
  const activeSectionIdx = currentQ ? getActiveSectionIdx(currentQ.globalIndex) : 0;

  useEffect(() => {
    if (activeQuestionsPool.length > 0 && currentIdx >= activeQuestionsPool.length) setCurrentIdx(0);
  }, [activeQuestionsPool.length, currentIdx]);

  useEffect(() => {
    if (!currentQ) return;
    const key = String(currentQ.globalIndex);
    const resp = onlyWrong ? mistakesSessionAnswers[key] : responses[key];
    if (resp) { setSelectedOpt(resp.chosenOptionIndex); setChecked(true); }
    else { setSelectedOpt(null); setChecked(false); }
    setShuffledOptionsMapping(null);
  }, [currentIdx, currentQ?.globalIndex]);

  useEffect(() => {
    const id = setInterval(() => setSeconds(s => s + 1), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    activeTocRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSectionIdx]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (document.activeElement?.tagName || '').toUpperCase();
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const key = e.key.toLowerCase();
      if (key === 'arrowright' || key === 'r' || key === 'კ') { e.preventDefault(); handleNext(); }
      else if (key === 'arrowleft' || key === 'e' || key === 'უ') { e.preventDefault(); handlePrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [currentIdx, activeQuestionsPool]);

  const handleNext = useCallback(() => {
    if (soundEnabled) playClickSound();
    if (currentIdx < activeQuestionsPool.length - 1) setCurrentIdx(i => i + 1);
  }, [currentIdx, activeQuestionsPool.length, soundEnabled]);

  const handlePrev = useCallback(() => {
    if (soundEnabled) playClickSound();
    if (currentIdx > 0) setCurrentIdx(i => i - 1);
  }, [currentIdx, soundEnabled]);

  const handleSelectOption = (realIdx: number) => {
    if (checked) return;
    if (soundEnabled) playClickSound();
    setSelectedOpt(realIdx);
    evaluateAnswer(realIdx);
  };

  const evaluateAnswer = (realIdx: number) => {
    if (!currentQ) return;
    const isCorrect = realIdx === currentQ.correctIndex;
    const key = String(currentQ.globalIndex);
    if (onlyWrong ? !!mistakesSessionAnswers[key] : !!responses[key]) return;
    if (soundEnabled) { isCorrect ? playCorrectSound() : playIncorrectSound(); }

    const entry = { chosenOptionIndex: realIdx, isCorrect };
    const nextResponses = onlyWrong ? responses : { ...responses, [key]: entry };
    if (onlyWrong) setMistakesSessionAnswers(p => ({ ...p, [key]: entry }));

    let nc = correctCount, nw = wrongCount;
    let nHW = [...historicalWrongIds], nSW = [...sessionWrongIds];
    const wasPrev = historicalWrongIds.includes(key);
    if (isCorrect) {
      nc++;
      if (wasPrev) { nHW = nHW.filter(id => id !== key); nSW = nSW.filter(id => id !== key); nw = Math.max(0, nw - 1); }
    } else {
      if (!wasPrev) nw++;
      if (!nHW.includes(key)) nHW.push(key);
      if (!nSW.includes(key)) nSW.push(key);
    }
    setResponses(nextResponses);
    setCorrectCount(nc); setWrongCount(nw);
    setSessionWrongIds(nSW); setHistoricalWrongIds(nHW);
    setChecked(true);
    if (autoAdvance) setTimeout(() => handleNext(), 800);
  };

  const toggleFlag = () => {
    if (!currentQ) return;
    const key = String(currentQ.globalIndex);
    setFlaggedIds(prev => prev.includes(key) ? prev.filter(id => id !== key) : [...prev, key]);
    playClickSound();
  };

  const shuffleQuestions = () => { playClickSound(); setQuestions([...questions].sort(() => Math.random() - 0.5)); setCurrentIdx(0); };
  const resetOrder = () => { playClickSound(); setQuestions([...originalQuestions]); setCurrentIdx(0); };
  const sortAlpha = () => { playClickSound(); setQuestions([...questions].sort((a, b) => a.text.localeCompare(b.text, 'ka-GE'))); setCurrentIdx(0); };
  const shuffleCurrentAnswers = () => {
    if (!currentQ) return;
    playClickSound();
    const size = currentQ.options.length;
    setShuffledOptionsMapping(Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5));
  };
  const exciseCurrent = () => {
    if (!currentQ) return;
    playClickSound();
    setCroppedIds(prev => new Set([...prev, String(currentQ.globalIndex)]));
    if (currentIdx < questions.length - 1) handleNext(); else if (currentIdx > 0) handlePrev();
  };
  const toggleHideCurrent = () => {
    if (!currentQ) return;
    playClickSound();
    const key = String(currentQ.globalIndex);
    setHiddenIds(prev => { const s = new Set(prev); s.has(key) ? s.delete(key) : s.add(key); return s; });
  };
  const handleJumpToNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const n = parseInt(jumpInput);
    if (!isNaN(n) && n >= 1 && n <= activeQuestionsPool.length) { setCurrentIdx(n - 1); setJumpInput(''); if (soundEnabled) playCorrectSound(); }
    else { alert(`1-დან ${activeQuestionsPool.length}-მდე`); setJumpInput(''); }
  };
  const resetAll = () => {
    if (!confirm('სესიის გასუფთავება?')) return;
    playClickSound();
    setCurrentIdx(0); setSelectedOpt(null); setChecked(false);
    setResponses({}); setCorrectCount(0); setWrongCount(0);
    setHistoricalWrongIds([]); setSessionWrongIds([]);
    setFlaggedIds([]); setMistakesSessionAnswers({});
    setCroppedIds(new Set()); setHiddenIds(new Set());
    setOnlyWrong(false); setOnlyFlagged(false);
    setSearchCorrect(''); setSearchIncorrect('');
    setQuestions([...originalQuestions]);
    setShowTools(false);
  };
  const jumpToSection = (sec: ResidencySection) => {
    playClickSound();
    const idx = activeQuestionsPool.findIndex(q => q.globalIndex >= sec.startIndex);
    if (idx >= 0) setCurrentIdx(idx);
    setShowToc(false);
  };

  const progressPercentage = Math.round((Object.keys(responses).length / originalQuestions.length) * 100);

  const displayOptions = currentQ
    ? (shuffledOptionsMapping ? shuffledOptionsMapping.map(i => currentQ.options[i]) : currentQ.options)
    : [];
  const correctDisplayIdx = currentQ
    ? (shuffledOptionsMapping ? shuffledOptionsMapping.indexOf(currentQ.correctIndex) : currentQ.correctIndex)
    : 0;

  if (activeQuestionsPool.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center space-y-4 max-w-md w-full shadow-lg font-sans">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="font-bold text-zinc-800 dark:text-zinc-100">კითხვები ვერ მოიძებნა</h3>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">ფილტრის პირობებს კითხვები ვერ შეესაბამება.</p>
          <button onClick={() => { setOnlyWrong(false); setOnlyFlagged(false); setSearchCorrect(''); setSearchIncorrect(''); setCroppedIds(new Set()); setHiddenIds(new Set()); }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition">
            ფილტრების გასუფთავება
          </button>
        </div>
      </div>
    );
  }

  const alphabetLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

  return (
    <div className="fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 p-2.5 sm:p-4 md:p-5 flex flex-col h-[100dvh] overflow-hidden font-sans">

      {/* ── Header ── */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-3 shadow-xs flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button onClick={onGoBack}
            className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl text-zinc-500 dark:text-zinc-400 transition cursor-pointer shrink-0">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <span className="block text-[9px] text-zinc-400 dark:text-zinc-500 uppercase font-bold tracking-wider">G. Nanetashvili • {currentQ?.sectionTitle}</span>
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 leading-tight truncate max-w-[140px] sm:max-w-[280px] md:max-w-none">
              რეზიდენტურის ტესტები
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <div className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg text-center">
            <span className="text-[10px] font-bold font-mono text-indigo-600 dark:text-indigo-400">{formatTime(seconds)}</span>
          </div>
          <div className="px-2.5 py-1 bg-zinc-50 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg text-center">
            <span className="text-[10px] font-semibold text-zinc-500 dark:text-zinc-400">დარჩა {activeQuestionsPool.length - (safeIdx + 1)}</span>
          </div>
          <button onClick={() => { setShowToc(true); playClickSound(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-xs">
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">სარჩევი</span>
          </button>
          <button onClick={() => { setShowTools(true); playClickSound(); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] font-bold transition cursor-pointer shadow-xs">
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">ფილტრები</span>
          </button>
        </div>
      </div>

      {/* ── Filter tabs ── */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl max-w-xl mx-auto w-full shrink-0 mt-2">
        {[
          { label: 'ყველა', count: questions.length, active: !onlyWrong && !onlyFlagged, color: 'indigo', action: () => { setOnlyWrong(false); setOnlyFlagged(false); setCurrentIdx(0); setMistakesSessionAnswers({}); } },
          { label: 'შეცდომები', count: historicalWrongIds.length, active: onlyWrong, color: 'rose', action: () => { setOnlyWrong(true); setOnlyFlagged(false); setCurrentIdx(0); setMistakesSessionAnswers({}); } },
          { label: 'მონიშნული', count: flaggedIds.length, active: onlyFlagged, color: 'amber', action: () => { setOnlyWrong(false); setOnlyFlagged(true); setCurrentIdx(0); setMistakesSessionAnswers({}); } },
        ].map(tab => (
          <button key={tab.label} onClick={() => { playClickSound(); tab.action(); }}
            className={`flex items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition cursor-pointer ${
              tab.active
                ? tab.color === 'indigo' ? 'bg-indigo-600 text-white shadow-xs'
                  : tab.color === 'rose' ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-amber-500 text-white shadow-xs'
                : 'text-zinc-500 dark:text-zinc-400 bg-white/45 dark:bg-zinc-950/20 hover:bg-white dark:hover:bg-zinc-950/50'
            }`}>
            {tab.label === 'შეცდომები' && <AlertTriangle className="w-3.5 h-3.5 text-rose-400" />}
            {tab.label === 'მონიშნული' && <HelpCircle className="w-3.5 h-3.5 text-amber-400" />}
            <span>{tab.label}</span>
            <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${tab.active ? 'bg-white/20 text-white' : tab.color === 'rose' ? 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300' : tab.color === 'amber' ? 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300' : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'}`}>
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      {/* ── Question card ── */}
      <div className="flex-1 min-h-0 w-full max-w-4xl mx-auto mt-2 sm:mt-3">
        {currentQ && (
          <div className="flex-1 h-full bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between overflow-hidden">

            {/* Scrollable area */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">

              {/* Question header */}
              <div className="space-y-1.5 shrink-0 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                    <HelpCircle className="w-3.5 h-3.5" />
                    ორიგინალი კითხვა #{currentQ.origNum}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {flaggedIds.includes(String(currentQ.globalIndex)) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400 text-[9px] font-black">მონიშნული</span>
                    )}
                  </div>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-100 leading-relaxed">
                  {currentQ.text}
                </h3>
              </div>

              {/* Options */}
              <div className="space-y-2 pb-2">
                {displayOptions.map((opt, idx) => {
                  const realIdx = shuffledOptionsMapping ? shuffledOptionsMapping[idx] : idx;
                  const isSelected = selectedOpt === realIdx;
                  const isCorrectIdx = realIdx === currentQ.correctIndex;

                  let tileClass = 'border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-950 text-zinc-800 dark:text-zinc-100';
                  if (isSelected && !checked) tileClass = 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 ring-2 ring-indigo-500/20';
                  if (checked) {
                    if (isCorrectIdx) tileClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold ring-2 ring-emerald-500/20';
                    else if (isSelected) tileClass = 'border-rose-500 bg-rose-50/55 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20';
                  }
                  if (immediateShow && isCorrectIdx) tileClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold';

                  return (
                    <button key={idx} onClick={() => handleSelectOption(realIdx)}
                      className={`w-full p-3 border rounded-xl text-left text-xs sm:text-sm flex items-start gap-2.5 transition cursor-pointer ${tileClass}`}>
                      <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold rounded-md uppercase font-mono mt-0.5 shrink-0">
                        {alphabetLabels[idx] || (idx + 1)}
                      </span>
                      <span className="leading-relaxed">{opt}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback */}
              {checked && !examMode && (
                <div className="flex flex-col items-center justify-center py-2 border-t border-zinc-100/50 dark:border-zinc-800 animate-in zoom-in-95 duration-200 shrink-0">
                  {selectedOpt === currentQ.correctIndex ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-4xl select-none">✅</span>
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-wider">სწორია!</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-4xl select-none">❌</span>
                      <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase tracking-wider">არასწორია!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom nav */}
            <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] sm:text-xs text-zinc-400 dark:text-zinc-500 font-bold">
                  <span>კითხვა {safeIdx + 1} / {activeQuestionsPool.length}</span>
                  <span>პროგრესი: {progressPercentage}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div className="bg-indigo-600 dark:bg-indigo-500 h-1.5 transition-all duration-300"
                    style={{ width: `${((safeIdx + 1) / activeQuestionsPool.length) * 100}%` }} />
                </div>
              </div>

              <div className="flex items-center justify-between gap-3 pt-0.5">
                <button onClick={handlePrev} disabled={currentIdx === 0}
                  className="px-4 py-2.5 sm:px-6 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-40 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 rounded-xl transition cursor-pointer flex items-center gap-1">
                  ◀ წინა
                </button>
                <div className="flex gap-2 items-center">
                  <button onClick={handleNext} disabled={currentIdx === activeQuestionsPool.length - 1}
                    className="px-5 py-2.5 sm:px-8 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 text-xs sm:text-sm font-bold text-white rounded-xl transition cursor-pointer flex items-center gap-1 shadow-md">
                    შემდეგი ▶
                  </button>
                  <button onClick={toggleFlag}
                    className={`p-2.5 border rounded-xl transition cursor-pointer ${
                      flaggedIds.includes(String(currentQ.globalIndex))
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-600'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 dark:text-zinc-500 hover:bg-zinc-50 dark:hover:bg-zinc-950'
                    }`} title="მონიშვნა">
                    <HelpCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── TOC Modal ── */}
      {showToc && (
        <div className="fixed inset-0 z-50 flex bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="ml-auto w-72 h-full bg-white dark:bg-zinc-900 rounded-2xl flex flex-col shadow-2xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800 shrink-0">
              <span className="text-sm font-bold text-zinc-800 dark:text-zinc-100">სარჩევი</span>
              <button onClick={() => setShowToc(false)}><X className="w-4 h-4 text-zinc-400" /></button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {RESIDENCY_SECTIONS.map((sec, i) => {
                const isActive = i === activeSectionIdx;
                const secAnswered = sec.questions.filter(q => responses[String(q.globalIndex)]).length;
                const secCorrect = sec.questions.filter(q => responses[String(q.globalIndex)]?.isCorrect).length;
                return (
                  <button key={sec.id}
                    ref={isActive ? activeTocRef : undefined}
                    onClick={() => jumpToSection(sec)}
                    className={`w-full text-left px-4 py-2.5 text-xs leading-snug border-l-2 transition ${isActive ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold' : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800'}`}>
                    <span className="block font-semibold">{sec.title}</span>
                    <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500">
                      {secAnswered > 0 ? `${secCorrect}/${secAnswered} სწ. · ` : ''}{sec.questions.length} კ.
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Tools modal ── */}
      {showTools && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-5 flex flex-col max-h-[90vh] overflow-hidden font-sans">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-500" /> ხელსაწყოები და ფილტრები
              </h3>
              <button onClick={() => setShowTools(false)}
                className="p-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-lg text-zinc-400 dark:text-zinc-500 transition cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-5 overflow-y-auto pr-1 flex-1">
              {/* Stats */}
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 border border-zinc-150 dark:border-zinc-800 space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">სესია და შედეგები</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 border border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 text-emerald-600 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 uppercase">სწორი</span>
                    <span className="text-base font-bold font-mono">{correctCount}</span>
                  </div>
                  <div className="p-2 border border-rose-100 dark:border-rose-950 bg-rose-50/20 text-rose-600 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 uppercase">არასწორი</span>
                    <span className="text-base font-bold font-mono">{wrongCount}</span>
                  </div>
                  <div className="p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/40 text-zinc-600 dark:text-zinc-300 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 uppercase">სიზუსტე</span>
                    <span className="text-base font-bold font-mono">{correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%</span>
                  </div>
                </div>
              </div>

              {/* Settings */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">მართვის პარამეტრები</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-150 dark:border-zinc-800 cursor-pointer text-xs transition">
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">ავტომატური გადასვლა</span>
                    <input type="checkbox" checked={autoAdvance} onChange={e => setAutoAdvance(e.target.checked)} className="rounded-sm accent-indigo-600 cursor-pointer" />
                  </label>
                  <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-150 dark:border-zinc-800 cursor-pointer text-xs transition">
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">ხმა</span>
                    <input type="checkbox" checked={soundEnabled} onChange={e => setSoundEnabled(e.target.checked)} className="rounded-sm accent-indigo-600 cursor-pointer" />
                  </label>
                  <button onClick={() => setImmediateShow(v => !v)}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-150 dark:border-zinc-800 text-xs text-left transition cursor-pointer">
                    <div className="flex items-center gap-1.5 font-bold text-zinc-700 dark:text-zinc-200">
                      {immediateShow ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
                      <span>პასუხების ჩვენება</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{immediateShow ? 'კი' : 'არა'}</span>
                  </button>
                  <button onClick={() => setExamMode(v => !v)}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-150 dark:border-zinc-800 text-xs transition cursor-pointer">
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">საიმიტაციო გამოცდა</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${examMode ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>{examMode ? 'ჩართ.' : 'გამ.'}</span>
                  </button>
                  <button onClick={resetAll}
                    className="flex items-center justify-between p-3 bg-rose-50/40 hover:bg-rose-50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 rounded-xl border border-rose-200/50 dark:border-rose-900/30 text-xs font-bold transition cursor-pointer col-span-1 sm:col-span-2">
                    <span>სესიის გასუფთავება</span>
                    <RotateCcw className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">მოქმედებები კითხვებზე</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  {[
                    { icon: <Shuffle className="w-4 h-4 text-indigo-500" />, label: 'ბაზის არევა', action: shuffleQuestions },
                    { icon: <RotateCcw className="w-4 h-4 text-indigo-500" />, label: 'თავდაპ. რიგი', action: resetOrder },
                    { icon: <Shuffle className="w-4 h-4 text-emerald-500" />, label: 'პასუხ. არევა', action: shuffleCurrentAnswers },
                    { icon: <SortAsc className="w-4 h-4 text-amber-500" />, label: 'A-Z სორტ.', action: sortAlpha },
                    { icon: <Scissors className="w-4 h-4 text-zinc-500" />, label: 'ამოჭრა', action: exciseCurrent },
                    { icon: <Trash2 className="w-4 h-4 text-zinc-500" />, label: 'დამალვა', action: toggleHideCurrent },
                  ].map(btn => (
                    <button key={btn.label} onClick={() => { btn.action(); }}
                      className="flex flex-col items-center justify-center p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-100 dark:border-zinc-800 transition gap-1 text-[11px] cursor-pointer">
                      {btn.icon}{btn.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Search */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">ძებნა</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block">სწორ პასუხებში:</span>
                    <div className="relative">
                      <input type="text" value={searchCorrect} onChange={e => { setSearchCorrect(e.target.value); setCurrentIdx(0); }} placeholder="ტექსტი..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-none" />
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 dark:text-zinc-500 font-semibold block">არასწორ პასუხებში:</span>
                    <div className="relative">
                      <input type="text" value={searchIncorrect} onChange={e => { setSearchIncorrect(e.target.value); setCurrentIdx(0); }} placeholder="ტექსტი..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-none" />
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                    </div>
                  </div>
                </div>
              </div>

              {/* Jump */}
              <div className="space-y-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 dark:text-zinc-400 font-semibold">გადასვლა ნომერზე:</span>
                <form onSubmit={e => { handleJumpToNumber(e); setShowTools(false); }} className="flex gap-2 w-full">
                  <input type="number" min={1} max={activeQuestionsPool.length} value={jumpInput} onChange={e => setJumpInput(e.target.value)}
                    placeholder={`1–${activeQuestionsPool.length}`}
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 focus:ring-1 focus:ring-indigo-500 outline-none" />
                  <button type="submit" className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition cursor-pointer">გადასვლა</button>
                </form>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-150 dark:border-zinc-800">
              <button onClick={() => setShowTools(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer">
                შენახვა და დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
