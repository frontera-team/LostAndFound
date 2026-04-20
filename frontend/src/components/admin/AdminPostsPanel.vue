<script setup lang="ts">
import { ref, watch } from 'vue';

import { api } from '@/api/client';
import type { AdminStatus, AnnouncementDto, Paginated } from '@/types';

const props = defineProps<{ status: AdminStatus }>();
const emit = defineEmits<{ changed: [] }>();

const items = ref<AnnouncementDto[]>([]);
const errorMessage = ref('');
const selected = ref<Set<number>>(new Set());
const busy = ref(false);

function moderationHint(a: AnnouncementDto): string {
  return a.publish_in_found ? 'После одобрения: «Найдено»' : 'После одобрения: «В поиске»';
}

async function load(): Promise<void> {
  errorMessage.value = '';
  selected.value = new Set();
  const path =
    props.status === 'active'
      ? '/api/announcements?state=moderation&moderation_scope=all&limit=100&page=1'
      : '/api/announcements?state=rejected&limit=100&page=1';
  const res = await api.request(path);
  if (!res.ok) {
    items.value = [];
    errorMessage.value = await api.parseError(res);
    return;
  }
  const data: Paginated<AnnouncementDto> = await res.json();
  items.value = data.items || [];
}

async function approve(id: number): Promise<void> {
  const res = await api.request(`/api/announcements/${id}/approve`, { method: 'POST' });
  if (res.ok) {
    await load();
    emit('changed');
  } else {
    alert(await api.parseError(res));
  }
}

async function reject(id: number): Promise<void> {
  if (!confirm('Отклонить объявление?')) return;
  const res = await api.request(`/api/announcements/${id}/reject`, { method: 'POST' });
  if (res.ok) {
    await load();
    emit('changed');
  } else {
    alert(await api.parseError(res));
  }
}

async function remove(id: number): Promise<void> {
  if (!confirm('Удалить объявление безвозвратно?')) return;
  const res = await api.request(`/api/announcements/${id}`, { method: 'DELETE' });
  if (res.ok) {
    await load();
    emit('changed');
  } else {
    alert(await api.parseError(res));
  }
}

function toggleSelected(id: number, checked: boolean): void {
  const next = new Set(selected.value);
  if (checked) next.add(id);
  else next.delete(id);
  selected.value = next;
}

async function unbanSelected(): Promise<void> {
  if (selected.value.size === 0) {
    alert('Отметьте объявления галочками');
    return;
  }
  if (!confirm(`Вернуть в ленту объявлений: ${selected.value.size} шт.?`)) return;
  busy.value = true;
  try {
    for (const id of selected.value) {
      const res = await api.request(`/api/announcements/${id}/approve`, { method: 'POST' });
      if (!res.ok) {
        alert(await api.parseError(res));
        break;
      }
    }
    await load();
    emit('changed');
  } finally {
    busy.value = false;
  }
}

watch(() => props.status, load, { immediate: true });

defineExpose({ load });
</script>

<template>
  <div class="admin-content">
    <div class="admin-content-header">
      <span>{{ status === 'active' ? 'ОБЪЯВЛЕНИЯ НА МОДЕРАЦИИ' : 'ЗАБЛОКИРОВАННЫЕ ОБЪЯВЛЕНИЯ' }}</span>
      <span class="content-count">{{ items.length }}</span>
    </div>

    <div v-if="errorMessage" class="info-message">{{ errorMessage }}</div>
    <div v-else-if="items.length === 0" class="info-message">
      {{ status === 'active' ? 'НЕТ ОБЪЯВЛЕНИЙ НА МОДЕРАЦИИ' : 'НЕТ ОТКЛОНЁННЫХ ОБЪЯВЛЕНИЙ' }}
    </div>
    <div v-else class="admin-list">
      <div v-for="a in items" :key="a.id" class="admin-card" :class="{ 'admin-card-banned': status === 'banned' }">
        <label v-if="status === 'banned'" class="admin-banned-select">
          <input
            type="checkbox"
            aria-label="Выбрать объявление"
            @change="toggleSelected(a.id, ($event.target as HTMLInputElement).checked)"
          />
        </label>
        <div class="admin-card-info">
          <div class="admin-card-name">{{ a.ann_name }}</div>
          <div class="admin-card-email">
            {{ a.author_nickname || '—' }} · {{ status === 'active' ? moderationHint(a) : 'отклонено' }}
          </div>
        </div>
        <div class="admin-card-actions">
          <template v-if="status === 'active'">
            <button class="admin-approve-post-btn" @click="approve(a.id)">ОДОБРИТЬ</button>
            <button class="admin-reject-post-btn" @click="reject(a.id)">ОТКЛОНИТЬ</button>
            <button class="admin-delete-post-btn" @click="remove(a.id)">УДАЛИТЬ</button>
          </template>
          <template v-else>
            <button class="admin-unban-post-btn" @click="approve(a.id)">ВЕРНУТЬ</button>
            <button class="admin-delete-banned-post-btn" @click="remove(a.id)">УДАЛИТЬ</button>
          </template>
        </div>
      </div>
    </div>

    <button v-if="status === 'banned'" class="admin-unban-btn" :disabled="busy" @click="unbanSelected">
      РАЗБЛОКИРОВАТЬ ВЫБРАННЫЕ
    </button>
  </div>
</template>

<style scoped>
.admin-content {
  margin-top: 24px;
  animation: fadeIn 0.3s ease;
}

.admin-content-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 14px;
  padding-bottom: 12px;
  border-bottom: 1px solid var(--lf-border);
  font-weight: 1000;
  font-size: 0.82rem;
  color: #495057;
  letter-spacing: 0.45px;
}

body.dark-theme .admin-content-header {
  border-bottom: 1px solid #3d3d3d;
  color: #adb5bd;
}

.content-count {
  background: linear-gradient(135deg, var(--lf-accent), var(--lf-accent-mid));
  color: white;
  padding: 5px 13px;
  border-radius: var(--lf-radius-pill);
  font-size: 0.72rem;
  font-weight: 1000;
  box-shadow: 0 2px 8px rgba(255, 107, 107, 0.25);
  min-width: 1.75rem;
  text-align: center;
}

.info-message {
  background: #fff3cd;
  border: 1px solid #ffc107;
  color: #856404;
  padding: 12px 16px;
  border-radius: 16px;
  font-size: 0.75rem;
  font-weight: 1000;
  margin-bottom: 16px;
  text-align: center;
}

body.dark-theme .info-message {
  background: #2d2d2d;
  border: 1px solid #ffc107;
  color: #ffc107;
}

.admin-list {
  max-height: min(420px, 52vh);
  overflow-y: auto;
  overflow-x: hidden;
  display: flex;
  flex-direction: column;
  gap: 12px;
  padding: 4px 6px 4px 2px;
  scrollbar-width: thin;
  scrollbar-color: #ced4da #f1f3f5;
}

.admin-list::-webkit-scrollbar {
  width: 8px;
}

.admin-list::-webkit-scrollbar-track {
  background: #f1f3f5;
  border-radius: 8px;
}

.admin-list::-webkit-scrollbar-thumb {
  background: #ced4da;
  border-radius: 8px;
}

.admin-list::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

body.dark-theme .admin-list {
  scrollbar-color: #495057 #2d2d2d;
}

body.dark-theme .admin-list::-webkit-scrollbar-track {
  background: #2d2d2d;
}

body.dark-theme .admin-list::-webkit-scrollbar-thumb {
  background: #495057;
}

body.dark-theme .admin-list::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}

.admin-card {
  background: var(--lf-surface);
  border-radius: var(--lf-radius-md);
  padding: 16px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  border: 1px solid var(--lf-border);
  box-shadow: var(--lf-shadow-card);
  transition: box-shadow 0.2s ease;
}

.admin-card:hover {
  box-shadow: var(--lf-shadow-card-hover);
}

body.dark-theme .admin-card {
  background-color: var(--lf-surface);
  border: 1px solid var(--lf-border-strong);
}

.admin-card-banned {
  gap: 12px;
}

.admin-banned-select {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  cursor: pointer;
}

.admin-banned-select input {
  width: 18px;
  height: 18px;
  cursor: pointer;
}

.admin-card-info {
  flex: 1;
}

.admin-card-name {
  font-weight: 1000;
  font-size: 1rem;
  color: #212529;
  margin-bottom: 4px;
}

body.dark-theme .admin-card-name {
  color: #e9ecef;
}

.admin-card-email {
  font-size: 0.8rem;
  color: #6c757d;
  margin-top: 2px;
}

body.dark-theme .admin-card-email {
  color: #868e96;
}

.admin-card-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.admin-approve-post-btn,
.admin-unban-post-btn,
.admin-reject-post-btn,
.admin-delete-post-btn,
.admin-delete-banned-post-btn {
  padding: 8px 20px;
  border: none;
  border-radius: 30px;
  font-size: 0.75rem;
  font-weight: 1000;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.admin-approve-post-btn,
.admin-unban-post-btn {
  background-color: #28a745;
  color: white;
}

.admin-approve-post-btn:hover,
.admin-unban-post-btn:hover {
  background-color: #218838;
}

.admin-reject-post-btn {
  background-color: #dc3545;
  color: white;
}

.admin-reject-post-btn:hover {
  background-color: #c82333;
}

.admin-delete-post-btn,
.admin-delete-banned-post-btn {
  background-color: #6c757d;
  color: white;
}

.admin-delete-post-btn:hover,
.admin-delete-banned-post-btn:hover {
  background-color: #5a6268;
}

.admin-unban-btn {
  margin-top: 20px;
  width: 100%;
  padding: 12px;
  background: linear-gradient(135deg, #28a745, #20c997);
  color: white;
  border: none;
  border-radius: 60px;
  font-size: 0.85rem;
  font-weight: 1000;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.admin-unban-btn:hover {
  box-shadow: 0 4px 12px rgba(40, 167, 69, 0.3);
}

.admin-unban-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
