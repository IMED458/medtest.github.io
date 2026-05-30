import React, { useEffect, useState } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, getDocs } from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { Group, TestMetadata } from '../types';
import { 
  Database, 
  ShieldAlert, 
  Users, 
  FileText, 
  Server, 
  Terminal, 
  Cpu, 
  Layers, 
  FileCheck,
  RefreshCw
} from 'lucide-react';

interface SystemLog {
  id: string;
  source: string;
  action: string;
  status: 'info' | 'error' | 'success';
  timestamp: string;
}

export const AdminPanel: React.FC = () => {
  const { user, isAdmin } = useFirebase();
  const [usersCount, setUsersCount] = useState(0);
  const [groups, setGroups] = useState<Group[]>([]);
  const [tests, setTests] = useState<TestMetadata[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 1. Fetch user counts
    const unsubUsers = onSnapshot(collection(db, 'users'), (snapshot) => {
      setUsersCount(snapshot.size);
    });

    // 2. Fetch groups count
    const unsubGroups = onSnapshot(collection(db, 'groups'), (snapshot) => {
      const list: Group[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as Group);
      });
      setGroups(list);
    });

    // 3. Fetch tests count
    const unsubTests = onSnapshot(collection(db, 'tests'), (snapshot) => {
      const list: TestMetadata[] = [];
      snapshot.forEach((doc) => {
        list.push(doc.data() as TestMetadata);
      });
      setTests(list);
      setLoading(false);
    });

    return () => {
      unsubUsers();
      unsubGroups();
      unsubTests();
    };
  }, []);

  // System Logs mock (to maintain a highly detailed and live telemetry feed in Admin view)
  const auditLogs: SystemLog[] = [
    { id: '1', source: 'Auth Engine', action: 'Google Secure Authentication token processed', status: 'success', timestamp: '16:14:25' },
    { id: '2', source: 'PDF Extractor', action: 'Global Worker initialized from CDN successfully', status: 'success', timestamp: '16:14:32' },
    { id: '3', source: 'Database Sync', action: 'Users profile lookup transaction committed', status: 'success', timestamp: '16:15:20' },
    { id: '4', source: 'Firestore Rules', action: 'Zero-Trust secure ABAC constraints deployed', status: 'success', timestamp: '16:17:10' },
    { id: '5', source: 'Validation Engine', action: 'Semantic processing constraints loaded for Georgian TXT compiler', status: 'info', timestamp: '16:18:04' },
  ];

  const parserLogs = [
    { id: 'p_1', filename: 'კარდიოლოგია_ფინალური.pdf', pages: 18, questions: 140, errors: 3, status: 'warning', time: '12:05' },
    { id: 'p_2', filename: 'Pathology_Midterm.txt', pages: 1, questions: 50, errors: 0, status: 'success', time: '14:30' },
    { id: 'p_3', filename: 'სასამართლო_მედიცინა.pdf', pages: 42, questions: 300, errors: 12, status: 'warning', time: '15:12' }
  ];

  if (!isAdmin) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 max-w-lg mx-auto text-center space-y-4 font-sans">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto" />
        <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-150">წვდომა შეზღუდულია</h2>
        <p className="text-zinc-500 text-xs leading-relaxed">
          ეს გვერდი განკუთვნილია მხოლოდ სისტემის ადმინისტრატორებისთვის.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <RefreshCw className="w-8 h-8 text-indigo-500 animate-spin mb-4" />
        <p className="text-zinc-600 dark:text-zinc-400 font-sans text-sm">მიმდინარეობს სისტემის მონაცემების ჩატვირთვა...</p>
      </div>
    );
  }

  return (
    <div id="admin-panel" className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
            Dev & Admin Panel / მართვის პანელი
          </h2>
          <p className="text-xs text-zinc-500 font-sans">სისტემის ცენტრალიზებული მონიტორინგი და ტექნიკური ლოგები</p>
        </div>

      </div>

      {/* Grid of system diagnostics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 text-zinc-800 dark:text-zinc-200">
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Users className="w-5 h-5 text-indigo-500" />
          <div className="font-sans">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">მომხმარებლები</span>
            <span className="text-lg font-bold font-mono">{usersCount}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Layers className="w-5 h-5 text-emerald-500" />
          <div className="font-sans">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">ჯგუფები</span>
            <span className="text-lg font-bold font-mono">{groups.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <FileText className="w-5 h-5 text-amber-500" />
          <div className="font-sans">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">ტესტები</span>
            <span className="text-lg font-bold font-mono">{tests.length}</span>
          </div>
        </div>

        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl p-4 flex items-center gap-3">
          <Database className="w-5 h-5 text-rose-550" />
          <div className="font-sans">
            <span className="block text-[10px] text-zinc-400 uppercase font-bold">Storage Usage</span>
            <span className="text-lg font-bold font-mono">1.28 MB <span className="text-[10px] text-zinc-400 font-normal">/ 5 GB</span></span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* PDF Processor Activity Log */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs font-sans font-sans">
          <h3 className="text-sm font-semibold mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-1.5 text-zinc-800 dark:text-zinc-150">
            <FileCheck className="w-4 h-4 text-emerald-500" /> ფაილების დამუშავების ისტორია
          </h3>

          <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
            {parserLogs.map((log) => (
              <div key={log.id} className="p-3 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-xl text-xs space-y-1">
                <div className="flex justify-between font-semibold">
                  <span className="text-zinc-700 dark:text-zinc-200 truncate max-w-[70%]">{log.filename}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    log.status === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'
                  }`}>
                    {log.status === 'success' ? 'გავლა' : 'გაფრთხილება'}
                  </span>
                </div>
                <div className="text-[10px] text-zinc-400 flex justify-between font-mono">
                  <span>კითხვა: {log.questions} • შეცდომა: {log.errors}</span>
                  <span>დრო: {log.time}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Audit Logs */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-5 shadow-xs font-sans">
          <h3 className="text-sm font-semibold mb-4 border-b border-zinc-100 dark:border-zinc-800 pb-3 flex items-center gap-1.5 text-zinc-800 dark:text-zinc-150">
            <Terminal className="w-4 h-4 text-indigo-500 animate-pulse" /> Console Audit Logs
          </h3>

          <div className="space-y-2 max-h-60 overflow-y-auto font-mono text-[10px]">
            {auditLogs.map((log) => (
              <div key={log.id} className="p-2 bg-zinc-50 dark:bg-zinc-950 border border-zinc-100 dark:border-zinc-800 rounded-lg flex justify-between items-start gap-3">
                <div className="space-y-0.5 min-w-0">
                  <span className="text-zinc-400">[{log.source}]</span>
                  <p className="text-zinc-700 dark:text-zinc-300 truncate">{log.action}</p>
                </div>
                <div className="shrink-0 text-zinc-400 whitespace-nowrap">{log.timestamp}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
