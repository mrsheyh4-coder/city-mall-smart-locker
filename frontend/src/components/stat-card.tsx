interface StatCardProps {
  label: string;
  value: number;
  suffix?: string;
  tone: 'bronze' | 'light' | 'glass' | 'solid';
}

const toneClass = {
  bronze: 'text-[#ffffff] ring-[#b3806e]/28',
  light: 'text-[#ffffff] ring-[#ffffff]/18',
  glass: 'text-[#ffffff] ring-[#b3806e]/22',
  solid: 'text-[#ffffff] ring-[#ffffff]/12',
};

export function StatCard({ label, value, suffix, tone }: StatCardProps) {
  return (
    <section className={`luxury-card rounded-[1.65rem] bg-gradient-to-br from-[#ffffff]/[0.10] to-[#b3806e]/[0.08] ${toneClass[tone]} p-5 ring-1 transition duration-300 hover:-translate-y-1 hover:ring-[#b3806e]/55`}>
      <p className="text-sm font-medium text-[#ffffff]/60">{label}</p>
      <div className="mt-4 flex items-end justify-between">
        <strong className="text-4xl font-semibold tracking-normal text-white">
          {value}
          {suffix ? <span className="text-2xl text-[#ffffff]/70">{suffix}</span> : null}
        </strong>
        <span className="h-2.5 w-2.5 rounded-full bg-[#b3806e] shadow-[0_0_22px_rgba(179,128,110,0.8)]" />
      </div>
    </section>
  );
}
