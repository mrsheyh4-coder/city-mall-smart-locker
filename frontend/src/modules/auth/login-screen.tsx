'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import type { Language } from '@/lib/i18n';
import { useAuthStore } from '@/store/auth-store';

const LANGUAGE_KEY = 'city-mall-language';
const languageOptions: { code: Language; label: string }[] = [
  { code: 'uz', label: "O'zbek" },
  { code: 'ru', label: 'Русский' },
  { code: 'en', label: 'English' },
];

const loginText = {
  uz: {
    title: 'Admin kirish',
    subtitle: 'Tashkent City Mall xavfsiz demo',
    button: 'Admin panelga kirish',
    pin: 'Demo PIN',
    invalid: "Demo PIN noto'g'ri",
  },
  ru: {
    title: 'Вход администратора',
    subtitle: 'Безопасное демо Tashkent City Mall',
    button: 'Войти в админ-панель',
    pin: 'Демо PIN',
    invalid: 'Неверный демо PIN',
  },
  en: {
    title: 'Admin login',
    subtitle: 'Tashkent City Mall secure demo',
    button: 'Enter admin panel',
    pin: 'Demo PIN',
    invalid: 'Invalid demo PIN',
  },
} as const;

export function LoginScreen() {
  const [language, setLanguage] = useState<Language>('uz');
  const [pin, setPin] = useState('2026');
  const [error, setError] = useState('');
  const router = useRouter();
  const { hydrate, login, user } = useAuthStore();
  const t = loginText[language];

  useEffect(() => {
    hydrate();
  }, [hydrate]);

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

  useEffect(() => {
    if (user) {
      router.replace('/admin');
    }
  }, [router, user]);

  return (
    <main className="luxury-bg grid min-h-screen place-items-center px-5 text-[#ffffff]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(179,128,110,0.24),transparent_34%)]" />
      <Card className="relative w-full max-w-md p-7 shadow-[0_30px_90px_rgba(26,33,47,0.32)]">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[#b3806e] text-[#ffffff] shadow-[0_0_32px_rgba(179,128,110,0.35)]">
            <Sparkles size={20} />
          </div>
          <div>
            <h1 className="text-2xl font-semibold">{t.title}</h1>
            <p className="text-sm text-[#ffffff]/62">{t.subtitle}</p>
          </div>
        </div>
        <div className="mt-5 flex rounded-[1.35rem] border border-[#ffffff]/10 bg-[#ffffff]/[0.06] p-1">
          {languageOptions.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => changeLanguage(item.code)}
              className={`flex-1 rounded-[1.1rem] px-3 py-2 text-xs font-bold transition ${
                language === item.code
                  ? 'bg-[#b3806e] text-[#ffffff]'
                  : 'text-[#ffffff]/62 hover:text-[#ffffff]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <form
          className="mt-7 grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!(await login(pin))) {
              setError(t.invalid);
              return;
            }
            router.replace('/admin');
          }}
        >
          <Input value={pin} onChange={(event) => setPin(event.target.value)} placeholder={t.pin} />
          {error ? <p className="text-sm text-[#b3806e]">{error}</p> : null}
          <Button type="submit">
            <LockKeyhole size={18} />
            {t.button}
          </Button>
        </form>
        <p className="mt-5 text-xs text-[#ffffff]/45">{t.pin}: 2026</p>
      </Card>
    </main>
  );
}
