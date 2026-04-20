<script setup lang="ts">
defineProps<{
  modelValue: string;
  showCreate: boolean;
  showAdmin: boolean;
}>();
const emit = defineEmits<{
  'update:modelValue': [value: string];
  'create-post': [];
  'open-admin': [];
}>();
</script>

<template>
  <div class="action-bar">
    <div class="search-box">
      <input
        type="text"
        placeholder="ПОИСК ПО НАЗВАНИЮ И ОПИСАНИЮ"
        :value="modelValue"
        @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      />
    </div>
    <div class="action-buttons">
      <button v-if="showCreate" class="add-btn" @click="emit('create-post')">+ ДОБАВИТЬ ОБЪЯВЛЕНИЕ</button>
      <button v-if="showAdmin" class="admin-btn" @click="emit('open-admin')">АДМИН ПАНЕЛЬ</button>
    </div>
  </div>
</template>

<style scoped>
.action-bar {
  padding: 1.5rem 2rem;
  display: grid;
  grid-template-columns: 1fr minmax(260px, 520px) 1fr;
  align-items: center;
  gap: 1rem;
}

.search-box {
  grid-column: 2;
  width: 100%;
}

.action-buttons {
  grid-column: 3;
  justify-self: end;
  display: flex;
  gap: 1rem;
}

.search-box input {
  width: 100%;
  padding: 12px 18px;
  border: 1px solid var(--lf-border-strong);
  border-radius: var(--lf-radius-pill);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.4px;
  color: #495057;
  background: var(--lf-surface);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

.search-box input:focus {
  outline: none;
  border: 1px solid var(--lf-accent);
  box-shadow:
    inset 0 1px 2px rgba(15, 23, 42, 0.04),
    0 0 0 3px rgba(255, 107, 107, 0.14);
}

body.dark-theme .search-box input {
  background-color: #2d2d2d;
  border: 1px solid #3d3d3d;
  color: #e9ecef;
}

.add-btn,
.admin-btn {
  padding: 10px 24px;
  border: none;
  border-radius: 60px;
  cursor: pointer;
  font-weight: 1000;
  font-size: 0.85rem;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.add-btn {
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: white;
  box-shadow: 0 2px 4px rgba(255, 107, 107, 0.3);
}

.add-btn:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.4);
}

.admin-btn {
  background-color: #6c757d;
  color: white;
}

.admin-btn:hover {
  background-color: #5a6268;
}

@media (max-width: 768px) {
  .action-bar {
    grid-template-columns: 1fr;
    align-items: stretch;
    padding: 1rem;
  }

  .search-box {
    grid-column: 1;
    width: 100%;
  }

  .action-buttons {
    grid-column: 1;
    justify-self: stretch;
    justify-content: center;
    flex-wrap: wrap;
  }
}
</style>
