import React, { useEffect, useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  deleteDoc, 
  query, 
  orderBy, 
  getDocs,
  getDoc
} from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { Group, GroupMember, ChatMessage, GroupTest, TestMetadata } from '../types';
import { 
  Users, 
  MessageSquare, 
  BookOpen, 
  ArrowLeft, 
  Send, 
  Copy, 
  Check, 
  Clock, 
  Trash2, 
  Plus, 
  RefreshCw,
  Play,
  Heart
} from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface GroupDetailViewProps {
  groupId: string;
  onGoBack: () => void;
  onStartTest: (testId: string, resume: boolean) => void;
}

export const GroupDetailView: React.FC<GroupDetailViewProps> = ({ groupId, onGoBack, onStartTest }) => {
  const { user } = useFirebase();
  const [group, setGroup] = useState<Group | null>(null);
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [sharedTests, setSharedTests] = useState<TestMetadata[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeTab, setActiveTab] = useState<'chat' | 'tests' | 'members'>('chat');
  const [copied, setCopied] = useState(false);

  // Chat Input State
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // 1. Listen to Group metadata
    const unsubGroup = onSnapshot(doc(db, 'groups', groupId), (snapshot) => {
      if (snapshot.exists()) {
        setGroup(snapshot.data() as Group);
      }
    });

    // 2. Listen to Group members in real-time
    const unsubMembers = onSnapshot(collection(db, 'groups', groupId, 'members'), (snapshot) => {
      const list: GroupMember[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as GroupMember);
      });
      list.sort((a,b) => new Date(a.joinedAt).getTime() - new Date(b.joinedAt).getTime());
      setMembers(list);
    });

    // 3. Listen to Shared Tests inside group
    const unsubShared = onSnapshot(collection(db, 'groups', groupId, 'sharedTests'), async (snapshot) => {
      const list: TestMetadata[] = [];
      for (const shDoc of snapshot.docs) {
        const shData = shDoc.data() as GroupTest;
        // Fetch original test details from central Tests path
        const testSnap = await getDoc(doc(db, 'tests', shData.testId));
        if (testSnap.exists()) {
          list.push({
            ...(testSnap.data() as TestMetadata),
            creatorName: shData.sharedByName // store shared author instead
          });
        }
      }
      setSharedTests(list);
    });

    // 4. Listen to Chat Messages in real-time ordered by timestamp ascending
    const msgQuery = query(collection(db, 'groups', groupId, 'messages'), orderBy('createdAt', 'asc'));
    const unsubChat = onSnapshot(msgQuery, (snapshot) => {
      const list: ChatMessage[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as ChatMessage);
      });
      setMessages(list);
      // scroll to bottom
      setTimeout(() => {
        chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });

    return () => {
      unsubGroup();
      unsubMembers();
      unsubShared();
      unsubChat();
    };
  }, [groupId]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !chatInput.trim()) return;
    playClickSound();

    const messageId = 'msg_' + Date.now().toString() + '_' + Math.random().toString(36).substring(2, 6);
    const messagePayload: ChatMessage = {
      id: messageId,
      userId: user.uid,
      userName: user.displayName,
      userPhoto: user.photoURL,
      text: chatInput.trim(),
      createdAt: Date.now()
    };

    try {
      await setDoc(doc(db, 'groups', groupId, 'messages', messageId), messagePayload);
      setChatInput('');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `groups/${groupId}/messages/${messageId}`);
    }
  };

  const handleCopyCode = () => {
    if (!group) return;
    navigator.clipboard.writeText(group.code);
    setCopied(true);
    playCorrectSound();
    setTimeout(() => setCopied(false), 2000);
  };

  const handleUnshareTest = async (testId: string) => {
    if (!window.confirm('ნამდვილად გსურთ ამ ტესტის გაზიარების გაუქმება ჯგუფისთვის?')) return;
    playClickSound();

    try {
      await deleteDoc(doc(db, 'groups', groupId, 'sharedTests', testId));
      playCorrectSound();
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `groups/${groupId}/sharedTests/${testId}`);
    }
  };

  if (!group) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400 font-sans text-sm">მიმდინარეობს ჯგუფის ინფორმაციის ჩატვირთვა...</p>
      </div>
    );
  }

  return (
    <div id="group-detail-view" className="space-y-6">
      {/* Header Container */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs relative overflow-hidden">
        <button
          onClick={() => { playClickSound(); onGoBack(); }}
          className="flex items-center gap-1.5 text-xs text-indigo-600 dark:text-indigo-400 font-semibold mb-4 hover:underline transition"
        >
          <ArrowLeft className="w-4 h-4" /> უკან დაბრუნება
        </button>

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-150 font-sans tracking-tight">
              {group.name}
            </h2>
            <p className="text-zinc-450 dark:text-zinc-400 text-xs font-sans mt-1">
              {group.description || 'ჯგუფს აღწერა არ გააჩნია.'}
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <div className="p-3 bg-zinc-55 dark:bg-zinc-950 border border-zinc-150 dark:border-zinc-800 rounded-xl flex items-center gap-2">
              <div>
                <span className="block text-[9px] text-zinc-400 font-sans uppercase font-bold tracking-wider">მოწვევის კოდი</span>
                <span className="text-sm font-mono font-bold text-zinc-800 dark:text-zinc-200">{group.code}</span>
              </div>
              <button
                onClick={handleCopyCode}
                className="p-1 px-1.5 hover:bg-zinc-150 dark:hover:bg-zinc-800 rounded-lg text-zinc-500 hover:text-indigo-500 transition"
                title="კოდის კოპირება"
              >
                {copied ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="flex border-b border-zinc-150 dark:border-zinc-800 font-sans gap-6 text-sm">
        <button
          onClick={() => { playClickSound(); setActiveTab('chat'); }}
          className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
            activeTab === 'chat' 
              ? 'text-indigo-600 dark:text-indigo-400' 
              : 'text-zinc-400 hover:text-zinc-350'
          }`}
        >
          <MessageSquare className="w-4 h-4" />
          ჯგუფური ჩატი ({messages.length})
          {activeTab === 'chat' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => { playClickSound(); setActiveTab('tests'); }}
          className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
            activeTab === 'tests' 
              ? 'text-indigo-600 dark:text-indigo-400' 
              : 'text-zinc-400 hover:text-zinc-350'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          გაზიარებული ტესტები ({sharedTests.length})
          {activeTab === 'tests' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>

        <button
          onClick={() => { playClickSound(); setActiveTab('members'); }}
          className={`pb-3 font-semibold transition flex items-center gap-2 relative ${
            activeTab === 'members' 
              ? 'text-indigo-600 dark:text-indigo-400' 
              : 'text-zinc-400 hover:text-zinc-350'
          }`}
        >
          <Users className="w-4 h-4" />
          წევრები ({members.length})
          {activeTab === 'members' && (
            <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-indigo-600 dark:bg-indigo-400 rounded-full" />
          )}
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'chat' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl flex flex-col h-[450px] overflow-hidden shadow-xs relative">
          {/* Chat feed */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-center p-6">
                <MessageSquare className="w-10 h-10 text-zinc-300 dark:text-zinc-700 mb-2" />
                <p className="text-zinc-450 dark:text-zinc-400 text-xs font-sans">
                  ჩატში შეტყობინებები ჯერ არ არის. დაწერეთ თქვენი პირველი კითხვა აქ!
                </p>
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = msg.userId === user?.uid;
                const formattedTime = new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                return (
                  <div key={msg.id} className={`flex gap-3 max-w-[85%] ${isMe ? 'ml-auto flex-row-reverse' : ''}`}>
                    <img
                      src={msg.userPhoto || 'https://api.dicebear.com/7.x/bottts/svg?seed=' + msg.userId}
                      alt={msg.userName}
                      referrerPolicy="no-referrer"
                      className="w-8 h-8 rounded-full border border-zinc-100 dark:border-zinc-800 shrink-0 self-start"
                    />
                    
                    <div className="space-y-1">
                      <div className={`flex items-center gap-1.5 text-[10px] text-zinc-400 font-sans ${isMe ? 'justify-end' : ''}`}>
                        <span className="font-semibold text-zinc-700 dark:text-zinc-300">{msg.userName}</span>
                        <span className="font-mono flex items-center gap-0.5"><Clock className="w-3 h-3" /> {formattedTime}</span>
                      </div>
                      
                      <div className={`p-3 rounded-2xl text-xs font-sans whitespace-pre-wrap ${
                        isMe 
                          ? 'bg-indigo-600 text-white rounded-tr-none' 
                          : 'bg-zinc-100 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-250 rounded-tl-none border border-zinc-150 dark:border-zinc-800'
                      }`}>
                        {msg.text}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
            <div ref={chatBottomRef} />
          </div>

          {/* Input tray */}
          <form onSubmit={handleSendMessage} className="p-3 border-t border-zinc-150 dark:border-zinc-800 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              placeholder="დაწერეთ შეტყობინება..."
              className="flex-1 px-3 py-2 text-xs rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-55 dark:bg-zinc-950 text-zinc-800 dark:text-zinc-200 font-sans focus:ring-1 focus:ring-indigo-500 outline-hidden"
            />
            <button
              type="submit"
              disabled={!chatInput.trim()}
              className="p-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-xl transition flex items-center justify-center shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      {activeTab === 'tests' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-zinc-800 dark:text-zinc-200 font-sans">გაზიარებული ტესტები</h3>
            <span className="text-xs text-zinc-450 font-sans font-semibold">სულ გაზიარებული: {sharedTests.length}</span>
          </div>

          {sharedTests.length === 0 ? (
            <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-10 flex flex-col items-center justify-center text-center">
              <BookOpen className="w-12 h-12 text-zinc-300 dark:text-zinc-700 mb-4" />
              <p className="text-zinc-500 text-xs font-sans max-w-sm mb-2">
                ამ ჯგუფში ჯერ არ არის ტესტები გაზიარებული.
              </p>
              <p className="text-[10px] text-zinc-400 font-sans">
                გადადით "ჩემი ატვირთულები" გვერდზე და დააჭირეთ „გაზიარების“ ღილაკს ამ ჯგუფის ასარჩევად.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {sharedTests.map((test) => {
                const canUnshare = group.createdBy === user?.uid || test.createdBy === user?.uid;

                return (
                  <div
                    key={test.id}
                    className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 shadow-xs flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="font-semibold text-zinc-800 dark:text-zinc-200 font-sans text-xs leading-tight line-clamp-2">
                        {test.title}
                      </h4>
                      <div className="mt-2 text-[10px] text-zinc-450 dark:text-zinc-500 font-sans flex justify-between">
                        <span>ავტორი: <strong>{test.creatorName || 'ჯგუფის წევრი'}</strong></span>
                        <span>{test.questionCount} კითხვა</span>
                      </div>
                    </div>

                    <div className="flex gap-2 mt-4 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                      <button
                        onClick={() => { playClickSound(); onStartTest(test.id, false); }}
                        className="flex-1 flex items-center justify-center gap-1 py-1.5 px-3 bg-indigo-50 hover:bg-indigo-100 dark:bg-zinc-950 dark:hover:bg-zinc-800 text-indigo-600 dark:text-indigo-400 font-bold text-[11px] rounded-lg transition"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                        გავლა
                      </button>

                      {canUnshare && (
                        <button
                          onClick={() => handleUnshareTest(test.id)}
                          className="p-1.5 px-2 border border-rose-100 dark:border-rose-950 hover:bg-rose-50 dark:hover:bg-rose-950/20 text-rose-600 dark:text-rose-450 rounded-lg transition"
                          title="გაზიარების გაუქმება"
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
      )}

      {activeTab === 'members' && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between font-sans text-sm font-semibold border-b border-zinc-150 dark:border-zinc-800 pb-3">
            <h3 className="text-zinc-800 dark:text-zinc-150 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-indigo-500" /> ჯგუფის შემადგენლობა
            </h3>
            <span className="text-zinc-500 font-mono">წევრები: {members.length}</span>
          </div>

          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {members.map((member) => (
              <div key={member.userId} className="py-3 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <div className="relative">
                    <img
                      src={`https://api.dicebear.com/7.x/bottts/svg?seed=${member.userId}`}
                      alt={member.displayName}
                      className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-950"
                    />
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border border-white dark:border-zinc-900" />
                  </div>
                  <div>
                    <span className="block font-semibold text-zinc-800 dark:text-zinc-200 font-sans">{member.displayName}</span>
                    <span className="block text-[10px] text-zinc-400 font-sans">{member.email}</span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[9px] font-semibold uppercase font-sans ${
                    member.role === 'owner' 
                      ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400' 
                      : 'bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400'
                  }`}>
                    {member.role === 'owner' ? 'ადმინი' : 'სტუდენტი'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
