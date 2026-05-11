'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { Building2, LayoutDashboard, LockKeyhole, ScanQrCode } from 'lucide-react';

const navItems = [
  { href: '/terminal', label: 'Booking', icon: ScanQrCode },
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/login', label: 'Admin', icon: LockKeyhole },
];

export function Navbar() {
  return (
    <motion.header
      initial={{ opacity: 0, y: -18 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.55, ease: 'easeOut' }}
      className="sticky top-0 z-40 border-b border-[#C8A96B]/15 bg-[#0F0F0F]/95 text-white shadow-[0_18px_60px_rgba(15,15,15,0.22)] backdrop-blur-xl"
    >
      <div className="mx-auto flex min-h-20 w-full max-w-7xl items-center justify-between gap-4 px-5 sm:px-8 lg:px-10">
        <Link href="/" className="flex min-w-0 items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-[14px] bg-[#C8A96B] text-[#0F0F0F]">
            <Building2 size={22} />
          </span>
          <span className="min-w-0">
            <span className="block text-sm font-semibold uppercase tracking-[0.18em] text-[#D8BE8B]">
              City Mall
            </span>
            <span className="block truncate text-lg font-semibold">Smart Locker</span>
          </span>
        </Link>

        <nav className="hidden items-center gap-2 md:flex">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className="group inline-flex min-h-11 items-center gap-2 rounded-[14px] px-4 text-sm font-semibold text-white/72 transition hover:bg-white/8 hover:text-[#D8BE8B]"
              >
                <Icon size={17} className="text-[#C8A96B] transition group-hover:scale-110" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <Link
          href="/terminal"
          className="hidden min-h-11 items-center rounded-[14px] border border-[#C8A96B] bg-[#C8A96B] px-5 text-sm font-bold text-[#0F0F0F] shadow-[0_18px_42px_rgba(200,169,107,0.30)] transition hover:-translate-y-0.5 hover:scale-[1.02] hover:bg-[#D8BE8B] md:inline-flex"
        >
          Start booking
        </Link>
      </div>
    </motion.header>
  );
}
