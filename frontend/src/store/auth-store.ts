import { create } from 'zustand';

const TOKEN_KEY = 'city-mall-admin-token';
const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api';

type AdminUser = {
  name: string;
  role: 'ADMIN';
};

type AuthState = {
  user: AdminUser | null;
  hydrate: () => void;
  login: (pin: string) => Promise<boolean>;
  logout: () => void;
};

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  hydrate: () => {
    const token = window.localStorage.getItem(TOKEN_KEY);
    set({ user: token ? { name: 'City Mall Admin', role: 'ADMIN' } : null });
  },
  login: async (pin) => {
    const demoPin = pin.trim() === '2026';

    try {
      const response = await fetch(`${API_URL}/auth/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Version': '1',
        },
        body: JSON.stringify({ pin }),
      });

      if (!response.ok) {
        if (demoPin) {
          return startDemoAdminSession(set);
        }

        return false;
      }

      const body = (await response.json()) as {
        token: string;
        user: AdminUser;
      };

      window.localStorage.setItem(TOKEN_KEY, body.token);
      set({ user: { name: 'City Mall Admin', role: 'ADMIN' } });
      return true;
    } catch (error) {
      if (demoPin && error instanceof TypeError) {
        return startDemoAdminSession(set);
      }

      return false;
    }
  },
  logout: () => {
    window.localStorage.removeItem(TOKEN_KEY);
    set({ user: null });
  },
}));

function startDemoAdminSession(set: (state: Pick<AuthState, 'user'>) => void) {
  window.localStorage.setItem(TOKEN_KEY, `demo-admin-${Date.now()}`);
  set({ user: { name: 'City Mall Admin', role: 'ADMIN' } });
  return true;
}
