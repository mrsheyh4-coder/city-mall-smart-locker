'use client';

import { motion } from 'framer-motion';
import { Bell, FileSpreadsheet, SlidersHorizontal } from 'lucide-react';

export function AdminPanelPreview() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="mb-8">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#C8A96B]">Admin panel</p>
        <h2 className="mt-3 text-3xl font-semibold text-[#0F0F0F] sm:text-5xl">Luxury controls for operational teams</h2>
      </div>
      <div className="grid gap-5 lg:grid-cols-3">
        {[
          ['Tariff management', 'Create, edit, delete and sync tariffs to Google Sheets.', SlidersHorizontal],
          ['Staff alerts', 'Maintenance and access actions are logged for operators.', Bell],
          ['Sheets integration', 'Payments and tariffs sync with a live spreadsheet.', FileSpreadsheet],
        ].map(([title, text, Icon], index) => (
          <motion.article
            key={String(title)}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: index * 0.08 }}
            className="premium-card rounded-[28px] p-7"
          >
            <span className="grid h-12 w-12 place-items-center rounded-[16px] bg-[#0F0F0F] text-[#C8A96B]">
              <Icon size={22} />
            </span>
            <h3 className="mt-7 text-2xl font-semibold text-[#0F0F0F]">{String(title)}</h3>
            <p className="mt-4 leading-7 text-[#7A7A7A]">{String(text)}</p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
