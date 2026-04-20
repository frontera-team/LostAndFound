<script setup lang="ts">
import { useRouter } from 'vue-router';

import AppLogo from '@/components/AppLogo.vue';
import { useTheme } from '@/composables/useTheme';
import { useAuthStore } from '@/stores/auth';

const emit = defineEmits<{ 'open-auth': []; 'logged-out': [] }>();

const { theme, setTheme } = useTheme();
const auth = useAuthStore();
const router = useRouter();

async function logout(): Promise<void> {
  await auth.logout();
  emit('logged-out');
}

function goToProfile(): void {
  router.push('/profile');
}
</script>

<template>
  <header>
    <AppLogo />

    <div class="theme-switch-wrapper">
      <div class="theme-switch-container">
        <div class="theme-slider" :class="theme"></div>
        <button class="theme-option" :class="{ active: theme === 'light' }" @click="setTheme('light')">
          СВЕТЛАЯ
        </button>
        <button class="theme-option" :class="{ active: theme === 'dark' }" @click="setTheme('dark')">
          ТЕМНАЯ
        </button>
      </div>
    </div>

    <div class="auth-buttons">
      <template v-if="auth.currentUser">
        <span class="auth-btn auth-btn--nickname">{{ auth.currentUser.nickname }}</span>
        <button class="auth-btn" @click="goToProfile">ПРОФИЛЬ</button>
        <button class="auth-btn" @click="logout">ВЫЙТИ</button>
      </template>
      <template v-else>
        <button class="auth-btn" @click="emit('open-auth')">ВХОД / РЕГИСТРАЦИЯ</button>
      </template>
    </div>
  </header>
</template>

<style scoped>
header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem 2rem;
  background-color: var(--lf-surface);
  box-shadow:
    0 1px 0 var(--lf-border),
    var(--lf-shadow-card);
  flex-wrap: wrap;
  gap: 1rem;
  border-bottom: 1px solid var(--lf-border-strong);
}

body.dark-theme header {
  background-color: #1e1e1e;
  border-bottom: 1px solid #2d2d2d;
}

.theme-switch-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
}

.theme-switch-container {
  background-color: #e9ecef;
  border-radius: 60px;
  padding: 4px;
  display: inline-flex;
  gap: 4px;
  position: relative;
  box-shadow:
    inset 0 1px 3px rgba(0, 0, 0, 0.1),
    0 1px 2px rgba(0, 0, 0, 0.05);
}

body.dark-theme .theme-switch-container {
  background-color: #2d2d2d;
}

.theme-option {
  padding: 8px 20px;
  border: none;
  background: transparent;
  cursor: pointer;
  font-weight: 1000;
  font-size: 0.85rem;
  border-radius: 60px;
  position: relative;
  z-index: 2;
  transition: color 0.3s ease;
  color: #6c757d;
  letter-spacing: 0.5px;
}

.theme-option.active {
  color: white;
}

.theme-slider {
  position: absolute;
  top: 4px;
  bottom: 4px;
  width: calc(50% - 4px);
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  border-radius: 60px;
  transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  z-index: 1;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.theme-slider.light {
  transform: translateX(0);
}

.theme-slider.dark {
  transform: translateX(calc(100% + 4px));
}

.auth-buttons {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.auth-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 60px;
  cursor: pointer;
  font-weight: 1000;
  font-size: 0.85rem;
  transition: all 0.2s;
  letter-spacing: 0.5px;
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: white;
}

.auth-btn:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.auth-btn--nickname {
  background: linear-gradient(135deg, #6c757d, #5a6268);
  cursor: default;
}

.auth-btn--nickname:hover {
  box-shadow: none;
}

@media (max-width: 768px) {
  header {
    flex-direction: column;
    text-align: center;
  }

  .theme-switch-container {
    width: 100%;
  }

  .theme-option {
    flex: 1;
    text-align: center;
  }
}
</style>
