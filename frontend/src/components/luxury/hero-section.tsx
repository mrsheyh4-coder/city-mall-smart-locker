'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck, Sparkles } from 'lucide-react';

export function HeroSection() {
  return (
    <section className="relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_12%,rgba(200,169,107,0.22),transparent_32%),radial-gradient(circle_at_86%_24%,rgba(15,15,15,0.08),transparent_30%)]" />
      <div className="relative mx-auto grid min-h-[calc(100vh-5rem)] w-full max-w-7xl items-center gap-12 px-5 py-16 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:px-10">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.65, ease: 'easeOut' }}
          className="max-w-3xl"
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-[#C8A96B]/35 bg-white/70 px-4 py-2 text-xs font-bold uppercase tracking-[0.16em] text-[#0F0F0F] shadow-sm backdrop-blur">
            <Sparkles size={15} className="text-[#C8A96B]" />
            Premium smart mall ecosystem
          </div>
          <h1 className="mt-7 text-5xl font-semibold leading-[0.98] tracking-normal text-[#0F0F0F] sm:text-7xl lg:text-8xl">
            Tashkent City Mall
            <span className="block text-[#C8A96B]">Smart Locker</span>
          </h1>
          <p className="mt-7 max-w-2xl text-lg leading-8 text-[#7A7A7A] sm:text-xl">
            A luxury kiosk and enterprise dashboard for secure locker booking,
            payment, PIN/QR access, Google Sheets sync, and admin operations.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/terminal"
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-[14px] bg-[#C8A96B] px-7 text-base font-bold text-[#0F0F0F] shadow-[0_24px_60px_rgba(200,169,107,0.34)] transition hover:-translate-y-1 hover:scale-[1.02] hover:bg-[#D8BE8B]"
            >
              Open booking terminal
              <ArrowRight size={19} />
            </Link>
            <Link
              href="/admin"
              className="inline-flex min-h-14 items-center justify-center rounded-[14px] border border-[#E5E5E5] bg-white px-7 text-base font-bold text-[#0F0F0F] shadow-sm transition hover:-translate-y-1 hover:border-[#C8A96B]"
            >
              View admin dashboard
            </Link>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.7, ease: 'easeOut' }}
          className="premium-dark-card relative min-h-[32rem] overflow-hidden rounded-[32px] p-6 text-white"
        >
          <div className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-[#C8A96B] to-transparent" />
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-[#D8BE8B]">
                Live kiosk preview
              </p>
              <h2 className="mt-2 text-2xl font-semibold">Locker 024</h2>
            </div>
            <span className="rounded-full border border-[#C8A96B]/40 bg-[#C8A96B]/10 px-3 py-1 text-xs font-bold text-[#D8BE8B]">
              AVAILABLE
            </span>
          </div>

          <div className="mt-10 grid grid-cols-3 gap-3">
            {[1, 2, 3, 4, 5, 6].map((item) => (
              <motion.div
                key={item}
                whileHover={{ y: -6 }}
                className={`aspect-[0.82] rounded-[22px] border p-3 ${
                  item === 5
                    ? 'border-[#C8A96B] bg-[#C8A96B]/20 shadow-[0_0_42px_rgba(200,169,107,0.28)]'
                    : 'border-white/10 bg-white/[0.055]'
                }`}
              >
                <div className="flex h-full flex-col justify-between">
                  <span className="text-xs text-white/45">L-{String(item + 18).padStart(2, '0')}</span>
                  <span className="h-2 w-8 rounded-full bg-[#C8A96B]" />
                </div>
              </motion.div>
            ))}
          </div>

          <div className="mt-8 rounded-[26px] border border-white/10 bg-white/[0.07] p-5 backdrop-blur">
            <div className="flex items-center gap-3">
              <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#C8A96B] text-[#0F0F0F]">
                <ShieldCheck />
              </span>
              <div>
                <p className="font-semibold">Secure PIN + QR access</p>
                <p className="text-sm text-white/55">Ready for payment and reports</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}
