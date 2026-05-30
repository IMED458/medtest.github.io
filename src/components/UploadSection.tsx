import React, { useState, useRef } from 'react';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useFirebase } from './FirebaseProvider';
import { parseTextToQuestions, extractTextFromPDF } from '../utils/parser';
import { localSaveTest, localSaveQuestions } from '../utils/localStore';
import { TestMetadata, Question } from '../types';
import { UploadCloud, FileText, FileDown, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { playClickSound, playCorrectSound, playIncorrectSound } from '../utils/sounds';

interface UploadSectionProps {
  onUploadSuccess: () => void;
}

export const UploadSection: React.FC<UploadSectionProps> = ({ onUploadSuccess }) => {
  const { user, isLocalUser } = useFirebase();
  const [isDragging, setIsDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusText, setStatusText] = useState('');
  const [report, setReport] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      await processFile(files[0]);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      await processFile(files[0]);
    }
  };

  const processFile = async (file: File) => {
    if (!user) {
      alert('გთხოვთ გაიაროთ ავტორიზაცია ტესტების ასატვირთად');
      return;
    }

    const isPdf = file.name.endsWith('.pdf');
    const isTxt = file.name.endsWith('.txt');

    if (!isPdf && !isTxt) {
      alert('მხოლოდ TXT ან PDF ფაილებია მხარდაჭერილი');
      playIncorrectSound();
      return;
    }

    setLoading(true);
    setUploadProgress(10);
    setStatusText('ფაილი იკითხება...');
    playClickSound();

    try {
      let rawText = '';
      if (isPdf) {
        rawText = await extractTextFromPDF(file, (pct) => {
          setUploadProgress(10 + Math.floor(pct * 0.4)); // PDF extraction maps to 10%-50%
          setStatusText(`PDF დამუშავება: ${pct}%`);
        });
      } else {
        rawText = await file.text();
        setUploadProgress(50);
      }

      setStatusText('მიმდინარეობს სინტაქსის ვალიდაცია...');
      const { questions, report: validationReport } = parseTextToQuestions(rawText);
      setUploadProgress(65);

      if (questions.length === 0) {
        throw new Error('ვალიდური კითხვები ვერ მოიძებნა. გთხოვთ შეამოწმოთ ფაილის სინტაქსი.');
      }

      setStatusText('ტესტის მონაცემების შენახვა...');

      const testId = 'test_' + Date.now().toString();
      const testMeta: TestMetadata = {
        id: testId,
        title: file.name.replace(/\.[^/.]+$/, ""),
        createdBy: user.uid,
        creatorName: user.displayName,
        createdAt: new Date().toISOString(),
        questionCount: questions.length,
        errorCount: validationReport.problematicQuestions,
        originalFileName: file.name,
        validationReport: validationReport
      };

      const allQuestions: Question[] = questions.map((q, idx) => ({
        ...q,
        id: `q_${idx + 1}`,
        testId,
      }));

      if (isLocalUser) {
        localSaveTest(testMeta);
        localSaveQuestions(testId, allQuestions);
        setUploadProgress(100);
      } else {
        await setDoc(doc(db, 'tests', testId), testMeta);
        setUploadProgress(80);

        const stepPct = 20 / allQuestions.length;
        for (let idx = 0; idx < allQuestions.length; idx++) {
          await setDoc(doc(db, 'tests', testId, 'questions', allQuestions[idx].id), allQuestions[idx]);
          setUploadProgress(80 + Math.floor((idx + 1) * stepPct));
        }
      }

      setUploadProgress(100);
      setReport(validationReport);
      setStatusText('ატვირთვა დასრულდა წარმატებით!');
      playCorrectSound();
      onUploadSuccess();
    } catch (error: any) {
      console.error(error);
      playIncorrectSound();
      alert(`ატვირთვის შეცდომა: ${error.message || error}`);
      setStatusText('ატვირთვა ჩაიშალა');
      setUploadProgress(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div id="upload-section" className="space-y-6">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
        <h2 className="text-xl font-semibold text-zinc-800 dark:text-zinc-100 mb-4 font-sans tracking-tight">
          ახალი ტესტის ატვირთვა
        </h2>
        
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-xl p-8 flex flex-col items-center justify-center cursor-pointer transition ${
            isDragging 
              ? 'border-indigo-500 bg-indigo-50/50 dark:bg-indigo-950/20' 
              : 'border-zinc-300 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-600 bg-zinc-50 dark:bg-zinc-950/40'
          }`}
        >
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept=".txt,.pdf"
          />
          <UploadCloud className="w-12 h-12 text-zinc-400 dark:text-zinc-500 mb-4" />
          <p className="text-zinc-700 dark:text-zinc-200 dark:text-zinc-300 font-medium mb-1 text-center font-sans text-sm">
            გადმოათრიეთ ფაილი აქ ან დააკლიკეთ ასარჩევად
          </p>
          <p className="text-zinc-400 dark:text-zinc-500 text-xs text-center font-sans mt-1">
            მხარდაჭერილია ფორმატები: TXT და PDF
          </p>
        </div>

        {loading && (
          <div className="mt-6 space-y-2">
            <div className="flex justify-between text-xs text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 font-mono">
              <span className="truncate">{statusText}</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-zinc-100 dark:bg-zinc-800 h-2 rounded-full overflow-hidden">
              <div 
                className="bg-indigo-600 h-full rounded-full transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs space-y-4">
          <div className="flex items-center space-x-2 text-zinc-800 dark:text-zinc-100 border-b border-zinc-150 dark:border-zinc-800 pb-3">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold font-sans">ატვირთვისა და ვალიდაციის ანგარიში</h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-800 text-center">
              <div className="text-sm text-zinc-400 dark:text-zinc-500 font-sans">სულ კითხვები</div>
              <div className="text-2xl font-bold font-mono text-zinc-800 dark:text-zinc-100 dark:text-zinc-150">{report.totalQuestions}</div>
            </div>
            <div className="p-4 bg-emerald-50/55 dark:bg-emerald-950/25 rounded-xl border border-emerald-100 dark:border-emerald-955 text-center">
              <div className="text-sm text-emerald-600 dark:text-emerald-400 font-sans">სწორი კითხვები</div>
              <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-300">{report.correctQuestions}</div>
            </div>
            <div className={report.problematicQuestions > 0 ? "p-4 bg-rose-50/55 dark:bg-rose-950/25 rounded-xl border border-rose-100 dark:border-rose-950 text-center" : "p-4 bg-zinc-50 dark:bg-zinc-950 rounded-xl border border-zinc-150 dark:border-zinc-800 text-center"}>
              <div className="text-sm text-rose-600 dark:text-rose-400 font-sans">პრობლემური კითხვები</div>
              <div className="text-2xl font-bold font-mono text-rose-700 dark:text-rose-300">{report.problematicQuestions}</div>
            </div>
          </div>

          {report.issues.length > 0 && (
            <div className="space-y-3">
              <div className="text-sm font-semibold text-zinc-700 dark:text-zinc-200 dark:text-zinc-300 font-sans flex items-center space-x-1">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span>აღმოჩენილი სინტაქსური პრობლემები:</span>
              </div>
              <div className="max-h-60 overflow-y-auto border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-150 dark:divide-zinc-800 font-sans text-xs">
                {report.issues.map((issue: any, i: number) => (
                  <div key={i} className="p-3 hover:bg-zinc-50/50 dark:hover:bg-zinc-950/50 flex flex-col space-y-1">
                    <div className="flex justify-between font-medium">
                      <span className="text-zinc-800 dark:text-zinc-100 dark:text-zinc-200 font-mono">კითხვა #{issue.questionNumber}</span>
                      <span className="px-1.5 py-0.5 rounded-full bg-rose-50 dark:bg-rose-950 text-rose-600 dark:text-rose-300 text-[10px] font-semibold">
                        {issue.issueType === 'missing_correct' && 'სწორი პასუხის გარეშე'}
                        {issue.issueType === 'multiple_correct' && 'ორმაგი სწორი პასუხი'}
                        {issue.issueType === 'no_answers' && 'პასუხების გარეშე'}
                        {issue.issueType === 'empty_question' && 'ცარიელი კითხვა'}
                        {issue.issueType === 'duplicate_question' && 'დუბლიკატი'}
                        {issue.issueType === 'broken_format' && 'ფორმატი დარღვეულია'}
                        {issue.issueType === 'incomplete' && 'არასრული კითხვა'}
                      </span>
                    </div>
                    {issue.questionText && (
                      <div className="text-zinc-400 dark:text-zinc-500 italic truncate font-sans">"{issue.questionText}"</div>
                    )}
                    <div className="text-rose-600 dark:text-rose-300 font-mono">{issue.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sintax Guideline */}
      <div className="bg-amber-50/50 dark:bg-zinc-900 border border-amber-100 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
        <h3 className="text-base font-semibold text-amber-800 dark:text-amber-400 mb-2 font-sans flex items-center gap-1.5">
          <FileDown className="w-4 h-4" />
          სტანდარტული გაიდლაინი და ფაილის სინტაქსი
        </h3>
        <p className="text-xs text-zinc-600 dark:text-zinc-300 dark:text-zinc-400 dark:text-zinc-500 leading-relaxed font-sans mb-4">
          სისტემას გააჩნია ავტომატური დამუშავების ძრავა. ტესტების სწორად აღსაქმელად ფაილში დაიცავით შემდეგი მარტივი სინტაქსი:
        </p>
        <div className="bg-zinc-100 dark:bg-zinc-950 rounded-lg p-4 font-mono text-xs text-zinc-800 dark:text-zinc-100 dark:text-zinc-300 space-y-1.5">
          <p className="text-indigo-600 dark:text-indigo-400">//// რომელია საქართველოს დედაქალაქი?</p>
          <p className="text-zinc-400 dark:text-zinc-500">/// ქუთაისი</p>
          <p className="text-emerald-600 dark:text-emerald-400">// თბილისი</p>
          <p className="text-zinc-400 dark:text-zinc-500">/// ბათუმი</p>
          <p className="text-zinc-400 dark:text-zinc-500">/// გორი</p>
        </div>
      </div>
    </div>
  );
};
