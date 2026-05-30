import React, { useState, useEffect, useRef, useCallback } from 'react';
import { RESIDENCY_SECTIONS, RESIDENCY_TOTAL, ResidencySection } from '../data/residencyData';
import { ArrowLeft, ArrowRight, RotateCcw, List, X, CheckCircle2, XCircle, BookOpen } from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface Props {
  onGoBack: () => void;
}

// Flatten all questions into a single array with section info
const ALL_QUESTIONS = RESIDENCY_SECTIONS.flatMap(sec =>
  sec.questions.map(q => ({ ...q, sectionId: sec.id, sectionTitle: sec.title }))
);

// Build section index map: sectionId → startIndex
const SECTION_START: Record<string, number> = {};
RESIDENCY_SECTIONS.forEach(s => { SECTION_START[s.id] = s.startIndex; });

function getActiveSectionIdx(globalIdx: number): number {
  let active = 0;
  for (let i = 0; i < RESIDENCY_SECTIONS.length; i++) {
    if (globalIdx >= RESIDENCY_SECTIONS[i].startIndex) active = i;
    else break;
  }
  return active;
}

export const ResidencyTestPage: React.FC<Props> = ({ onGoBack }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [responses, setResponses] = useState<Record<number, { chosen: number; correct: boolean }>>({} as Record<number, { chosen: number; correct: boolean }>);
  const [showToc, setShowToc] = useState(true);
  const tocRef = useRef<HTMLDivElement>(null);
  const activeTocRef = useRef<HTMLButtonElement>(null);

  const currentQ = ALL_QUESTIONS[currentIdx];
  const activeSectionIdx = getActiveSectionIdx(currentIdx);

  // Restore response if navigating back to answered question
  useEffect(() => {
    const prev = responses[currentIdx];
    if (prev) {
      setSelectedOpt(prev.chosen);
      setChecked(true);
    } else {
      setSelectedOpt(null);
      setChecked(false);
    }
  }, [currentIdx]);

  // Auto-scroll active TOC item into view
  useEffect(() => {
    activeTocRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [activeSectionIdx]);

  const handleSelect = (optIdx: number) => {
    if (checked) return;
    playClickSound();
    setSelectedOpt(optIdx);
    const correct = optIdx === currentQ.correctIndex;
    setChecked(true);
    setResponses(prev => ({ ...prev, [currentIdx]: { chosen: optIdx, correct } }));
    if (correct) playCorrectSound(); else playIncorrectSound();
  };

  const goTo = useCallback((idx: number) => {
    if (idx < 0 || idx >= RESIDENCY_TOTAL) return;
    playClickSound();
    setCurrentIdx(idx);
  }, []);

  const jumpToSection = (sec: ResidencySection) => {
    playClickSound();
    setCurrentIdx(sec.startIndex);
    if (window.innerWidth < 768) setShowToc(false);
  };

  const correctCount = Object.values(responses).filter((r) => (r as { chosen: number; correct: boolean }).correct).length;
  const answeredCount = Object.keys(responses).length;

  // Letter labels
  const letters = ['ა', 'ბ', 'გ', 'დ', 'ე', 'ვ', 'ზ'];

  return (
    <div className="flex h-full min-h-[calc(100vh-120px)] gap-0 relative">
      {/* ── Main test area ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
          <button
            onClick={onGoBack}
            className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:text-zinc-900 dark:hover:text-white transition"
          >
            <ArrowLeft className="w-4 h-4" /> უკან
          </button>
          <div className="text-center flex-1">
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-mono uppercase tracking-widest">G. Nanetashvili</p>
            <h2 className="text-sm font-bold text-zinc-800 dark:text-zinc-100 line-clamp-1">{currentQ.sectionTitle}</h2>
          </div>
          <button
            onClick={() => setShowToc(v => !v)}
            className="flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 transition"
          >
            <List className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">სარჩევი</span>
          </button>
        </div>

        {/* Progress bar */}
        <div className="mb-4">
          <div className="flex justify-between text-[10px] text-zinc-400 dark:text-zinc-500 font-mono mb-1">
            <span>კითხვა {currentIdx + 1} / {RESIDENCY_TOTAL}</span>
            <span>სწორი: {correctCount}/{answeredCount}</span>
          </div>
          <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-300"
              style={{ width: `${((currentIdx + 1) / RESIDENCY_TOTAL) * 100}%` }}
            />
          </div>
        </div>

        {/* Question card */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 sm:p-6 shadow-xs flex-1 flex flex-col gap-5">
          {/* Question text */}
          <div>
            <p className="text-[10px] text-indigo-500 dark:text-indigo-400 font-mono font-bold mb-2 uppercase tracking-wider">
              ორიგინალი კითხვა #{currentIdx + 1}
            </p>
            <p className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-100 leading-relaxed">
              {currentIdx + 1}. {currentQ.text}
            </p>
          </div>

          {/* Options */}
          <div className="flex flex-col gap-2.5">
            {currentQ.options.map((opt, i) => {
              const isCorrect = i === currentQ.correctIndex;
              const isSelected = i === selectedOpt;
              let style = 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-700 dark:text-zinc-200 hover:border-indigo-300 dark:hover:border-indigo-600 hover:bg-indigo-50 dark:hover:bg-indigo-950/30';
              if (checked) {
                if (isCorrect) style = 'border-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-200';
                else if (isSelected) style = 'border-rose-400 bg-rose-50 dark:bg-rose-950/40 text-rose-800 dark:text-rose-200';
                else style = 'border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/30 text-zinc-400 dark:text-zinc-500';
              }
              return (
                <button
                  key={i}
                  onClick={() => handleSelect(i)}
                  disabled={checked}
                  className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left text-sm font-medium transition-all cursor-pointer disabled:cursor-default ${style}`}
                >
                  <span className="shrink-0 w-6 h-6 rounded-md border border-current flex items-center justify-center text-[11px] font-bold">
                    {checked && isCorrect ? <CheckCircle2 className="w-4 h-4" /> : checked && isSelected && !isCorrect ? <XCircle className="w-4 h-4" /> : letters[i] || String.fromCharCode(65 + i)}
                  </span>
                  <span className="leading-relaxed pt-0.5">{opt}</span>
                </button>
              );
            })}
          </div>

          {/* Feedback */}
          {checked && (
            <div className={`text-xs font-semibold px-4 py-2.5 rounded-xl ${selectedOpt === currentQ.correctIndex ? 'bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300' : 'bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300'}`}>
              {selectedOpt === currentQ.correctIndex ? '✓ სწორია!' : `✗ სწორი პასუხი: ${letters[currentQ.correctIndex] || ''}) ${currentQ.options[currentQ.correctIndex]}`}
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between mt-4 gap-3">
          <button
            onClick={() => goTo(currentIdx - 1)}
            disabled={currentIdx === 0}
            className="flex items-center gap-1.5 px-4 py-2.5 border border-zinc-200 dark:border-zinc-700 rounded-xl text-xs font-semibold text-zinc-600 dark:text-zinc-300 hover:bg-zinc-50 dark:hover:bg-zinc-800 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <ArrowLeft className="w-4 h-4" /> წინა
          </button>

          <button
            onClick={() => { setSelectedOpt(null); setChecked(false); setResponses({}); setCurrentIdx(0); playClickSound(); }}
            className="flex items-center gap-1 px-3 py-2.5 text-xs font-semibold text-zinc-500 dark:text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200 transition"
            title="თავიდან"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={() => goTo(currentIdx + 1)}
            disabled={currentIdx === RESIDENCY_TOTAL - 1}
            className="flex items-center gap-1.5 px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            შემდეგი <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* ── TOC sidebar (right) ── */}
      {showToc && (
        <aside
          ref={tocRef}
          className="w-56 shrink-0 ml-4 hidden md:flex flex-col bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl shadow-xs overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-3 border-b border-zinc-100 dark:border-zinc-800">
            <span className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 uppercase tracking-widest flex items-center gap-1">
              <BookOpen className="w-3 h-3" /> სარჩევი
            </span>
            <button onClick={() => setShowToc(false)} className="text-zinc-400 dark:text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-300">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1 py-1">
            {RESIDENCY_SECTIONS.map((sec, i) => {
              const isActive = i === activeSectionIdx;
              const secAnswered = sec.questions.filter(q => responses[q.globalIndex]).length;
              const secCorrect = sec.questions.filter(q => responses[q.globalIndex]?.correct).length;
              return (
                <button
                  key={sec.id}
                  ref={isActive ? activeTocRef : undefined}
                  onClick={() => jumpToSection(sec)}
                  className={`w-full text-left px-3 py-2 text-[11px] leading-tight transition border-l-2 ${
                    isActive
                      ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                      : 'border-transparent text-zinc-600 dark:text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-800 hover:text-zinc-800 dark:hover:text-zinc-200'
                  }`}
                >
                  <span className="block">{sec.title}</span>
                  {secAnswered > 0 && (
                    <span className="text-[9px] font-mono text-zinc-400 dark:text-zinc-500">
                      {secCorrect}/{secAnswered} · {sec.questions.length}
                    </span>
                  )}
                  {secAnswered === 0 && (
                    <span className="text-[9px] font-mono text-zinc-300 dark:text-zinc-600">{sec.questions.length} კითხვა</span>
                  )}
                </button>
              );
            })}
          </div>
        </aside>
      )}

      {/* Mobile TOC overlay */}
      {showToc && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowToc(false)} />
          <aside className="relative ml-auto w-64 h-full bg-white dark:bg-zinc-900 flex flex-col shadow-xl">
            <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-zinc-800">
              <span className="text-xs font-bold text-zinc-700 dark:text-zinc-200">სარჩევი</span>
              <button onClick={() => setShowToc(false)}><X className="w-4 h-4 text-zinc-500" /></button>
            </div>
            <div className="overflow-y-auto flex-1 py-1">
              {RESIDENCY_SECTIONS.map((sec, i) => {
                const isActive = i === activeSectionIdx;
                return (
                  <button
                    key={sec.id}
                    ref={isActive ? activeTocRef : undefined}
                    onClick={() => jumpToSection(sec)}
                    className={`w-full text-left px-4 py-2.5 text-xs leading-snug border-l-2 transition ${
                      isActive
                        ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 font-bold'
                        : 'border-transparent text-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {sec.title}
                    <span className="block text-[10px] text-zinc-400 dark:text-zinc-500 font-mono">{sec.questions.length} კითხვა</span>
                  </button>
                );
              })}
            </div>
          </aside>
        </div>
      )}
    </div>
  );
};
