import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, getDoc, setDoc, onSnapshot, collection, getDocs } from 'firebase/firestore';
import { localGetTest, localGetQuestions, localGetTestProgress, localSaveProgress } from '../utils/localStore';
import { useFirebase } from './FirebaseProvider';
import { Question, UserProgress, TestMetadata } from '../types';
import { 
  ArrowLeft, 
  RotateCcw, 
  HelpCircle, 
  Volume2, 
  VolumeX, 
  Shuffle, 
  SortAsc, 
  Download, 
  Search, 
  AlertTriangle, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  Scissors, 
  Trash2, 
  BarChart, 
  Check, 
  Clock, 
  HelpCircle as QuestionIcon,
  RefreshCw,
  Info,
  SlidersHorizontal,
  X
} from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface TestPracticePageProps {
  testId: string;
  onGoBack: () => void;
  initialResume?: boolean;
}

export const TestPracticePage: React.FC<TestPracticePageProps> = ({ testId, onGoBack, initialResume = false }) => {
  const { user, isLocalUser } = useFirebase();
  const [test, setTest] = useState<TestMetadata | null>(null);
  const [originalQuestions, setOriginalQuestions] = useState<Question[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);

  // Practice state
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selectedOpt, setSelectedOpt] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [soundEnabled, setSoundEnabled] = useState(false); // Default to false (Sound disabled)
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [immediateShow, setImmediateShow] = useState(false);
  const [examMode, setExamMode] = useState(false); // practice vs simulated exam mode
  const [showTools, setShowTools] = useState(false); // Tools / Settings Modal Toggle

  // Custom question filters and modifications
  const [croppedIds, setCroppedIds] = useState<Set<string>>(new Set()); // list of hidden ids
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(new Set());
  const [shuffledOptionsMapping, setShuffledOptionsMapping] = useState<number[] | null>(null);
  const [onlyWrong, setOnlyWrong] = useState(false);
  const [onlySessionWrong, setOnlySessionWrong] = useState(false);
  const [onlyFlagged, setOnlyFlagged] = useState(false);
  
  const [searchCorrect, setSearchCorrect] = useState('');
  const [searchIncorrect, setSearchIncorrect] = useState('');
  const [diacriticsMode, setDiacriticsMode] = useState(true);

  // Session results trackers
  const [correctCount, setCorrectCount] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [sessionWrongIds, setSessionWrongIds] = useState<string[]>([]);
  const [historicalWrongIds, setHistoricalWrongIds] = useState<string[]>([]);
  const [flaggedIds, setFlaggedIds] = useState<string[]>([]);
  const [responses, setResponses] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});
  const [mistakesSessionAnswers, setMistakesSessionAnswers] = useState<Record<string, { chosenOptionIndex: number; isCorrect: boolean }>>({});

  // Navigation jumping
  const [jumpInput, setJumpInput] = useState('');

  // Resume State prompts
  const [showPrompt, setShowPrompt] = useState(false);
  const [pendingProgress, setPendingProgress] = useState<UserProgress | null>(null);

  // Textual searching & Diacritics Spell Normalization
  const getCleanText = (text: string | null | undefined) => {
    if (!text) return '';
    return text.toLowerCase().trim();
  };

  // ----------------------------------------------------
  // FILTER MODES
  // ----------------------------------------------------
  const activeQuestionsPool = questions
    .filter(q => q && q.id)
    .filter(q => !croppedIds.has(q.id))
    .filter(q => !hiddenIds.has(q.id))
    .filter(q => {
      if (onlyWrong) {
         return historicalWrongIds.includes(q.id) || !!mistakesSessionAnswers[q.id];
      }
      if (onlySessionWrong) {
        return sessionWrongIds.includes(q.id);
      }
      if (onlyFlagged) {
        return flaggedIds.includes(q.id);
      }
      return true;
    })
    .filter(q => {
      if (!q.options) return false;
      // search in corrects correct answer
      if (searchCorrect) {
        const correctText = q.options[q.correctOptionIndex] || '';
        return getCleanText(correctText).includes(getCleanText(searchCorrect));
      }
      // search in incorrect answers
      if (searchIncorrect) {
        const incorrects = q.options.filter((_, i) => i !== q.correctOptionIndex).join(' ');
        return getCleanText(incorrects).includes(getCleanText(searchIncorrect));
      }
      return true;
    });

  const safeCurrentIdx = (currentIdx >= 0 && currentIdx < activeQuestionsPool.length) ? currentIdx : 0;
  const currentQ = activeQuestionsPool[safeCurrentIdx];

  // Sync index to bounds in case the pool size changes dynamically
  useEffect(() => {
    if (activeQuestionsPool.length > 0 && currentIdx >= activeQuestionsPool.length) {
      setCurrentIdx(0);
    }
  }, [activeQuestionsPool.length, currentIdx]);

  // Load and sync answers dynamically when current question changes
  useEffect(() => {
    if (currentQ) {
      if (onlyWrong) {
        const mistakeResp = mistakesSessionAnswers[currentQ.id];
        if (mistakeResp) {
          setSelectedOpt(mistakeResp.chosenOptionIndex);
          setChecked(true);
        } else {
          setSelectedOpt(null);
          setChecked(false);
        }
      } else {
        const response = responses[currentQ.id];
        if (response) {
          setSelectedOpt(response.chosenOptionIndex);
          setChecked(true);
        } else {
          setSelectedOpt(null);
          setChecked(false);
        }
      }
      setShuffledOptionsMapping(null);
    }
  }, [currentIdx, currentQ, responses, onlyWrong, mistakesSessionAnswers]);

  // Elapsed Timer effect
  useEffect(() => {
    const interval = setInterval(() => {
      setSeconds(prev => prev + 1);
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // Keyboard navigation listener (ArrowRight/R for forward, ArrowLeft/E for backward)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const activeEl = document.activeElement;
      if (activeEl) {
        const tagName = activeEl.tagName.toUpperCase();
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || activeEl.getAttribute('contenteditable') === 'true') {
          return;
        }
      }

      const key = e.key.toLowerCase();
      if (key === 'arrowright' || key === 'r' || key === 'კ') {
        e.preventDefault();
        if (currentIdx < activeQuestionsPool.length - 1) {
          const nextIdx = currentIdx + 1;
          setCurrentIdx(nextIdx);
          saveProgressToServer(nextIdx);
        }
      } else if (key === 'arrowleft' || key === 'e' || key === 'უ') {
        e.preventDefault();
        if (currentIdx > 0) {
          const prevIdx = currentIdx - 1;
          setCurrentIdx(prevIdx);
          saveProgressToServer(prevIdx);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIdx, activeQuestionsPool, responses]);

  // Fetch Test data
  useEffect(() => {
    const fetchTestData = async () => {
      try {
        if (isLocalUser) {
          const meta = localGetTest(testId);
          if (!meta) { alert('ტესტი ვერ მოიძებნა'); onGoBack(); return; }
          setTest(meta);
          const qList = localGetQuestions(testId).sort((a, b) => a.originalIndex - b.originalIndex);
          setOriginalQuestions(qList);
          setQuestions(qList);
          if (user) {
            const prog = localGetTestProgress(testId, user.uid);
            if (prog) { setPendingProgress(prog); setShowPrompt(true); } else { setLoading(false); }
          } else {
            setLoading(false);
          }
          return;
        }

        // Fetch Metadata from Firestore
        const testSnap = await getDoc(doc(db, 'tests', testId));
        if (!testSnap.exists()) {
          alert('ტესტი ვერ მოიძებნა');
          onGoBack();
          return;
        }
        const meta = testSnap.data() as TestMetadata;
        setTest(meta);

        // Fetch Questions
        const qSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
        const qList: Question[] = [];
        qSnap.forEach((doc) => {
          qList.push(doc.data() as Question);
        });
        qList.sort((a, b) => a.originalIndex - b.originalIndex);
        setOriginalQuestions(qList);
        setQuestions(qList);

        // Check user progress in Firestore
        if (user) {
          const pSnap = await getDoc(doc(db, 'progress', `${testId}_${user.uid}`));
          if (pSnap.exists()) {
            const prog = pSnap.data() as UserProgress;
            setPendingProgress(prog);
            setShowPrompt(true);
          } else {
            setLoading(false);
          }
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error(err);
        alert('მონაცემების ჩატვირთვა ჩაიშალა');
        onGoBack();
      }
    };

    fetchTestData();
  }, [testId, user, isLocalUser]);

  // Handle Resume Progress actions
  const handleResumeDecision = (resume: boolean) => {
    playClickSound();
    if (resume && pendingProgress) {
      setCurrentIdx(pendingProgress.currentQuestionIndex || 0);
      setSeconds(pendingProgress.timeSpent || 0);
      setResponses(pendingProgress.responses || {});
      setFlaggedIds(pendingProgress.flaggedQuestions || []);
      setHistoricalWrongIds(pendingProgress.wrongQuestions || []);
      setCorrectCount(pendingProgress.correctCount || 0);
      setWrongCount(pendingProgress.wrongCount || 0);
    } else {
      // restart: clear progress document in Firestore
      saveProgressToServer(0, 0, 0, [], [], {});
    }
    setShowPrompt(false);
    setLoading(false);
  };

  // Save Progress to database helper
  const saveProgressToServer = async (
    targetIdx: number = currentIdx,
    corr: number = correctCount,
    wrg: number = wrongCount,
    histWrgs: string[] = historicalWrongIds,
    flags: string[] = flaggedIds,
    resps: any = responses
  ) => {
    if (!user) return;
    const progressPayload: UserProgress = {
      id: `${testId}_${user.uid}`,
      testId: testId,
      userId: user.uid,
      currentQuestionIndex: targetIdx,
      answeredCount: Object.keys(resps).length,
      correctCount: corr,
      wrongCount: wrg,
      updatedAt: new Date().toISOString(),
      timeSpent: seconds,
      isCompleted: Object.keys(resps).length === originalQuestions.length,
      wrongQuestions: histWrgs,
      flaggedQuestions: flags,
      responses: resps
    };
    try {
      if (isLocalUser) {
        localSaveProgress(progressPayload);
      } else {
        await setDoc(doc(db, 'progress', `${testId}_${user.uid}`), progressPayload);
      }
    } catch (err) {
      console.warn('Could not back up progress: ', err);
    }
  };

  // Option Picker
  const handleSelectOption = (index: number) => {
    if (checked) return; // already evaluated/checked
    if (soundEnabled) playClickSound();
    setSelectedOpt(index);
    evaluateAnswer(index);
  };

  // Evaluate final Correctness
  const evaluateAnswer = (optionIdx: number) => {
    if (!currentQ) return;

    const isCorrect = optionIdx === currentQ.correctOptionIndex;
    const qSeedId = currentQ.id;

    // Check if we already answered this question
    const alreadyAnswered = !onlyWrong ? !!responses[qSeedId] : !!mistakesSessionAnswers[qSeedId];
    if (alreadyAnswered) return;

    // Trigger sounds
    if (soundEnabled) {
      if (isCorrect) playCorrectSound();
      else playIncorrectSound();
    }

    // Capture response mapping
    const nextResponses = {
      ...responses,
      [qSeedId]: { chosenOptionIndex: optionIdx, isCorrect: isCorrect }
    };

    if (onlyWrong) {
      setMistakesSessionAnswers(prev => ({
        ...prev,
        [qSeedId]: { chosenOptionIndex: optionIdx, isCorrect: isCorrect }
      }));
    }

    let nextCorrect = correctCount;
    let nextWrong = wrongCount;
    let nextHistWrgs = [...historicalWrongIds];
    let nextSessionWrgs = [...sessionWrongIds];

    const wasWrongPreviously = historicalWrongIds.includes(qSeedId);

    if (isCorrect) {
      nextCorrect++;
      if (wasWrongPreviously) {
        // Corrected a previous mistake!
        nextHistWrgs = nextHistWrgs.filter(id => id !== qSeedId);
        nextSessionWrgs = nextSessionWrgs.filter(id => id !== qSeedId);
        // Correct the wrongCount as we now fixed it and got it right
        nextWrong = Math.max(0, nextWrong - 1);
      }
    } else {
      // If it wasn't wrong previously, we increment wrong count
      if (!wasWrongPreviously) {
        nextWrong++;
      }
      if (!nextHistWrgs.includes(qSeedId)) nextHistWrgs.push(qSeedId);
      if (!nextSessionWrgs.includes(qSeedId)) nextSessionWrgs.push(qSeedId);
    }

    setResponses(nextResponses);
    setCorrectCount(nextCorrect);
    setWrongCount(nextWrong);
    setSessionWrongIds(nextSessionWrgs);
    setHistoricalWrongIds(nextHistWrgs);
    setChecked(true);

    // Auto backup progress
    saveProgressToServer(currentIdx, nextCorrect, nextWrong, nextHistWrgs, flaggedIds, nextResponses);

    // Auto-advance
    if (autoAdvance) {
      setTimeout(() => handleNext(), 800);
    }
  };

  // Allows user to reset and retry a specific question
  const handleRetryQuestion = (qId: string) => {
    if (soundEnabled) playClickSound();
    const response = responses[qId];
    if (!response) return;

    const wasCorrect = response.isCorrect;
    const updatedResponses = { ...responses };
    delete updatedResponses[qId];
    setResponses(updatedResponses);

    // Adjust counters
    const newCorr = wasCorrect ? Math.max(0, correctCount - 1) : correctCount;
    const newWrg = !wasCorrect ? Math.max(0, wrongCount - 1) : wrongCount;
    
    setCorrectCount(newCorr);
    setWrongCount(newWrg);

    setSelectedOpt(null);
    setChecked(false);

    saveProgressToServer(currentIdx, newCorr, newWrg, historicalWrongIds, flaggedIds, updatedResponses);
  };

  // Navigation Buttons
  const handleNext = () => {
    if (soundEnabled) playClickSound();
    if (currentIdx < activeQuestionsPool.length - 1) {
      const nextId = currentIdx + 1;
      setCurrentIdx(nextId);
      saveProgressToServer(nextId);
    }
  };

  const handlePrev = () => {
    if (soundEnabled) playClickSound();
    if (currentIdx > 0) {
      const prevId = currentIdx - 1;
      setCurrentIdx(prevId);
      saveProgressToServer(prevId);
    }
  };

  const handleJumpToNumber = (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseInt(jumpInput);
    if (!isNaN(parsed) && parsed >= 1 && parsed <= activeQuestionsPool.length) {
      const target = parsed - 1;
      setCurrentIdx(target);
      setJumpInput('');
      saveProgressToServer(target);
      if (soundEnabled) playCorrectSound();
    } else {
      alert(`გთხოვთ შეიყვანოთ რიცხვი 1-დან ${activeQuestionsPool.length}-მდე`);
      setJumpInput('');
      if (soundEnabled) playIncorrectSound();
    }
  };

  // Mute toggle
  const toggleSound = () => {
    setSoundEnabled(!soundEnabled);
    playClickSound();
  };

  // Flag/Bookmark question for review
  const toggleFlagQuestion = () => {
    const qId = questions[currentIdx]?.id;
    if (!qId) return;

    let nextFlags = [];
    if (flaggedIds.includes(qId)) {
      nextFlags = flaggedIds.filter(id => id !== qId);
    } else {
      nextFlags = [...flaggedIds, qId];
    }
    setFlaggedIds(nextFlags);
    saveProgressToServer(currentIdx, correctCount, wrongCount, historicalWrongIds, nextFlags, responses);
    playClickSound();
  };

  // ----------------------------------------------------
  // EXTRA EXAMINATION OPERATIONAL TOOLS inside the test
  // ----------------------------------------------------

  // 1. Shuffling Questions Pool
  const shuffleQuestions = () => {
    playClickSound();
    const shuffled = [...questions].sort(() => Math.random() - 0.5);
    setQuestions(shuffled);
    setCurrentIdx(0);
  };

  const resetQuestionsOrder = () => {
    playClickSound();
    setQuestions([...originalQuestions]);
    setCurrentIdx(0);
  };

  // 2. Sorting Alphabetically A-Z based on questionText
  const sortQuestionsAlphabetically = () => {
    playClickSound();
    const sorted = [...questions].sort((a,b) => a.questionText.localeCompare(b.questionText, 'ka-GE'));
    setQuestions(sorted);
    setCurrentIdx(0);
  };

  // 3. Shuffling Options layout internally inside target current question
  const shuffleCurrentAnswers = () => {
    playClickSound();
    const currentQ = questions[currentIdx];
    if (!currentQ) return;
    const size = currentQ.options.length;
    // create a shuffled index mapping array
    const indices = Array.from({ length: size }, (_, i) => i).sort(() => Math.random() - 0.5);
    setShuffledOptionsMapping(indices);
  };

  // 4. Download / Export Test back to raw TXT format
  const exportTestToTxt = () => {
    playClickSound();
    let textOut = '';
    originalQuestions.forEach((q) => {
      textOut += `//// ${q.questionText}\n\n`;
      q.options.forEach((opt, idx) => {
        if (idx === q.correctOptionIndex) {
          textOut += `// ${opt}\n`;
        } else {
          textOut += `/// ${opt}\n`;
        }
      });
      textOut += '\n';
    });

    const fileBlob = new Blob([textOut], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(fileBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${test?.title || 'test_export'}.txt`;
    link.click();
    URL.revokeObjectURL(url);
    playCorrectSound();
  };

  // 5. CROP/EXCISE chosen question permanently from active session pool
  const exciseCurrentQuestion = () => {
    playClickSound();
    const currentQ = questions[currentIdx];
    if (!currentQ) return;
    setCroppedIds(prev => {
      const next = new Set(prev);
      next.add(currentQ.id);
      return next;
    });
    // move next or prev
    if (currentIdx < questions.length - 1) {
      handleNext();
    } else if (currentIdx > 0) {
      handlePrev();
    } else {
      onGoBack();
    }
  };

  // 6. TEMP HIDE Question
  const toggleHideCurrentQuestion = () => {
    playClickSound();
    const currentQ = questions[currentIdx];
    if (!currentQ) return;
    setHiddenIds(prev => {
      const next = new Set(prev);
      if (next.has(currentQ.id)) next.delete(currentQ.id);
      else next.add(currentQ.id);
      return next;
    });
  };

  // Answers positions allocation statistics (A%, B%, C%, D% ratio calculations)
  const getAnswersPositionStatistics = () => {
    let aCount = 0;
    let bCount = 0;
    let cCount = 0;
    let dCount = 0;
    let otherCount = 0;
    
    questions.forEach((q) => {
      if (q.correctOptionIndex === 0) aCount++;
      else if (q.correctOptionIndex === 1) bCount++;
      else if (q.correctOptionIndex === 2) cCount++;
      else if (q.correctOptionIndex === 3) dCount++;
      else otherCount++;
    });

    const total = questions.length || 1;
    return {
      A: Math.round((aCount / total) * 100),
      B: Math.round((bCount / total) * 100),
      C: Math.round((cCount / total) * 100),
      D: Math.round((dCount / total) * 100),
    };
  };

  // Format Elapsed Time Timer display
  const formatTime = (secs: number) => {
    const h = Math.floor(secs / 3600);
    const m = Math.floor((secs % 3600) / 60);
    const s = secs % 60;
    return [
      h > 0 ? h.toString().padStart(2, '0') : null,
      m.toString().padStart(2, '0'),
      s.toString().padStart(2, '0')
    ].filter(Boolean).join(':');
  };

  if (loading && !showPrompt) {
    return (
      <div className="flex flex-col items-center justify-center py-24 font-sans">
        <RefreshCw className="w-10 h-10 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400 font-sans text-xs">მიმდინარეობს ტესტირების გარემოს მომზადება...</p>
      </div>
    );
  }

  // Handle zero questions matching filters
  if (activeQuestionsPool.length === 0) {
    return (
      <div className="fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 p-4 flex items-center justify-center h-[100dvh]">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 sm:p-10 text-center space-y-4 max-w-md w-full shadow-lg font-sans">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto" />
          <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-150">შესაბამისი კითხვები ვერ მოიძებნა</h3>
          <p className="text-xs text-zinc-500 leading-relaxed">თქვენს მიერ შერჩეული ფილტრებით (ძებნა, მხოლოდ შეცდომები ან მონიშნულები) აქტიურ სესიაში კითხვები მოცემული არაა.</p>
          <button
            onClick={() => {
              playClickSound();
              setCroppedIds(new Set());
              setHiddenIds(new Set());
              setOnlyWrong(false);
              setOnlySessionWrong(false);
              setOnlyFlagged(false);
              setSearchCorrect('');
              setSearchIncorrect('');
              setMistakesSessionAnswers({});
            }}
            className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
          >
            ფილტრების გასუფთავება
          </button>
        </div>
      </div>
    );
  }

  const progressPercentage = Math.round((Object.keys(responses).length / originalQuestions.length) * 100);
  const positionStats = getAnswersPositionStatistics();

  return (
    <div id="test-practice-page" className="fixed inset-0 z-40 bg-zinc-50 dark:bg-zinc-950 p-2.5 sm:p-4 md:p-5 flex flex-col h-[100dvh] overflow-hidden">
      
      {/* Resume Dialog Prompt */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-lg space-y-4 font-sans animate-in zoom-in-95 duration-200">
            <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-100 flex items-center gap-2">
              <Clock className="w-5 h-5 text-indigo-500" />
              გსურთ გაგრძელება?
            </h3>
            <p className="text-xs text-zinc-500 leading-relaxed">
              ნაპოვნია აქტიური სესიის ისტორია. გსურთ გააგრძელოთ იქიდან, სადაც შეჩერდით თუ დაიწყოთ თავიდან ახალი სესია?
            </p>
            <div className="flex gap-2 text-xs font-bold pt-2 justify-end">
              <button
                onClick={() => handleResumeDecision(false)}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-350 rounded-xl hover:bg-zinc-55 dark:hover:bg-zinc-950 transition cursor-pointer"
              >
                თავიდან დაწყება
              </button>
              <button
                onClick={() => handleResumeDecision(true)}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl transition cursor-pointer"
              >
                გაგრძელება
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Board Header */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-2.5 sm:p-3 shadow-xs flex flex-row items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            onClick={onGoBack}
            className="p-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-xl text-zinc-500 transition cursor-pointer shrink-0"
            title="გამოსვლა"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="min-w-0">
            <span className="block text-[8px] sm:text-[9px] text-zinc-400 font-sans uppercase font-bold tracking-wider">გამოცდის რეჟიმი</span>
            <h2 className="text-sm sm:text-base font-bold text-zinc-800 dark:text-zinc-150 font-sans leading-tight truncate max-w-[125px] xs:max-w-[180px] sm:max-w-[320px] md:max-w-none">{test?.title}</h2>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2.5 justify-end shrink-0 ml-auto">
          {/* Compact timers */}
          <div className="flex items-center gap-1.5">
            <div className="p-1 px-2.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg font-sans text-center shrink-0">
              <span className="text-[10px] sm:text-xs font-bold font-mono text-indigo-600 dark:text-indigo-400">{formatTime(seconds)}</span>
            </div>

            <div className="p-1 px-2.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg font-sans text-center shrink-0">
              <span className="text-[10px] sm:text-xs font-semibold text-zinc-500 font-sans">დარჩა {activeQuestionsPool.length - (currentIdx + 1)}</span>
            </div>
          </div>

          <button
            onClick={() => setShowTools(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-zinc-100 hover:bg-zinc-195 dark:bg-zinc-800 dark:hover:bg-zinc-700 text-zinc-800 dark:text-zinc-200 border border-zinc-200 dark:border-zinc-700 rounded-lg text-[10px] sm:text-xs font-bold transition font-sans cursor-pointer shadow-xs"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
            <span className="hidden xs:inline">ფილტრები</span>
          </button>
        </div>
      </div>

      {/* Dynamic Filter Action Bar / Tabs - Compact layout */}
      <div className="grid grid-cols-3 gap-1.5 p-1 bg-zinc-100/80 dark:bg-zinc-900/40 border border-zinc-200/60 dark:border-zinc-800/60 rounded-xl max-w-xl mx-auto w-full shrink-0 mt-2">
        <button
          onClick={() => {
            playClickSound();
            setOnlyWrong(false);
            setOnlySessionWrong(false);
            setOnlyFlagged(false);
            setCurrentIdx(0);
            setMistakesSessionAnswers({});
          }}
          className={`flex flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
            !onlyWrong && !onlySessionWrong && !onlyFlagged
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-200 bg-white/45 dark:bg-zinc-950/20 hover:bg-white dark:hover:bg-zinc-950/50'
          }`}
        >
          <span>ყველა</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
            !onlyWrong && !onlySessionWrong && !onlyFlagged
              ? 'bg-indigo-500 text-white'
              : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600'
          }`}>
            {questions.length}
          </span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setOnlyWrong(true);
            setOnlySessionWrong(false);
            setOnlyFlagged(false);
            setCurrentIdx(0);
            setMistakesSessionAnswers({});
          }}
          className={`flex flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
            onlyWrong
              ? 'bg-rose-600 text-white shadow-xs'
              : 'text-zinc-500 hover:text-rose-600 dark:hover:text-rose-400 bg-white/45 dark:bg-zinc-950/20 hover:bg-white dark:hover:bg-zinc-950/50'
          }`}
        >
          <AlertTriangle className="w-3.5 h-3.5 text-rose-500" />
          <span>შეცდომები</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
            onlyWrong
              ? 'bg-rose-500 text-white'
              : 'bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300'
          }`}>
            {historicalWrongIds.length}
          </span>
        </button>

        <button
          onClick={() => {
            playClickSound();
            setOnlyWrong(false);
            setOnlySessionWrong(false);
            setOnlyFlagged(true);
            setCurrentIdx(0);
            setMistakesSessionAnswers({});
          }}
          className={`flex flex-row items-center justify-center gap-1.5 py-2 px-2.5 rounded-lg text-[11px] sm:text-xs font-bold transition-all cursor-pointer ${
            onlyFlagged
              ? 'bg-amber-550 text-white shadow-xs'
              : 'text-zinc-500 hover:text-amber-600 dark:hover:text-amber-400 bg-white/45 dark:bg-zinc-950/20 hover:bg-white dark:hover:bg-zinc-950/50'
          }`}
        >
          <HelpCircle className="w-3.5 h-3.5 text-amber-500" />
          <span>მონიშნული</span>
          <span className={`px-1.5 py-0.5 text-[9px] font-black rounded ${
            onlyFlagged
              ? 'bg-amber-450 text-white'
              : 'bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300'
          }`}>
            {flaggedIds.length}
          </span>
        </button>
      </div>

      {/* Main interactive testing layout (Fully Adaptive & Screen-fitting scrollable) */}
      <div className="flex-1 min-h-0 flex flex-col w-full max-w-4xl mx-auto mt-2 sm:mt-3">
        {currentQ && (
          <div className="flex-1 min-h-0 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 sm:p-5 shadow-xs flex flex-col justify-between overflow-hidden">
            
            {/* Upper interactive scroll area (Question text + options list have their own absolute scroll box) */}
            <div className="flex-1 min-h-0 overflow-y-auto pr-1 space-y-4">
              
              {/* Question metadata and text - remains beautifully visible inside scroll list but doesn't scroll whole page */}
              <div className="space-y-1.5 shrink-0 border-b border-zinc-100 dark:border-zinc-800 pb-3">
                <div className="flex justify-between items-center text-[10px] font-sans text-zinc-400 font-bold uppercase tracking-wider">
                  <span className="flex items-center gap-1 text-indigo-500 dark:text-indigo-400">
                    <QuestionIcon className="w-3.5 h-3.5" />
                    ორიგინალი კითხვა #{currentQ.originalIndex}
                  </span>
                  <div className="flex items-center gap-1.5">
                    {flaggedIds.includes(currentQ.id) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/25 text-amber-600 dark:text-amber-400 text-[9px] font-black">მონიშნული</span>
                    )}
                    {hiddenIds.has(currentQ.id) && (
                      <span className="px-1.5 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 text-zinc-400 text-[9px] font-black">დამალული</span>
                    )}
                  </div>
                </div>
                <h3 className="text-sm sm:text-base font-semibold text-zinc-800 dark:text-zinc-150 font-sans leading-relaxed">
                  {currentQ.questionText}
                </h3>
              </div>

              {/* Multiple Choice Options */}
              <div className="space-y-2 pb-2">
                {currentQ.options.map((option, idx) => {
                  const originalIndex = shuffledOptionsMapping ? shuffledOptionsMapping[idx] : idx;
                  const displayOption = currentQ.options[originalIndex];

                  const isSelected = selectedOpt === originalIndex;
                  const isCorrectAnswerIdx = originalIndex === currentQ.correctOptionIndex;
                  
                  let tileClass = 'border-zinc-200 dark:border-zinc-800 bg-zinc-55/60 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-950 text-zinc-800 dark:text-zinc-250';
                  
                  if (isSelected && !checked) {
                     tileClass = 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20 text-indigo-705 dark:text-indigo-400 ring-2 ring-indigo-500/20';
                  }

                  if (checked) {
                    if (isCorrectAnswerIdx) {
                      tileClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold ring-2 ring-emerald-500/20';
                    } else if (isSelected) {
                      tileClass = 'border-rose-500 bg-rose-50/55 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 ring-2 ring-rose-500/20';
                    }
                  }

                  if (immediateShow && isCorrectAnswerIdx) {
                    tileClass = 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400 font-semibold';
                  }

                  const alphabetLabels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

                  return (
                    <button
                      key={idx}
                      onClick={() => handleSelectOption(originalIndex)}
                      className={`w-full p-3 border rounded-xl text-left text-xs sm:text-sm font-sans flex items-start gap-2.5 transition cursor-pointer ${tileClass}`}
                    >
                      <span className="px-2 py-0.5 bg-zinc-200 dark:bg-zinc-800 text-[10px] font-bold rounded-md uppercase font-mono mt-0.5 shrink-0">
                        {alphabetLabels[idx] || (idx + 1)}
                      </span>
                      <span className="leading-relaxed">{displayOption}</span>
                    </button>
                  );
                })}
              </div>

              {/* Feedback banner (rendered and scrolled beautifully in list without pushing navigation buttons off-screen) */}
              {checked && (
                <div className="flex flex-col items-center justify-center py-2 border-t border-zinc-100/50 dark:border-zinc-800 animate-in zoom-in-95 duration-200 shrink-0">
                  {selectedOpt !== null && selectedOpt === currentQ.correctOptionIndex ? (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-4xl drop-shadow-xs select-none">✅</span>
                      <span className="text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase font-sans tracking-wider">სწორია!</span>
                    </div>
                  ) : (
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-4xl drop-shadow-xs select-none">❌</span>
                      <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 uppercase font-sans tracking-wider">არასწორია!</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Progress & Single Horizontal Control Bar - ABSOLUTELY FIXED AT THE BOTTOM CARD PORT */}
            <div className="mt-3.5 pt-3 border-t border-zinc-100 dark:border-zinc-800 shrink-0 space-y-3">
              
              {/* Progress visual indicators */}
              <div className="space-y-1">
                <div className="flex justify-between items-center text-[10px] sm:text-xs font-sans text-zinc-400 font-bold">
                  <span>კითხვა {currentIdx + 1} / {activeQuestionsPool.length}</span>
                  <span>პროგრესი: {progressPercentage}%</span>
                </div>
                <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                  <div 
                    className="bg-indigo-600 dark:bg-indigo-500 h-1.5 transition-all duration-300" 
                    style={{ width: `${((currentIdx + 1) / activeQuestionsPool.length) * 100}%` }}
                  />
                </div>
              </div>

              {/* Compact horizontal control row - perfect for thumbs/single hand usage on phones */}
              <div className="flex items-center justify-between gap-3 pt-0.5">
                <button
                  disabled={currentIdx === 0}
                  onClick={handlePrev}
                  className="px-4 py-2.5 sm:px-6 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 disabled:opacity-40 text-xs sm:text-sm font-bold text-zinc-700 dark:text-zinc-200 rounded-xl transition cursor-pointer flex items-center justify-center gap-1"
                >
                  ◀ წინა
                </button>

                <div className="flex gap-2 items-center">
                  <button
                    disabled={currentIdx === activeQuestionsPool.length - 1}
                    onClick={handleNext}
                    className="px-5 py-2.5 sm:px-8 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:opacity-40 text-xs sm:text-sm font-bold text-white rounded-xl transition cursor-pointer flex items-center justify-center gap-1 shadow-md"
                  >
                    შემდეგი ▶
                  </button>
                  
                  <button
                    onClick={toggleFlagQuestion}
                    className={`p-2.5 border rounded-xl transition cursor-pointer ${
                      flaggedIds.includes(currentQ.id)
                        ? 'bg-amber-50 dark:bg-amber-950/20 border-amber-300 text-amber-600'
                        : 'border-zinc-200 dark:border-zinc-800 text-zinc-400 hover:bg-zinc-50 dark:hover:bg-zinc-950'
                    }`}
                    title="გადასამეორებლად მონიშვნა"
                  >
                    <HelpCircle className="w-4.5 h-4.5 sm:w-5 sm:h-5" />
                  </button>
                </div>
              </div>
            </div>

          </div>
        )}
      </div>

      {/* Tools & Filters Overlay Modal */}
      {showTools && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-2xl w-full shadow-2xl space-y-6 font-sans flex flex-col max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between border-b border-zinc-150 dark:border-zinc-800 pb-3">
              <h3 className="text-base font-bold text-zinc-800 dark:text-zinc-105 flex items-center gap-2">
                <SlidersHorizontal className="w-5 h-5 text-indigo-500" />
                ხელსაწყოები და ფილტრები
              </h3>
              <button 
                onClick={() => setShowTools(false)}
                className="p-1.5 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 rounded-lg text-zinc-400 hover:text-zinc-600 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-6 overflow-y-auto pr-1 flex-1 text-zinc-800 dark:text-zinc-200">
              {/* Quick stats and precision summary */}
              <div className="bg-zinc-50 dark:bg-zinc-950 rounded-xl p-4 border border-zinc-150 dark:border-zinc-800 space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider">სესია და შედეგები</h4>
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="p-2 border border-emerald-100 dark:border-emerald-950 bg-emerald-50/20 text-emerald-600 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 font-sans uppercase">სწორი</span>
                    <span className="text-base font-bold font-mono">{correctCount}</span>
                  </div>
                  <div className="p-2 border border-rose-100 dark:border-rose-950 bg-rose-50/20 text-rose-600 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 font-sans uppercase">არასწორი</span>
                    <span className="text-base font-bold font-mono">{wrongCount}</span>
                  </div>
                  <div className="p-2 border border-zinc-200 dark:border-zinc-800 bg-zinc-100/40 text-zinc-600 dark:text-zinc-350 rounded-lg">
                    <span className="block text-[8px] text-zinc-400 dark:text-zinc-500 font-sans uppercase">სიზუსტე</span>
                    <span className="text-base font-bold font-mono">{correctCount + wrongCount > 0 ? Math.round((correctCount / (correctCount + wrongCount)) * 100) : 0}%</span>
                  </div>
                </div>
              </div>

              {/* Management settings */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider">მართვის პარამეტრები</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-150 dark:border-zinc-800 cursor-pointer text-xs font-sans transition">
                    <span className="font-bold">ავტომატური გადასვლა</span>
                    <input
                      type="checkbox"
                      checked={autoAdvance}
                      onChange={(e) => setAutoAdvance(e.target.checked)}
                      className="rounded-sm accent-indigo-600 bg-zinc-50 cursor-pointer"
                    />
                  </label>

                  <button
                    onClick={() => setImmediateShow(!immediateShow)}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-155 dark:border-zinc-800 text-xs font-sans text-left transition cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 font-bold">
                      {immediateShow ? <Eye className="w-4 h-4 text-emerald-500" /> : <EyeOff className="w-4 h-4 text-zinc-400" />}
                      <span>პასუხების ჩვენება</span>
                    </div>
                    <span className="text-[10px] text-zinc-400 font-mono">{immediateShow ? 'კი' : 'არა'}</span>
                  </button>

                   <button
                    onClick={() => setExamMode(!examMode)}
                    className="flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950 hover:bg-zinc-100/60 dark:hover:bg-zinc-950/60 rounded-xl border border-zinc-155 dark:border-zinc-800 text-xs font-sans transition cursor-pointer"
                  >
                    <span className="font-bold">საიმიტაციო გამოცდა</span>
                    <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${examMode ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'}`}>
                      {examMode ? 'ჩართულია' : 'გამორთული'}
                    </span>
                  </button>

                  <button
                    onClick={() => {
                      if (confirm('დარწმუნებული ხართ, რომ გსურთ სესიის გასუფთავება და თავიდან დაწყება?')) {
                        playClickSound();
                        setResponses({});
                        setCorrectCount(0);
                        setWrongCount(0);
                        setHistoricalWrongIds([]);
                        setSessionWrongIds([]);
                        setFlaggedIds([]);
                        setCurrentIdx(0);
                        setSelectedOpt(null);
                        setChecked(false);
                        saveProgressToServer(0, 0, 0, [], [], {});
                        setShowTools(false);
                      }
                    }}
                    className="flex items-center justify-between p-3 bg-rose-50/40 hover:bg-rose-50 dark:bg-rose-950/10 dark:hover:bg-rose-950/20 text-rose-600 rounded-xl border border-rose-200/50 dark:border-rose-900/30 text-xs font-sans font-bold transition cursor-pointer"
                  >
                    <span>სესიის გასუფთავება</span>
                    <RotateCcw className="w-4 h-4 text-rose-500" />
                  </button>
                </div>
              </div>

              {/* Operations */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider">მოქმედებები კითხვებზე</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                  <button
                    onClick={shuffleQuestions}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-100 dark:border-zinc-800 transition text-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 text-indigo-500" />
                    ბაზის არევა
                  </button>

                  <button
                    onClick={resetQuestionsOrder}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-100 dark:border-zinc-800 transition text-center gap-1 text-[11px] cursor-pointer"
                  >
                    <RotateCcw className="w-4 h-4 text-indigo-500" />
                    თავდაპირველი რიგი
                  </button>

                  <button
                    onClick={shuffleCurrentAnswers}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-100 dark:border-zinc-800 transition text-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Shuffle className="w-4 h-4 text-emerald-505" />
                    პასუხების არევა
                  </button>

                  <button
                    onClick={sortQuestionsAlphabetically}
                    className="flex flex-col items-center justify-center p-3 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 dark:hover:bg-zinc-800 rounded-xl text-zinc-700 dark:text-zinc-300 font-semibold border border-zinc-100 dark:border-zinc-800 transition text-center gap-1 text-[11px] cursor-pointer"
                  >
                    <SortAsc className="w-4 h-4 text-amber-505" />
                    A-Z სორტირება
                  </button>

                  <button
                    onClick={exportTestToTxt}
                    className="flex flex-col items-center justify-center p-3 bg-indigo-55 hover:bg-indigo-100 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-400 font-bold rounded-xl transition text-center gap-1 text-[11px] cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    გადმოწერა (TXT)
                  </button>
                </div>
              </div>

              {/* Filters and Search */}
              <div className="space-y-3">
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider">შეცდომები, დამალვები და ძებნა</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold block">ძებნა სწორ პასუხებში:</span>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchCorrect}
                        onChange={(e) => { setSearchCorrect(e.target.value); setCurrentIdx(0); }}
                        placeholder="მოძებნე ტექსტი..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-hidden"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-400 font-semibold block">ძებნა არასწორ პასუხებში:</span>
                    <div className="relative">
                      <input
                        type="text"
                        value={searchIncorrect}
                        onChange={(e) => { setSearchIncorrect(e.target.value); setCurrentIdx(0); }}
                        placeholder="მოძებნე ტექსტი..."
                        className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 outline-hidden"
                      />
                      <Search className="w-3.5 h-3.5 text-zinc-400 absolute left-2.5 top-2" />
                    </div>
                  </div>

                  <div className="flex gap-2 pt-1 font-semibold text-xs col-span-1 sm:col-span-2">
                    <button
                      onClick={exciseCurrentQuestion}
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 rounded-xl hover:text-rose-600 transition cursor-pointer border border-zinc-200 dark:border-zinc-800"
                    >
                      <Scissors className="w-3.5 h-3.5" /> კითხვის ამოჭრა
                    </button>
                    <button
                      onClick={toggleHideCurrentQuestion}
                      className="flex-1 flex items-center justify-center gap-1 py-1.5 bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-950 text-zinc-700 dark:text-zinc-300 rounded-xl transition cursor-pointer border border-zinc-200 dark:border-zinc-800"
                      title="მიმდინარე კითხვის დროებითი დამალვა"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> დამალვა/ჩვენება
                    </button>
                  </div>
                </div>
              </div>

              {/* Quick jump input widget inside filters modal */}
              <div className="space-y-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <span className="text-xs text-zinc-500 font-sans font-semibold">გადასვლა კონკრეტულ კოდზე / ნომერზე:</span>
                <form 
                  onSubmit={(e) => {
                    handleJumpToNumber(e);
                    setShowTools(false);
                  }} 
                  className="flex gap-2 w-full"
                >
                  <input
                    type="number"
                    min={1}
                    max={activeQuestionsPool.length}
                    value={jumpInput}
                    onChange={(e) => setJumpInput(e.target.value)}
                    placeholder="შეიყვანეთ ნომერი..."
                    className="flex-1 px-3 py-1.5 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans focus:ring-1 focus:ring-indigo-500 outline-hidden"
                  />
                  <button
                    type="submit"
                    className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer"
                  >
                    გადასვლა
                  </button>
                </form>
              </div>

              {/* Answers distribution diagram */}
              <div className="space-y-2 pt-2 border-t border-zinc-150 dark:border-zinc-800">
                <h4 className="font-bold text-xs text-zinc-500 uppercase tracking-wider flex items-center gap-1">
                  <BarChart className="w-4 h-4 text-emerald-555" /> პასუხების განაწილება
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center font-mono text-xs">
                  <div className="p-1.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg">
                    <span className="block text-[8px] text-zinc-400">A</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">{positionStats.A}%</span>
                  </div>
                  <div className="p-1.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg">
                    <span className="block text-[8px] text-zinc-400">B</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">{positionStats.B}%</span>
                  </div>
                  <div className="p-1.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg">
                    <span className="block text-[8px] text-zinc-400">C</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">{positionStats.C}%</span>
                  </div>
                  <div className="p-1.5 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-lg">
                    <span className="block text-[8px] text-zinc-400">D</span>
                    <span className="font-bold text-zinc-700 dark:text-zinc-200">{positionStats.D}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-zinc-400 italic text-center">ეს დიაგრამა აჩვენებს სწორი პასუხების განაწილებას (A/B/C/D პოზიციებზე) მიმდინარე ტესტში.</p>
              </div>
            </div>

            <div className="flex justify-end pt-3 border-t border-zinc-150 dark:border-zinc-800">
              <button
                onClick={() => setShowTools(false)}
                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer"
              >
                შენახვა და დახურვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
