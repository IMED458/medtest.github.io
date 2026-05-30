import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, onSnapshot, doc, deleteDoc, getDocs, updateDoc, setDoc, getDoc } from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { localGetTests, localDeleteTest, localUpdateTest, localGetProgress, localDeleteProgress } from '../utils/localStore';
import { TestMetadata, Group, UserProgress } from '../types';
import { Play, RotateCcw, Share2, Edit3, Trash2, Calendar, ClipboardList, Info, Users, ExternalLink, RefreshCw } from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface MyTestsSectionProps {
  onStartTest: (testId: string, resume: boolean) => void;
}

export const MyTestsSection: React.FC<MyTestsSectionProps> = ({ onStartTest }) => {
  const { user, isLocalUser } = useFirebase();
  const [tests, setTests] = useState<TestMetadata[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [progresses, setProgresses] = useState<Record<string, UserProgress>>({});
  const [loading, setLoading] = useState(true);

  // Modals status
  const [shareModalConfig, setShareModalConfig] = useState<{ testId: string; title: string } | null>(null);
  const [editModalConfig, setEditModalConfig] = useState<{ testId: string; title: string } | null>(null);
  const [editedTitle, setEditedTitle] = useState('');
  const [selectedGroupToShare, setSelectedGroupToShare] = useState('');

  useEffect(() => {
    if (!user) return;

    if (isLocalUser) {
      const localTests = localGetTests(user.uid).sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      );
      setTests(localTests);
      const progressList = localGetProgress(user.uid);
      const progressMap: Record<string, UserProgress> = {};
      progressList.forEach(p => { progressMap[p.testId] = p; });
      setProgresses(progressMap);
      setLoading(false);
      return;
    }

    // Listen to user tests
    const q = query(collection(db, 'tests'), where('createdBy', '==', user.uid));
    const unsubTests = onSnapshot(q, (snapshot) => {
      const list: TestMetadata[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as TestMetadata);
      });
      list.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setTests(list);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'tests');
    });

    // Listen to groups
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const gpList: Group[] = [];
      snapshot.forEach((gpDoc) => {
        gpList.push(gpDoc.data() as Group);
      });
      setGroups(gpList);
    });

    // Listen to user progresses
    const pQ = query(collection(db, 'progress'), where('userId', '==', user.uid));
    const unsubProgress = onSnapshot(pQ, (snapshot) => {
      const progressMap: Record<string, UserProgress> = {};
      snapshot.forEach((pDoc) => {
        const prog = pDoc.data() as UserProgress;
        progressMap[prog.testId] = prog;
      });
      setProgresses(progressMap);
    });

    return () => {
      unsubTests();
      unsubGroups();
      unsubProgress();
    };
  }, [user, isLocalUser]);

  const handleDeleteTest = async (testId: string) => {
    if (!window.confirm('ნამდვილად გსურთ ამ ტესტის წაშლა? ყველა კითხვა და პროგრესი წაიშლება შეუქცევადად.')) return;
    playClickSound();
    try {
      if (isLocalUser) {
        localDeleteTest(testId);
        if (user) localDeleteProgress(testId, user.uid);
        setTests(prev => prev.filter(t => t.id !== testId));
      } else {
        await deleteDoc(doc(db, 'tests', testId));
        const qSnap = await getDocs(collection(db, 'tests', testId, 'questions'));
        await Promise.all(qSnap.docs.map(qDoc => deleteDoc(qDoc.ref)));
        if (user) await deleteDoc(doc(db, 'progress', `${testId}_${user.uid}`));
      }
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `tests/${testId}`);
    }
  };

  const handleEditTitle = async () => {
    if (!editModalConfig || !editedTitle.trim()) return;
    playClickSound();
    try {
      if (isLocalUser) {
        localUpdateTest(editModalConfig.testId, { title: editedTitle.trim() });
        setTests(prev => prev.map(t => t.id === editModalConfig.testId ? { ...t, title: editedTitle.trim() } : t));
      } else {
        await updateDoc(doc(db, 'tests', editModalConfig.testId), { title: editedTitle.trim() });
      }
      setEditModalConfig(null);
      setEditedTitle('');
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `tests/${editModalConfig.testId}`);
    }
  };

  const handleShareToGroup = async () => {
    if (!shareModalConfig || !selectedGroupToShare) return;
    playClickSound();
    try {
      const sharedTestId = shareModalConfig.testId;
      const sharedDocRef = doc(db, 'groups', selectedGroupToShare, 'sharedTests', sharedTestId);
      await setDoc(sharedDocRef, {
        testId: sharedTestId,
        sharedBy: user?.uid,
        sharedByName: user?.displayName,
        sharedAt: new Date().toISOString()
      });
      setShareModalConfig(null);
      setSelectedGroupToShare('');
      alert('ტესტი წარმატებით გაზიარდა ჯგუფში!');
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `groups/${selectedGroupToShare}/sharedTests/${shareModalConfig.testId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-600 dark:text-zinc-300 dark:text-zinc-400 dark:text-zinc-500 font-sans text-sm animate-pulse">მიმდინარეობს ატვირთული ტესტების ჩატვირთვა...</p>
      </div>
    );
  }

  return (
    <div id="my-tests-section" className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
          ჩემი ატვირთული ტესტები
        </h2>
        <span className="px-3 py-1 bg-zinc-100 dark:bg-zinc-800 rounded-full text-xs font-semibold font-sans text-zinc-500 dark:text-zinc-400 dark:text-zinc-500">
          ჯამში: {tests.length}
        </span>
      </div>

      {tests.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <ClipboardList className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-semibold text-zinc-700 dark:text-zinc-200 font-sans mb-1">ჯერ არ გაქვთ ატვირთული ტესტები</h3>
          <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 text-xs font-sans max-w-sm">
            გადადით "ატვირთვის" გვერდზე და ატვირთეთ თქვენი პირველი TXT ან PDF ფაილი შესასწავლად.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {tests.map((test) => {
            const progress = progresses[test.id];
            const hasStarted = !!progress;
            const progressPct = progress ? Math.round((progress.answeredCount / test.questionCount) * 100) : 0;

            return (
              <div 
                key={test.id} 
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs transition flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-zinc-800 dark:text-zinc-100 dark:text-zinc-150 font-sans leading-tight line-clamp-2">
                      {test.title}
                    </h3>
                    {test.errorCount > 0 && (
                      <span className="shrink-0 px-2 py-0.5 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 rounded-full text-[10px] font-semibold flex items-center gap-1">
                        <Info className="w-3 h-3" />
                        {test.errorCount} შეცდომა
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-sans mb-4 mt-2">
                    <span className="flex items-center gap-1.5 font-mono">
                      <Calendar className="w-3.5 h-3.5" />
                      {new Date(test.createdAt).toLocaleDateString('ka-GE')}
                    </span>
                    <span className="flex items-center gap-1.5 font-mono">
                      <ClipboardList className="w-3.5 h-3.5" />
                      {test.questionCount} კითხვა
                    </span>
                  </div>

                  {hasStarted && (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs font-sans text-zinc-400 dark:text-zinc-500 mb-1">
                        <span>პროგრესი: {progressPct}%</span>
                        <span className="font-mono">კითხვა {progress.currentQuestionIndex + 1}/{test.questionCount}</span>
                      </div>
                      <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-indigo-500 h-full rounded-full"
                          style={{ width: `${progressPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800 text-xs">
                  {hasStarted ? (
                    <>
                      <button 
                        onClick={() => { playClickSound(); onStartTest(test.id, true); }}
                        className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 font-semibold text-white rounded-xl transition"
                      >
                        <Play className="w-4 h-4 fill-white" />
                        გაგრძელება
                      </button>
                      <button 
                        onClick={() => { playClickSound(); onStartTest(test.id, false); }}
                        className="flex items-center justify-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 font-semibold text-zinc-700 dark:text-zinc-200 dark:text-zinc-300 rounded-xl transition"
                        title="თავიდან დაწყება"
                      >
                        <RotateCcw className="w-4 h-4" />
                      </button>
                    </>
                  ) : (
                    <button 
                      onClick={() => { playClickSound(); onStartTest(test.id, false); }}
                      className="flex-1 min-w-[100px] flex items-center justify-center gap-1.5 px-3 py-2 bg-indigo-600 hover:bg-indigo-700 font-semibold text-white rounded-xl transition"
                    >
                      <Play className="w-4 h-4 fill-white" />
                      დაწყება
                    </button>
                  )}

                  <button 
                    onClick={() => { playClickSound(); setShareModalConfig({ testId: test.id, title: test.title }); }}
                    className="flex items-center justify-center px-3 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-700 dark:text-zinc-200 dark:text-zinc-300 rounded-xl transition"
                    title="გაზიარება"
                  >
                    <Share2 className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => { playClickSound(); setEditModalConfig({ testId: test.id, title: test.title }); setEditedTitle(test.title); }}
                    className="flex items-center justify-center px-3 py-2 border border-zinc-200 dark:border-zinc-800 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-zinc-600 dark:text-zinc-300 rounded-xl transition"
                    title="სათაურის შეცვლა"
                  >
                    <Edit3 className="w-4 h-4" />
                  </button>

                  <button 
                    onClick={() => handleDeleteTest(test.id)}
                    className="flex items-center justify-center px-3 py-2 border border-rose-100 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-650 dark:text-rose-400 rounded-xl transition"
                    title="წაშლა"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Share Modal Dialog */}
      {shareModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-md w-full shadow-lg space-y-4 animate-in fade-in-50 duration-200">
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 dark:text-zinc-150 font-sans flex items-center gap-2">
              <Share2 className="w-5 h-5 text-indigo-500" />
              ტესტის ჯგუფში გაზიარება
            </h3>
            <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-sans">
              აირჩიეთ სასწავლო ჯგუფი, რომელშიც გსურთ გააზიაროთ ტესტი: <strong>"{shareModalConfig.title}"</strong>. ჯგუფის ყველა წევრს ექნება წვდომა ამ ტესტზე საკუთარი პროგრესით.
            </p>

            <select
              value={selectedGroupToShare}
              onChange={(e) => setSelectedGroupToShare(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 dark:text-zinc-200 font-sans text-xs focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">-- აირჩიეთ ჯგუფი --</option>
              {groups.map((group) => (
                <option key={group.id} value={group.id}>{group.name}</option>
              ))}
            </select>

            <div className="flex justify-end gap-2 text-xs">
              <button 
                onClick={() => { playClickSound(); setShareModalConfig(null); }}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 dark:text-zinc-350 dark:text-zinc-500 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
              >
                გაუქმება
              </button>
              <button 
                disabled={!selectedGroupToShare}
                onClick={handleShareToGroup}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold transition"
              >
                გაზიარება
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Title Modal */}
      {editModalConfig && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-xs p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 max-w-sm w-full shadow-lg space-y-4 animate-in fade-in-50 duration-200">
            <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-100 dark:text-zinc-150 font-sans flex items-center gap-2">
              <Edit3 className="w-5 h-5 text-indigo-500" />
              სათაურის რედაქტირება
            </h3>
            
            <input
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-100 dark:text-zinc-200 font-sans text-xs focus:ring-1 focus:ring-indigo-500"
              placeholder="შეიყვანეთ ახალი სათაური"
            />

            <div className="flex justify-end gap-2 text-xs">
              <button 
                onClick={() => { playClickSound(); setEditModalConfig(null); }}
                className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-600 dark:text-zinc-300 dark:text-zinc-350 dark:text-zinc-500 rounded-xl font-semibold hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
              >
                გაუქმება
              </button>
              <button 
                disabled={!editedTitle.trim()}
                onClick={handleEditTitle}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl font-semibold transition"
              >
                შენახვა
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
