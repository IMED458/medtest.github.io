import React from 'react';
import { Activity, Volume2, Heart, Cpu, Baby } from 'lucide-react';

export const AuscultationSection: React.FC = () => {
  return (
    <div id="auscultation-section" className="space-y-6 max-w-4xl mx-auto">

      {/* Pediatric Auscultation Card */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-xs">

        {/* Header */}
        <div className="flex items-center gap-4 px-6 py-4 border-b border-zinc-100 dark:border-zinc-800 bg-gradient-to-r from-teal-50 to-cyan-50 dark:from-teal-950/30 dark:to-cyan-950/20">
          <div className="w-12 h-12 bg-teal-500 rounded-2xl flex items-center justify-center shadow-md shrink-0">
            <Baby className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-bold text-zinc-800 dark:text-zinc-100 font-sans tracking-tight">
              პედიატრიული აუსკულტაციის ტესტი
            </h2>
            <p className="text-[11px] text-teal-600 dark:text-teal-400 font-sans mt-0.5 font-medium">
              ბავშვთა სტეტოსკოპიის ინტერაქტიული სიმულატორი
            </p>
          </div>
        </div>

        {/* Iframe */}
        <div className="w-full" style={{ height: '680px' }}>
          <iframe
            src="https://imed458.github.io/pausc.github.io/"
            title="პედიატრიული აუსკულტაციის ტესტი"
            className="w-full h-full border-0"
            allow="autoplay; fullscreen"
            loading="lazy"
          />
        </div>
      </div>

      {/* Coming soon section */}
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-6 shadow-xs">
        <div className="flex items-center gap-2 mb-4">
          <Heart className="w-4 h-4 text-rose-500 animate-pulse" />
          <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-sans">
            მომავალში დაემატება
          </h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
            <Volume2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
            <div className="font-sans">
              <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">გულის ხმები</h4>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">ტონები, შუილები, კარდიოლოგიური ბაზა.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
            <Activity className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
            <div className="font-sans">
              <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">ფილტვების ხმები</h4>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">სუნთქვა, ხიხინი, ბრონქული ხმები.</p>
            </div>
          </div>
          <div className="p-3.5 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
            <Cpu className="w-5 h-5 text-purple-500 shrink-0 mt-0.5" />
            <div className="font-sans">
              <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">კლინიკური სიმ.</h4>
              <p className="text-[10px] text-zinc-400 dark:text-zinc-500 mt-0.5">ინტერაქტიული ვირტუალური ქეისები.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
