'use client';

import { motion } from 'framer-motion';
import { QrCode, ScanLine } from 'lucide-react';

export function QRScanSection() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="premium-card grid overflow-hidden rounded-[34px] lg:grid-cols-[0.9fr_1.1fr]">
        <div className="p-8 sm:p-10">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C8A96B]">QR scan access</p>
          <h2 className="mt-4 text-4xl font-semibold text-[#0F0F0F]">A refined handoff from payment to pickup</h2>
          <p className="mt-5 leading-7 text-[#7A7A7A]">
            Customers receive elegant QR and PIN credentials while operators retain full visibility and revocation controls.
          </p>
        </div>
        <div className="premium-dark-card relative min-h-80 rounded-[34px] p-8 text-white lg:rounded-l-none">
          <ScanLine className="absolute right-8 top-8 text-[#D8BE8B]" size={34} />
          <motion.div
            animate={{ y: [0, 170, 0] }}
            transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
            className="absolute left-8 right-8 top-20 h-px bg-gradient-to-r from-transparent via-[#C8A96B] to-transparent"
          />
          <div className="grid h-full place-items-center">
            <div className="grid h-48 w-48 place-items-center rounded-[30px] border border-[#C8A96B]/35 bg-white p-5 text-[#0F0F0F] shadow-[0_0_60px_rgba(200,169,107,0.22)]">
              <QrCode size={118} />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
