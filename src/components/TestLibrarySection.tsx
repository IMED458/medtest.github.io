import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { localGetTests, localGetProgress } from '../utils/localStore';
import { TestMetadata, UserProgress } from '../types';
import { Search, Play, RefreshCw, ClipboardList, BookOpen, Calendar, User } from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface TestLibrarySectionProps {
  onStartTest: (testId: string, resume: boolean) => void;
}

export const TestLibrarySection: React.FC<TestLibrarySectionProps> = ({ onStartTest }) => {
  const { user, isLocalUser } = useFirebase();
  const [tests, setTests] = useState<TestMetadata[]>([]);
  const [progresses, setProgresses] = useState<Record<string, UserProgress>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLocalUser) {
      // Local guest: show only their own tests from localStorage
      if (user) {
        setTests(localGetTests(user.uid).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()));
        const progressMap: Record<string, UserProgress> = {};
        localGetProgress(user.uid).forEach(p => { progressMap[p.testId] = p; });
        setProgresses(progressMap);
      }
      setLoading(false);
      return;
    }

    // Google-auth user: read all public tests from Firestore
    const unsubTests = onSnapshot(collection(db, 'tests'), (snapshot) => {
      const list: TestMetadata[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as TestMetadata);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(list);
      setLoading(false);
    }, (err) => {
      console.error('Firestore tests:', err);
      setLoading(false);
    });

    if (user) {
      const q = query(collection(db, 'progress'), where('userId', '==', user.uid));
      const unsubProgress = onSnapshot(q, (snapshot) => {
        const progressMap: Record<string, UserProgress> = {};
        snapshot.forEach((doc) => {
          const p = doc.data() as UserProgress;
          progressMap[p.testId] = p;
        });
        setProgresses(progressMap);
      });
      return () => { unsubTests(); unsubProgress(); };
    }

    return () => unsubTests();
  }, [user, isLocalUser]);

  const filteredTests = tests.filter(t => 
    t.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (t.creatorName && t.creatorName.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-550 dark:text-zinc-400 font-sans text-sm animate-pulse">მიმდინარეობს ტესტების ბიბლიოთეკის ჩატვირთვა...</p>
      </div>
    );
  }

  return (
    <div id="test-library-section" className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
            ტესტების ბიბლიოთეკა
          </h2>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">გაიარეთ ნებისმიერი ატვირთული ტესტი და მოემზადეთ გამოცდისთვის</p>
        </div>
        
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full md:w-auto">
          <div className="relative w-full md:w-60">
            <input
              type="text"
              placeholder="მოძებნეთ სათაურით..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-zinc-800 dark:text-zinc-200 font-sans focus:ring-1 focus:ring-indigo-500 outline-hidden"
            />
            <Search className="w-4 h-4 text-zinc-450 absolute left-3 top-2.5" />
          </div>
        </div>
      </div>

      {filteredTests.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <BookOpen className="w-12 h-12 text-zinc-350 dark:text-zinc-700 mb-4" />
          <h3 className="font-semibold text-zinc-750 dark:text-zinc-200 font-sans mb-1">ტესტები ვერ მოიძებნა</h3>
          <p className="text-zinc-500 text-xs font-sans max-w-sm leading-relaxed">
            {searchTerm ? 'მოცემული საძიებო პარამეტრით ტესტი ვერ მოიძებნა.' : 'ბიბლიოთეკა ცარიელია. ატვირთეთ პირველი ტესტი "ატვირთვა" განყოფილებიდან.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredTests.map((test) => {
            const progress = progresses[test.id];
            const hasStarted = !!progress;
            const progressPct = progress ? Math.round((progress.answeredCount / test.questionCount) * 100) : 0;

            return (
              <div 
                key={test.id} 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-750 rounded-2xl p-5 shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <h3 className="font-semibold text-zinc-850 dark:text-zinc-150 font-sans leading-tight line-clamp-2 mb-2 min-h-10">
                    {test.title}
                  </h3>

                  <div className="space-y-1.5 text-xs text-zinc-500 dark:text-zinc-400 font-sans mb-4">
                    <span className="flex items-center gap-1.5 truncate">
                      <User className="w-3.5 h-3.5 text-zinc-400" />
                      <span>{test.creatorName || 'ანონიმური'}</span>
                    </span>
                    <div className="flex justify-between">
                      <span className="flex items-center gap-1.5 font-mono">
                        <Calendar className="w-3.5 h-3.5 text-zinc-400" />
                        {new Date(test.createdAt).toLocaleDateString('ka-GE')}
                      </span>
                      <span className="flex items-center gap-1.5 font-mono">
                        <ClipboardList className="w-3.5 h-3.5 text-zinc-400" />
                        {test.questionCount} კითხვა
                      </span>
                    </div>
                  </div>

                  {hasStarted && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-sans text-zinc-400 mb-1">
                        <span>პროგრესი {progressPct}%</span>
                        <span className="font-mono">{progress.currentQuestionIndex + 1}/{test.questionCount}</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="pt-3 border-t border-zinc-100 dark:border-zinc-805">
                  <button
                    onClick={() => { playClickSound(); onStartTest(test.id, hasStarted); }}
                    className="w-full flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-950 dark:hover:bg-zinc-850 text-indigo-600 dark:text-indigo-400 font-semibold text-xs rounded-xl transition"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                    {hasStarted ? 'გაგრძელება' : 'ტესტის გავლა'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
