import React, { useState, useEffect } from 'react';
import { FirebaseProvider, useFirebase } from './components/FirebaseProvider';
import { UploadSection } from './components/UploadSection';
import { MyTestsSection } from './components/MyTestsSection';
import { TestLibrarySection } from './components/TestLibrarySection';
import { GroupsSection } from './components/GroupsSection';
import { GroupDetailView } from './components/GroupDetailView';
import { AuscultationSection } from './components/AuscultationSection';
import { StatisticsSection } from './components/StatisticsSection';
import { AdminPanel } from './components/AdminPanel';
import { TestPracticePage } from './components/TestPracticePage';
import { playClickSound } from './utils/sounds';

// Icons
import { 
  BookOpen, 
  Upload, 
  FolderLock, 
  Users, 
  Activity, 
  BarChart, 
  ShieldAlert, 
  Sun, 
  Moon, 
  LogOut, 
  GraduationCap 
} from 'lucide-react';

type SectionType = 'library' | 'upload' | 'my-uploads' | 'groups' | 'auscultations' | 'stats' | 'admin';

const AppContent: React.FC = () => {
  const { user, signInWithGoogle, signOutUser, isAdmin, loginAnonymously } = useFirebase();
  const [activeSection, setActiveSection] = useState<SectionType>('library');
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [activePracticeTestId, setActivePracticeTestId] = useState<string | null>(null);
  
  // Theme state: default to 'light' (as requested: "მუქი ფონი არ იყოს, მაქსიმალურად ლამაზი და სადა დიზაინი")
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    // Sync theme class to direct DOM body element
    const root = window.document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const toggleTheme = () => {
    playClickSound();
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  const handleStartPracticeTest = (testId: string) => {
    playClickSound();
    setActivePracticeTestId(testId);
  };

  // Login Screen component
  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 dark:text-white flex flex-col justify-between p-6 transition-colors duration-200">
        {/* Top bar with theme only switch */}
        <div className="flex justify-end">
          <button
            onClick={toggleTheme}
            className="p-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 dark:text-zinc-350 dark:text-zinc-500 transition flex items-center justify-center cursor-pointer shadow-xs"
            title="რეჟიმის შეცვლა"
          >
            {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
          </button>
        </div>

        {/* Hero Auth Card */}
        <div className="max-w-md w-full mx-auto bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-3xl p-8 space-y-8 shadow-xs text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 bg-indigo-50 dark:bg-zinc-950 border border-indigo-100 dark:border-indigo-950 rounded-2xl flex items-center justify-center mx-auto text-indigo-600 dark:text-indigo-400">
              <GraduationCap className="w-9 h-9" />
            </div>
            
            <div className="space-y-1 font-sans">
              <h1 className="text-2xl font-extrabold tracking-tight text-zinc-800 dark:text-zinc-100">
                სტუდენტური პორტალი
              </h1>
              <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 text-xs">გამოცდების მომზადების პროფესიონალური პლატფორმა</p>
            </div>
          </div>

          <p className="text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-sans leading-relaxed">
            იმეცადინეთ დამოუკიდებლად, ატვირთეთ თქვენი კონსპექტები / ტესტები TXT და PDF ფორმატში და გააზიარეთ სასწავლო ჯგუფებში.
          </p>

          <div className="space-y-3">
            <button
              onClick={() => { playClickSound(); signInWithGoogle(); }}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 hover:bg-zinc-50 dark:hover:bg-zinc-900 rounded-xl text-xs font-bold text-zinc-700 dark:text-zinc-200 dark:text-zinc-300 transition cursor-pointer shadow-xs"
            >
              <img 
                src="https://www.vectorlogo.zone/logos/google/google-icon.svg" 
                alt="Google Icon" 
                className="w-4 h-4" 
              />
              ავტორიზაცია Google-ით
            </button>

            <button
              onClick={() => { playClickSound(); loginAnonymously(); }}
              className="w-full flex items-center justify-center gap-2.5 px-4 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition cursor-pointer shadow-md"
            >
              შესვლა ავტორიზაციის გარეშე (სტუმრად)
            </button>
          </div>

          <p className="text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">
            Google ავტორიზაცია რეკომენდებულია თქვენი პროგრესისა და ატვირთული ტესტების შესანახად.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-[10px] text-zinc-400 dark:text-zinc-500 font-sans">
          © {new Date().getFullYear()} სამედიცინო & აკადემიური მომზადების ცენტრი • ყველა უფლება დაცულია
        </div>
      </div>
    );
  }

  // Active Practice Exam sheets (Focus Mode)
  if (activePracticeTestId) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 dark:text-white p-4 md:p-6 transition-colors duration-200">
        <div className="max-w-6xl mx-auto">
          <TestPracticePage 
            testId={activePracticeTestId}
            onGoBack={() => setActivePracticeTestId(null)}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-zinc-950 text-zinc-900 dark:text-zinc-50 dark:text-white flex transition-colors duration-200 font-sans">
      
      {/* Desktop Navigation Rails (Sidebar) */}
      <aside className="hidden lg:flex flex-col justify-between w-64 bg-white dark:bg-zinc-900 border-r border-zinc-200 dark:border-zinc-800 shrink-0">
        <div className="p-5 space-y-6">
          
          {/* Logo badge */}
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-600 rounded-lg text-white">
              <GraduationCap className="w-5 h-5" />
            </div>
            <div>
              <span className="block font-sans font-bold text-xs tracking-tight text-zinc-800 dark:text-zinc-100 dark:text-zinc-50">საგამოცდო კერა</span>
              <span className="block text-[9px] text-zinc-450 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase font-black">საქართველო</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1 font-sans text-xs font-semibold">
            <button
              onClick={() => { playClickSound(); setActiveSection('library'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'library' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <BookOpen className="w-4 h-4" />
              📚 ტესტები
            </button>

            <button
              onClick={() => { playClickSound(); setActiveSection('upload'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'upload' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <Upload className="w-4 h-4" />
              📤 ატვირთვა
            </button>

            <button
              onClick={() => { playClickSound(); setActiveSection('my-uploads'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'my-uploads' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <FolderLock className="w-4 h-4" />
              📁 ჩემი ატვირთულები
            </button>

            <button
              onClick={() => { playClickSound(); setActiveSection('groups'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'groups' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <Users className="w-4 h-4" />
              👥 ჯგუფები
            </button>

            <button
              onClick={() => { playClickSound(); setActiveSection('auscultations'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'auscultations' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <Activity className="w-4 h-4" />
              🫁 აუკულტაციები
            </button>

            <button
              onClick={() => { playClickSound(); setActiveSection('stats'); setSelectedGroupId(null); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                activeSection === 'stats' 
                  ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400' 
                  : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
              }`}
            >
              <BarChart className="w-4 h-4" />
              📊 სტატისტიკა
            </button>

            {/* Admin panel — only visible to admin users */}
            {isAdmin && (
              <button
                onClick={() => { playClickSound(); setActiveSection('admin'); setSelectedGroupId(null); }}
                className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl transition cursor-pointer ${
                  activeSection === 'admin'
                    ? 'bg-indigo-50 text-indigo-600 dark:bg-zinc-950 dark:text-indigo-400'
                    : 'text-zinc-700 dark:text-zinc-200 hover:bg-zinc-50 dark:text-zinc-350 dark:text-zinc-500 dark:hover:bg-zinc-950'
                }`}
              >
                <ShieldAlert className="w-4 h-4" />
                ⚙️ მართვის პანელი
              </button>
            )}
          </nav>
        </div>

        {/* Profile Card & LogOut */}
        <div className="p-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3 font-sans">
          <div className="flex items-center gap-2.5">
            <img
              src={user.photoURL || `https://api.dicebear.com/7.x/bottts/svg?seed=${user.uid}`}
              alt={user.displayName}
              referrerPolicy="no-referrer"
              className="w-8 h-8 rounded-full border border-zinc-200 dark:border-zinc-700"
            />
            <div className="truncate text-xs">
              <span className="block font-bold text-zinc-800 dark:text-zinc-100 dark:text-zinc-200">{user.displayName}</span>
              <span className="block text-[10px] text-zinc-400 dark:text-zinc-500">{user.email}</span>
            </div>
          </div>

          <button
            onClick={() => { playClickSound(); signOutUser(); }}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 border border-rose-100 hover:bg-rose-50 dark:border-rose-950 dark:hover:bg-rose-950/20 text-rose-600 rounded-xl text-xs font-semibold cursor-pointer transition"
          >
            <LogOut className="w-3.5 h-3.5" /> გამოსვლა
          </button>
        </div>
      </aside>

      {/* Main Panel Content Box */}
      <div className="flex-1 flex flex-col min-w-0 pb-20 lg:pb-0">
        
        {/* Top Header Controls Bar */}
        <header className="bg-white dark:bg-zinc-900 border-b border-zinc-200 dark:border-zinc-800 p-4 flex items-center justify-between shadow-xs sticky top-0 z-40">
          <div className="flex items-center gap-2 lg:hidden">
            <GraduationCap className="w-6 h-6 text-indigo-600" />
            <span className="font-bold text-sm tracking-tight text-zinc-800 dark:text-zinc-100 dark:text-zinc-200">საგამოცდო კლასები</span>
          </div>

          <div className="hidden lg:block">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-sans">მოგესალმებით, <strong className="text-zinc-700 dark:text-zinc-200">{user.displayName}</strong> 👋</span>
          </div>

          {/* Theme Switcher Toggle (Icons only as requested) */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleTheme}
              className="p-2 border border-zinc-200 dark:border-zinc-800 rounded-xl hover:bg-slate-50 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 dark:text-zinc-350 dark:text-zinc-500 transition flex items-center justify-center cursor-pointer"
              title="რეჟიმის შეცვლა"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Outer content container */}
        <main className="flex-1 p-4 md:p-6 overflow-y-auto max-w-7xl w-full mx-auto">
          {selectedGroupId ? (
            <GroupDetailView 
              groupId={selectedGroupId}
              onGoBack={() => setSelectedGroupId(null)}
              onStartTest={handleStartPracticeTest}
            />
          ) : (
            <>
              {activeSection === 'library' && <TestLibrarySection onStartTest={handleStartPracticeTest} />}
              {activeSection === 'upload' && <UploadSection onUploadSuccess={() => setActiveSection('my-uploads')} />}
              {activeSection === 'my-uploads' && <MyTestsSection onStartTest={handleStartPracticeTest} />}
              {activeSection === 'groups' && <GroupsSection onSelectGroup={(gid) => setSelectedGroupId(gid)} />}
              {activeSection === 'auscultations' && <AuscultationSection />}
              {activeSection === 'stats' && <StatisticsSection />}
              {activeSection === 'admin' && <AdminPanel />}
            </>
          )}
        </main>
      </div>

      {/* Mobile Navigation tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 lg:hidden bg-white dark:bg-zinc-900 border-t border-zinc-250 dark:border-zinc-800 flex justify-around p-2.5 z-55 shadow-md">
        <button
          onClick={() => { playClickSound(); setActiveSection('library'); setSelectedGroupId(null); }}
          className={`flex flex-col items-center gap-0.5 text-xs font-sans ${activeSection === 'library' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 dark:text-zinc-400'}`}
        >
          <BookOpen className="w-4 h-4" />
          <span className="text-[10px]">ტესტები</span>
        </button>

        <button
          onClick={() => { playClickSound(); setActiveSection('upload'); setSelectedGroupId(null); }}
          className={`flex flex-col items-center gap-0.5 text-xs font-sans ${activeSection === 'upload' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 dark:text-zinc-400'}`}
        >
          <Upload className="w-4 h-4" />
          <span className="text-[10px]">ატვირთვა</span>
        </button>

        <button
          onClick={() => { playClickSound(); setActiveSection('my-uploads'); setSelectedGroupId(null); }}
          className={`flex flex-col items-center gap-0.5 text-xs font-sans ${activeSection === 'my-uploads' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 dark:text-zinc-400'}`}
        >
          <FolderLock className="w-4 h-4" />
          <span className="text-[10px]">ჩემი</span>
        </button>

        <button
          onClick={() => { playClickSound(); setActiveSection('groups'); setSelectedGroupId(null); }}
          className={`flex flex-col items-center gap-0.5 text-xs font-sans ${activeSection === 'groups' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 dark:text-zinc-400'}`}
        >
          <Users className="w-4 h-4" />
          <span className="text-[10px]">ჯგუფები</span>
        </button>

        <button
          onClick={() => { playClickSound(); setActiveSection('stats'); setSelectedGroupId(null); }}
          className={`flex flex-col items-center gap-0.5 text-xs font-sans ${activeSection === 'stats' ? 'text-indigo-600 dark:text-indigo-400 font-bold' : 'text-zinc-400 dark:text-zinc-500 dark:text-zinc-400'}`}
        >
          <BarChart className="w-4 h-4" />
          <span className="text-[10px]">სტატისტიკა</span>
        </button>
      </nav>
    </div>
  );
};

export default function App() {
  return (
    <FirebaseProvider>
      <AppContent />
    </FirebaseProvider>
  );
}
