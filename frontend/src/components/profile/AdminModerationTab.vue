<script setup lang="ts">
import { ref, watch } from 'vue';

import { api } from '@/api/client';
import type { AnnouncementDto, Paginated } from '@/types';

const props = defineProps<{ active: boolean }>();

const items = ref<AnnouncementDto[]>([]);
const errorMessage = ref('');
const busyId = ref<number | null>(null);
const loading = ref(false);

function hint(a: AnnouncementDto): string {
  return a.publish_in_found ? 'После публикации: раздел «Найдено»' : 'После публикации: «В поиске»';
}

async function load(): Promise<void> {
  loading.value = true;
  errorMessage.value = '';
  const res = await api.request('/api/announcements?state=moderation&moderation_scope=all&limit=100&page=1');
  if (!res.ok) {
    items.value = [];
    errorMessage.value = await api.parseError(res);
    loading.value = false;
    return;
  }
  const data: Paginated<AnnouncementDto> = await res.json();
  items.value = data.items || [];
  loading.value = false;
}

async function runAction(id: number, action: 'approve' | 'reject' | 'delete'): Promise<void> {
  if (action === 'reject' && !confirm('Отклонить объявление?')) return;
  if (action === 'delete' && !confirm('Удалить объявление безвозвратно?')) return;

  busyId.value = id;
  try {
    let res: Response;
    if (action === 'approve') res = await api.request(`/api/announcements/${id}/approve`, { method: 'POST' });
    else if (action === 'reject') res = await api.request(`/api/announcements/${id}/reject`, { method: 'POST' });
    else res = await api.request(`/api/announcements/${id}`, { method: 'DELETE' });

    if (res.ok) await load();
    else alert(await api.parseError(res));
  } finally {
    busyId.value = null;
  }
}

watch(
  () => props.active,
  (isActive) => {
    if (isActive) load();
  },
  { immediate: true },
);
</script>

<template>
  <div class="profile-mod-toolbar">
    <span class="profile-mod-toolbar-title">ОЧЕРЕДЬ МОДЕРАЦИИ</span>
    <span class="profile-mod-count">{{ items.length }}</span>
  </div>
  <p class="profile-mod-lead">Все объявления со статусом «на модерации». Нажмите «пропустить», чтобы опубликовать в ленте.</p>

  <div class="profile-moderation-list">
    <div v-if="loading" class="profile-empty">ЗАГРУЗКА…</div>
    <div v-else-if="errorMessage" class="profile-empty">{{ errorMessage }}</div>
    <div v-else-if="items.length === 0" class="profile-empty">НЕТ ОБЪЯВЛЕНИЙ НА МОДЕРАЦИИ</div>
    <div v-for="a in items" v-else :key="a.id" class="profile-mod-card">
      <div class="profile-mod-card-info">
        <div class="profile-mod-title">{{ a.ann_name }}</div>
        <div class="profile-mod-meta">{{ a.author_nickname || '—' }} · {{ hint(a) }}</div>
      </div>
      <div class="profile-mod-actions">
        <button
          class="profile-mod-btn profile-mod-btn--approve"
          :disabled="busyId === a.id"
          @click="runAction(a.id, 'approve')"
        >
          ПРОПУСТИТЬ
        </button>
        <button class="profile-mod-btn profile-mod-btn--reject" :disabled="busyId === a.id" @click="runAction(a.id, 'reject')">
          ОТКЛОНИТЬ
        </button>
        <button class="profile-mod-btn profile-mod-btn--delete" :disabled="busyId === a.id" @click="runAction(a.id, 'delete')">
          УДАЛИТЬ
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.profile-mod-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
  padding-bottom: 10px;
  border-bottom: 2px solid #e9ecef;
}

.profile-mod-toolbar-title {
  font-size: 0.78rem;
  font-weight: 1000;
  letter-spacing: 0.45px;
  color: #495057;
}

.profile-mod-count {
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: #fff;
  padding: 4px 12px;
  border-radius: 30px;
  font-size: 0.72rem;
  font-weight: 1000;
}

.profile-mod-lead {
  font-size: 0.82rem;
  color: #6c757d;
  line-height: 1.45;
  margin-bottom: 16px;
}

.profile-moderation-list {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(520px, 70vh);
  overflow-y: auto;
}

.profile-mod-card {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border: 1px solid #e9ecef;
  border-radius: 16px;
  background: #fff;
}

.profile-mod-card-info {
  flex: 1;
  min-width: min(100%, 200px);
}

.profile-mod-title {
  font-size: 0.98rem;
  font-weight: 1000;
  color: #212529;
  margin-bottom: 6px;
}

.profile-mod-meta {
  font-size: 0.78rem;
  color: #6c757d;
  line-height: 1.35;
}

.profile-mod-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  justify-content: flex-end;
}

.profile-mod-btn {
  border: none;
  border-radius: 30px;
  padding: 8px 16px;
  font-size: 0.72rem;
  font-weight: 1000;
  letter-spacing: 0.4px;
  cursor: pointer;
  transition:
    transform 0.15s ease,
    box-shadow 0.15s ease;
}

.profile-mod-btn:hover:not(:disabled) {
  transform: translateY(-1px);
}

.profile-mod-btn:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}

.profile-mod-btn--approve {
  background: #28a745;
  color: #fff;
}

.profile-mod-btn--reject {
  background: #dc3545;
  color: #fff;
}

.profile-mod-btn--delete {
  background: #6c757d;
  color: #fff;
}
</style>
