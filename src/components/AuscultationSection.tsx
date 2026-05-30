import React from 'react';
import { Activity, Volume2, Heart, ShieldAlert, Cpu } from 'lucide-react';

export const AuscultationSection: React.FC = () => {
  return (
    <div id="auscultation-section" className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 shadow-xs max-w-3xl mx-auto text-center space-y-6">
      <div className="w-16 h-16 bg-rose-50 dark:bg-rose-950/20 rounded-2xl flex items-center justify-center mx-auto text-rose-550 dark:text-rose-400">
        <Heart className="w-8 h-8 animate-pulse" />
      </div>

      <div className="space-y-2">
        <h2 className="text-2xl font-bold text-zinc-800 dark:text-zinc-100 dark:text-zinc-150 font-sans tracking-tight">
          აუკულტაციის მოდული მზადდება
        </h2>
        <p className="text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 text-xs font-sans max-w-md mx-auto leading-relaxed">
          სამედიცინო მიმართულების სტუდენტებისთვის განკუთვნილი ინტერაქტიული სიმულატორი, რომელიც დაგეხმარებათ პრაქტიკული უნარ-ჩვევების გაუმჯობესებაში.
        </p>
      </div>

      <hr className="border-zinc-100 dark:border-zinc-800" />

      <h3 className="text-xs font-bold text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 uppercase tracking-widest font-sans">მომავალში დაემატება:</h3>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
        <div className="p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
          <Volume2 className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
          <div className="font-sans">
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">აუდიო ტესტები</h4>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">სმენითი აღქმის ტესტები კლინიკური დიაგნოსტიკისთვის.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
          <Heart className="w-5 h-5 text-rose-555 shrink-0 mt-0.5" />
          <div className="font-sans">
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">გულის ხმები</h4>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">ტონების, შუილებისა და სხვა არანორმალური კარდიოლოგიური რიტმების ბაზა.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
          <Activity className="w-5 h-5 text-emerald-550 shrink-0 mt-0.5" />
          <div className="font-sans">
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">ფილტვების ხმები</h4>
            <p className="text-[10px] text-zinc-450 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">სუნთქვის ხმების, ხიხინისა და ბრონქული ასპირაციის ნიმუშები.</p>
          </div>
        </div>

        <div className="p-4 rounded-xl border border-zinc-150 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/40 flex items-start gap-3">
          <Cpu className="w-5 h-5 text-purple-550 shrink-0 mt-0.5" />
          <div className="font-sans">
            <h4 className="font-semibold text-zinc-700 dark:text-zinc-200 text-xs">კლინიკური სიმულაციები</h4>
            <p className="text-[10px] text-zinc-400 dark:text-zinc-500 dark:text-zinc-400 dark:text-zinc-500 mt-0.5">ინტერაქტიული ქეისები ფონოენდოსკოპის ვირტუალური გამოყენებით.</p>
          </div>
        </div>
      </div>
    </div>
  );
};
