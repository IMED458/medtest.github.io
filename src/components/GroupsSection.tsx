import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, setDoc, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { Group, GroupMember } from '../types';
import { Users, Plus, Key, ArrowRight, Trash2, Shield, Circle, Code, Info, ClipboardList } from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface GroupsSectionProps {
  onSelectGroup: (groupId: string) => void;
}

export const GroupsSection: React.FC<GroupsSectionProps> = ({ onSelectGroup }) => {
  const { user, isLocalUser } = useFirebase();
  const [groups, setGroups] = useState<Group[]>([]);
  const [joinedGroupIds, setJoinedGroupIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  // Creation State
  const [showCreate, setShowCreate] = useState(false);
  const [grpName, setGrpName] = useState('');
  const [grpDesc, setGrpDesc] = useState('');

  // Joining State
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');

  useEffect(() => {
    if (!user || isLocalUser) { setLoading(false); return; }

    const unsubGroups = onSnapshot(collection(db, 'groups'), async (snapshot) => {
      const list: Group[] = [];
      const userJoined: string[] = [];

      for (const gpDoc of snapshot.docs) {
        const gpData = gpDoc.data() as Group;
        // Check if user is a member by trying to read their member subdocument
        const memberSnap = await getDocs(query(collection(db, 'groups', gpDoc.id, 'members'), where('userId', '==', user.uid)));
        if (!memberSnap.empty) {
          list.push(gpData);
          userJoined.push(gpDoc.id);
        }
      }

      setGroups(list);
      setJoinedGroupIds(new Set(userJoined));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'groups');
    });

    return () => unsubGroups();
  }, [user]);

  const handleCreateGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !grpName.trim()) return;
    playClickSound();

    const groupId = 'group_' + Date.now().toString();
    const cleanCode = Math.random().toString(36).substring(2, 8).toUpperCase(); // 6 Character Alphanumeric

    const groupPayload: Group = {
      id: groupId,
      name: grpName.trim(),
      description: grpDesc.trim(),
      createdBy: user.uid,
      creatorName: user.displayName,
      createdAt: new Date().toISOString(),
      code: cleanCode
    };

    const memberPayload: GroupMember = {
      userId: user.uid,
      email: user.email,
      displayName: user.displayName,
      joinedAt: new Date().toISOString(),
      role: 'owner'
    };

    try {
      // 1. Create central group doc
      await setDoc(doc(db, 'groups', groupId), groupPayload);
      // 2. Add owner inside nested member subcollection
      await setDoc(doc(db, 'groups', groupId, 'members', user.uid), memberPayload);

      setGrpName('');
      setGrpDesc('');
      setShowCreate(false);
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}`);
    }
  };

  const handleJoinByCode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !joinCode.trim()) return;
    playClickSound();

    const targetCode = joinCode.trim().toUpperCase();

    try {
      // Search groups finding matching invite code
      const groupSnap = await getDocs(query(collection(db, 'groups'), where('code', '==', targetCode)));
      
      if (groupSnap.empty) {
        alert('ჯგუფი მოცემული კოდით ვერ მოიძებნა. გთხოვთ გადაამოწმოთ კოდი.');
        playIncorrectSound();
        return;
      }

      const matchDoc = groupSnap.docs[0];
      const matchGroup = matchDoc.data() as Group;

      // Create membership document inside group members subcollection
      const memberPayload: GroupMember = {
        userId: user.uid,
        email: user.email,
        displayName: user.displayName,
        joinedAt: new Date().toISOString(),
        role: 'member'
      };

      await setDoc(doc(db, 'groups', matchGroup.id, 'members', user.uid), memberPayload);
      
      setJoinCode('');
      setShowJoin(false);
      onSelectGroup(matchGroup.id);
      playCorrectSound();
    } catch (err) {
      alert('ჯგუფში გაწევრიანება ჩაიშალა: ' + err);
    }
  };

  const handleDeleteGroup = async (e: React.MouseEvent, groupId: string) => {
    e.stopPropagation(); // prevent opening group details
    if (!window.confirm('ნამდვილად გსურთ ამ ჯგუფის წაშლა?')) return;
    playClickSound();

    try {
      await deleteDoc(doc(db, 'groups', groupId));
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}`);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Users className="w-8 h-8 text-indigo-500 animate-pulse mb-4" />
        <p className="text-zinc-550 dark:text-zinc-400 font-sans text-sm animate-pulse">მიმდინარეობს თქვენი ჯგუფების ჩატვირთვა...</p>
      </div>
    );
  }

  return (
    <div id="groups-section" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
            სასწავლო ჯგუფები
          </h2>
          <p className="text-xs text-zinc-500 font-sans mt-0.5">შექმენით ჯგუფები, გააზიარეთ ტესტები და იმეცადინეთ ერთად</p>
        </div>

        <div className="flex gap-2 shrink-0">
          <button
            onClick={() => { playClickSound(); setShowJoin(true); setShowCreate(false); }}
            className="flex items-center gap-1.5 px-3 py-2 border border-zinc-200 dark:border-zinc-805 hover:bg-zinc-50 dark:hover:bg-zinc-950 text-xs font-semibold rounded-xl text-zinc-750 dark:text-zinc-300 transition"
          >
            <Key className="w-4 h-4 text-indigo-500" />
            კოდით შესვლა
          </button>
          <button
            onClick={() => { playClickSound(); setShowCreate(true); setShowJoin(false); }}
            className="flex items-center gap-1.5 px-3 py-2 bg-indigo-650 hover:bg-indigo-700 text-xs font-semibold rounded-xl text-white transition"
          >
            <Plus className="w-4 h-4" />
            ჯგუფის შექმნა
          </button>
        </div>
      </div>

      {/* Creation Modal / Form */}
      {showCreate && (
        <form onSubmit={handleCreateGroup} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 font-sans">ახალი ჯგუფის შექმნა</h3>
          <div className="grid grid-cols-1 gap-3">
            <div>
              <label className="block text-xs text-zinc-455 dark:text-zinc-400 font-sans mb-1">ჯგუფის სახელი *</label>
              <input
                type="text"
                required
                value={grpName}
                onChange={(e) => setGrpName(e.target.value)}
                placeholder="მაგ: სამედიცინო ფაკულტეტი"
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans focus:ring-1 focus:ring-indigo-500 outline-hidden"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-455 dark:text-zinc-400 font-sans mb-1">აღწერა</label>
              <textarea
                value={grpDesc}
                onChange={(e) => setGrpDesc(e.target.value)}
                placeholder="ჯგუფის მოკლე აღწერა..."
                className="w-full px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans focus:ring-1 focus:ring-indigo-500 outline-hidden"
                rows={2}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 text-xs font-semibold">
            <button
              type="button"
              onClick={() => { playClickSound(); setShowCreate(false); }}
              className="px-4 py-2 border border-zinc-200 dark:border-zinc-800 text-zinc-650 dark:text-zinc-350 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-950 transition"
            >
              გაუქმება
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl transition"
            >
              შექმნა
            </button>
          </div>
        </form>
      )}

      {/* Code Joining Form */}
      {showJoin && (
        <form onSubmit={handleJoinByCode} className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 space-y-4 shadow-xs animate-in slide-in-from-top-4 duration-300">
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-100 font-sans">ჯგუფში გაწევრიანება კოდით</h3>
          <div>
            <label className="block text-xs text-zinc-455 dark:text-zinc-400 font-sans mb-1">ჯგუფის მოწვევის კოდი *</label>
            <div className="flex gap-2">
              <input
                type="text"
                required
                maxLength={6}
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                placeholder="მაგ: AB12YZ"
                className="flex-1 px-3 py-2 text-xs font-mono rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-zinc-850 dark:text-zinc-100 focus:ring-1 focus:ring-indigo-500 outline-hidden tracking-widest text-center"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-indigo-650 hover:bg-indigo-700 text-white rounded-xl text-xs font-semibold transition flex items-center justify-center"
              >
                შესვლა <ArrowRight className="w-4 h-4 ml-1" />
              </button>
            </div>
          </div>
          <p className="text-[10px] text-zinc-450 dark:text-zinc-500 font-sans">
            მიიღეთ 6 სიმბოლონიანი კოდი თქვენი მეგობრისგან ან ლექტორისგან, ვისაც უკვე შექმნილი აქვს სასწავლო სივრცე.
          </p>
        </form>
      )}

      {groups.length === 0 ? (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
          <Users className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
          <h3 className="font-semibold text-zinc-750 dark:text-zinc-200 font-sans mb-1">უჯგუფო გარემო</h3>
          <p className="text-zinc-500 text-xs font-sans max-w-sm">
            ჯერ არ ხართ გაწევრიანებული არცერთ სასწავლო ჯგუფში. შექმენით ახალი ჯგუფი ან მოითხოვეთ შესვლის კოდი.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {groups.map((group) => {
            const isOwner = group.createdBy === user?.uid;

            return (
              <div
                key={group.id}
                onClick={() => { playClickSound(); onSelectGroup(group.id); }}
                className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700 rounded-2xl p-5 shadow-xs transition cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex justify-between items-start gap-2 mb-2">
                    <h3 className="font-semibold text-zinc-850 dark:text-zinc-150 font-sans leading-tight">
                      {group.name}
                    </h3>
                    <span className="shrink-0 px-2 py-0.5 bg-zinc-100 dark:bg-zinc-800 text-[10px] text-zinc-500 font-mono rounded-full flex items-center gap-1 font-semibold">
                      <Code className="w-3.5 h-3.5 text-indigo-500" />
                      {group.code}
                    </span>
                  </div>

                  <p className="text-zinc-450 dark:text-zinc-400 text-xs font-sans line-clamp-2 mb-4 mt-2">
                    {group.description || 'აღწერის გარეშე'}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-zinc-100 dark:border-zinc-805 text-xs text-zinc-400 dark:text-zinc-500">
                  <div className="flex items-center gap-1 font-sans text-[11px]">
                    <Shield className="w-3.5 h-3.5 text-indigo-400" />
                    <span>ავტორი: <strong>{isOwner ? 'თქვენ' : (group.creatorName || 'მოლაპარაკე')}</strong></span>
                  </div>

                  {isOwner && (
                    <button
                      onClick={(e) => handleDeleteGroup(e, group.id)}
                      className="p-1 px-2 border border-rose-100 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-650 dark:text-rose-400 rounded-lg transition"
                      title="ჯგუფის წაშლა"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
