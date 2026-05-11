'use client';

import { motion } from 'framer-motion';
import { Activity, CreditCard, Gauge, ShieldCheck } from 'lucide-react';

const widgets = [
  { label: 'Total lockers', value: '60', icon: Gauge },
  { label: 'Occupancy', value: '74%', icon: Activity },
  { label: 'Revenue sync', value: 'Sheets', icon: CreditCard },
  { label: 'Access success', value: '96%', icon: ShieldCheck },
];

export function DashboardWidgets() {
  return (
    <section className="mx-auto w-full max-w-7xl px-5 py-12 sm:px-8 lg:px-10">
      <div className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
        <div className="premium-dark-card rounded-[32px] p-7 text-white">
          <p className="text-sm font-bold uppercase tracking-[0.18em] text-[#D8BE8B]">Enterprise dashboard</p>
          <h2 className="mt-4 text-4xl font-semibold leading-tight">Command center for mall operations</h2>
          <p className="mt-5 leading-7 text-white/60">
            Monitor lockers, bookings, payments, Google Sheets reports, staff alerts and service states in one luxury control surface.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          {widgets.map((widget, index) => {
            const Icon = widget.icon;
            return (
              <motion.div
                key={widget.label}
                initial={{ opacity: 0, y: 18 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ delay: index * 0.06 }}
                className="premium-card rounded-[26px] p-6"
              >
                <div className="flex items-center justify-between">
                  <span className="grid h-11 w-11 place-items-center rounded-[15px] bg-[#C8A96B]/16 text-[#C8A96B]">
                    <Icon size={21} />
                  </span>
                  <span className="h-2.5 w-2.5 rounded-full bg-[#C8A96B]" />
                </div>
                <p className="mt-8 text-sm font-medium text-[#7A7A7A]">{widget.label}</p>
                <p className="mt-2 text-4xl font-semibold text-[#0F0F0F]">{widget.value}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
