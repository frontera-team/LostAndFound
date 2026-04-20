import { defineStore } from 'pinia';

import { api } from '@/api/client';
import type { CurrentUser, Me } from '@/types';

export const useAuthStore = defineStore('auth', {
  state: () => ({
    currentUser: null as CurrentUser | null,
    loaded: false,
  }),
  getters: {
    isAdmin: (state) => state.currentUser?.role === 'admin',
    isLoggedIn: (state) => state.currentUser !== null,
  },
  actions: {
    async loadUser(): Promise<void> {
      try {
        const res = await api.request('/api/auth/me');
        if (res.ok) {
          const u: Me | null = await res.json();
          this.currentUser = u
            ? {
                id: u.id,
                nickname: u.nickname,
                email: u.email,
                role: u.role_name,
                region_id: u.region_id,
                city_id: u.city_id,
              }
            : null;
        } else {
          this.currentUser = null;
        }
      } catch {
        this.currentUser = null;
      } finally {
        this.loaded = true;
      }
    },

    async logout(): Promise<void> {
      const rt = api.getRefresh();
      if (rt) {
        await api.request('/api/auth/logout', {
          method: 'POST',
          json: { refresh_token: rt },
        });
      }
      api.clearTokens();
      this.currentUser = null;
    },
  },
});
