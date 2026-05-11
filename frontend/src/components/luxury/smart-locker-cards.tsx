'use client';

import { motion } from 'framer-motion';
import { DoorOpen, KeyRound, ScanQrCode } from 'lucide-react';

const cards = [
  {
    title: 'Locker Booking',
    text: 'Mobile-first kiosk flow for size, duration, phone verification, payment and locker selection.',
    icon: DoorOpen,
  },
  {
    title: 'PIN / QR Access',
    text: 'Elegant secure access model with expiring PIN and QR credentials for each booking.',
    icon: ScanQrCode,
  },
  {
    title: 'Operator Control',
    text: 'Admin-level controls for maintenance, releases, booking actions, tariffs and reporting.',
    icon: KeyRound,
  },
];

export function SmartLockerCards() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="mb-8 flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C8A96B]">Smart lockers</p>
          <h2 className="mt-3 text-3xl font-semibold text-[#0F0F0F] sm:text-5xl">
            Designed for a premium mall experience
          </h2>
        </div>
        <p className="max-w-xl text-base leading-7 text-[#7A7A7A]">
          Every panel is built for fast scanning, confident actions, and polished customer-facing presentation.
        </p>
      </div>
      <div className="grid gap-5 md:grid-cols-3">
        {cards.map((card, index) => {
          const Icon = card.icon;
          return (
            <motion.article
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '-80px' }}
              transition={{ delay: index * 0.08, duration: 0.5 }}
              className="premium-card group rounded-[28px] p-7 transition duration-300 hover:-translate-y-2 hover:border-[#C8A96B]/55"
            >
              <div className="grid h-14 w-14 place-items-center rounded-[18px] bg-[#0F0F0F] text-[#C8A96B] shadow-[0_18px_40px_rgba(15,15,15,0.18)] transition group-hover:scale-105">
                <Icon size={25} />
              </div>
              <h3 className="mt-7 text-2xl font-semibold text-[#0F0F0F]">{card.title}</h3>
              <p className="mt-4 leading-7 text-[#7A7A7A]">{card.text}</p>
            </motion.article>
          );
        })}
      </div>
    </section>
  );
}
