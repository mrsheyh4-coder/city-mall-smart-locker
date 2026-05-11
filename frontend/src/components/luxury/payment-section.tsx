'use client';

import { motion } from 'framer-motion';
import { CreditCard, ReceiptText, WalletCards } from 'lucide-react';

export function PaymentSection() {
  return (
    <section className="mx-auto grid w-full max-w-7xl gap-6 px-5 py-12 sm:px-8 lg:grid-cols-2 lg:px-10">
      <motion.div
        initial={{ opacity: 0, x: -22 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="premium-card rounded-[32px] p-8"
      >
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C8A96B]">Payment flow</p>
        <h2 className="mt-4 text-4xl font-semibold text-[#0F0F0F]">Fast checkout with premium clarity</h2>
        <p className="mt-5 leading-7 text-[#7A7A7A]">
          The payment experience is designed for kiosk speed: clear price, service status, receipt-ready data, and simple next steps.
        </p>
        <div className="mt-8 grid gap-3">
          {['Mock payment ready', 'Payme / Click credential-ready', 'Google Sheets payment export'].map((item) => (
            <div key={item} className="flex items-center gap-3 rounded-[18px] border border-[#E5E5E5] bg-[#F5F5F3] p-4">
              <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#C8A96B] text-[#0F0F0F]">
                <ReceiptText size={17} />
              </span>
              <span className="font-semibold text-[#0F0F0F]">{item}</span>
            </div>
          ))}
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 22 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        className="premium-dark-card rounded-[32px] p-8 text-white"
      >
        <div className="flex items-center justify-between">
          <span className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#C8A96B] text-[#0F0F0F]">
            <WalletCards size={25} />
          </span>
          <CreditCard className="text-[#D8BE8B]" />
        </div>
        <p className="mt-10 text-sm font-bold uppercase tracking-[0.18em] text-[#D8BE8B]">Current basket</p>
        <h3 className="mt-3 text-5xl font-semibold">20,000 UZS</h3>
        <div className="mt-8 rounded-[24px] border border-white/10 bg-white/[0.07] p-5">
          <div className="flex justify-between text-sm text-white/60">
            <span>Locker</span>
            <span>L-024</span>
          </div>
          <div className="mt-3 flex justify-between text-sm text-white/60">
            <span>Duration</span>
            <span>60 min</span>
          </div>
          <div className="mt-5 h-px bg-white/10" />
          <div className="mt-5 flex justify-between font-semibold">
            <span>Status</span>
            <span className="text-[#D8BE8B]">Ready</span>
          </div>
        </div>
      </motion.div>
    </section>
  );
}
