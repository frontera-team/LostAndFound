<script setup lang="ts">
import type { TabKey } from '@/types';

defineProps<{ modelValue: TabKey }>();
const emit = defineEmits<{ 'update:modelValue': [value: TabKey] }>();
</script>

<template>
  <div class="navigation-bar">
    <button class="nav-tab" :class="{ active: modelValue === 'searching' }" @click="emit('update:modelValue', 'searching')">
      В ПОИСКЕ
    </button>
    <button class="nav-tab" :class="{ active: modelValue === 'mine' }" @click="emit('update:modelValue', 'mine')">
      МОИ ОБЪЯВЛЕНИЯ
    </button>
    <button class="nav-tab" :class="{ active: modelValue === 'found' }" @click="emit('update:modelValue', 'found')">
      НАЙДЕНО
    </button>
  </div>
</template>

<style scoped>
.navigation-bar {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 0.65rem 1rem;
  padding: 1rem 2rem;
  background-color: var(--lf-surface);
  border-bottom: 1px solid var(--lf-border-strong);
  box-shadow: 0 4px 20px rgba(15, 23, 42, 0.04);
}

body.dark-theme .navigation-bar {
  background-color: #1e1e1e;
  border-bottom: 1px solid #2d2d2d;
}

.nav-tab {
  padding: 0.75rem 2rem;
  border: none;
  background: none;
  font-size: 0.9rem;
  font-weight: 1000;
  color: #6c757d;
  cursor: pointer;
  border-radius: 60px;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.nav-tab:hover {
  color: var(--lf-accent);
  background-color: var(--lf-accent-soft);
}

.nav-tab.active {
  color: var(--lf-accent);
  background-color: var(--lf-accent-soft);
  box-shadow: 0 0 0 1px rgba(255, 107, 107, 0.15);
}

body.dark-theme .nav-tab {
  color: #adb5bd;
}

body.dark-theme .nav-tab:hover,
body.dark-theme .nav-tab.active {
  color: #ff8787;
  background-color: #2d2d2d;
}

@media (max-width: 768px) {
  .navigation-bar {
    flex-direction: column;
    align-items: center;
  }

  .nav-tab {
    width: 100%;
    max-width: 200px;
  }
}
</style>
