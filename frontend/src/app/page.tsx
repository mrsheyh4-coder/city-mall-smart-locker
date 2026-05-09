'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { KeyRound, MonitorCog, ShieldCheck } from 'lucide-react';
import type { Language } from '@/lib/i18n';

const LANGUAGE_KEY = 'city-mall-language';
const languageOptions: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const homeText = {
  uz: {
    title: 'Smart Yashik Tizimi',
    subtitle: 'Terminal, admin panel, kirish loglari, tariflar va integratsiyaga tayyor yashik boshqaruvi.',
    terminal: 'Terminal',
    terminalDescription: "Mijozlar yashik tanlash, to'lov qilish, PIN/QR olish va qayta ochish uchun.",
    adminLogin: 'Admin kirish',
    adminDescription: "Admin panelga kirish, yashiklarni boshqarish, tarif va hisobotlarni ko'rish.",
  },
  ru: {
    title: 'Система Smart Locker',
    subtitle: 'Терминал, админ-панель, логи доступа, тарифы и готовое к интеграции управление ячейками.',
    terminal: 'Терминал',
    terminalDescription: 'Для выбора ячейки, оплаты, получения PIN/QR и повторного открытия.',
    adminLogin: 'Вход администратора',
    adminDescription: 'Вход в админ-панель, управление ячейками, тарифами и отчетами.',
  },
  en: {
    title: 'Smart Locker System',
    subtitle: 'Kiosk, admin panel, access logs, tariffs, and integration-ready locker control.',
    terminal: 'Terminal',
    terminalDescription: 'For customers to choose lockers, pay, receive PIN/QR and reopen access.',
    adminLogin: 'Admin login',
    adminDescription: 'Enter the admin panel, manage lockers, tariffs and reports.',
  },
} as const;

export default function Home() {
  const [language, setLanguage] = useState<Language>('uz');
  const t = homeText[language];

  useEffect(() => {
    const savedLanguage = window.localStorage.getItem(LANGUAGE_KEY);
    if (savedLanguage === 'uz' || savedLanguage === 'ru' || savedLanguage === 'en') {
      setLanguage(savedLanguage);
    }
  }, []);

  function changeLanguage(nextLanguage: Language) {
    setLanguage(nextLanguage);
    window.localStorage.setItem(LANGUAGE_KEY, nextLanguage);
  }

  return (
    <main className="luxury-bg min-h-screen text-[#ffffff]">
      <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col justify-center px-5 py-10 sm:px-8">
        <div className="max-w-3xl">
          <div className="mb-5 flex w-fit rounded-[1.35rem] border border-[#ffffff]/10 bg-[#ffffff]/[0.06] p-1">
            {languageOptions.map((item) => (
              <button
                key={item.code}
                type="button"
                onClick={() => changeLanguage(item.code)}
                className={`rounded-[1.1rem] px-3 py-2 text-xs font-bold transition ${
                  language === item.code
                    ? 'bg-[#b3806e] text-[#ffffff]'
                    : 'text-[#ffffff]/62 hover:text-[#ffffff]'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="inline-flex items-center gap-3 rounded-full border border-[#b3806e]/35 bg-[#b3806e]/12 px-5 py-3 text-sm font-bold uppercase text-[#ffffff]">
            <ShieldCheck size={18} />
            Tashkent City Mall
          </div>
          <h1 className="mt-6 text-4xl font-semibold tracking-normal sm:text-6xl">
            {t.title}
          </h1>
          <p className="mt-4 text-lg leading-8 text-[#ffffff]/70 sm:text-xl">
            {t.subtitle}
          </p>
        </div>

        <section className="mt-10 grid gap-4 md:grid-cols-2">
          <HomeLink
            href="/terminal"
            icon={<KeyRound size={32} />}
            title={t.terminal}
            description={t.terminalDescription}
          />
          <HomeLink
            href="/login"
            icon={<MonitorCog size={32} />}
            title={t.adminLogin}
            description={t.adminDescription}
          />
        </section>
      </div>
    </main>
  );
}

function HomeLink({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="luxury-card group min-h-44 rounded-[1.5rem] p-6 transition hover:-translate-y-1 hover:border-[#b3806e]/55 hover:bg-[#b3806e]/12"
    >
      <div className="text-[#b3806e] transition group-hover:text-[#ffffff]">{icon}</div>
      <h2 className="mt-5 text-2xl font-semibold">{title}</h2>
      <p className="mt-3 text-sm leading-6 text-[#ffffff]/68">{description}</p>
    </Link>
  );
}
