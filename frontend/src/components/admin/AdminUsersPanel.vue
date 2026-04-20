<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { api } from '@/api/client';
import { getAdminRoleId } from '@/composables/useAdminRole';
import type { AdminStatus, AdminUser, Paginated } from '@/types';

const props = defineProps<{ status: AdminStatus }>();
const emit = defineEmits<{ changed: [] }>();

const allUsers = ref<AdminUser[]>([]);
const adminRoleId = ref<number | null>(null);
const busyId = ref<number | null>(null);

const filtered = computed(() =>
  props.status === 'active' ? allUsers.value.filter((u) => !u.is_blocked) : allUsers.value.filter((u) => u.is_blocked),
);

async function load(): Promise<void> {
  const res = await api.request('/api/users?limit=200&page=1');
  if (!res.ok) return;
  const data: Paginated<AdminUser> = await res.json();
  allUsers.value = data.items || [];
  adminRoleId.value = await getAdminRoleId();
}

async function setBlocked(user: AdminUser, blocked: boolean): Promise<void> {
  const verb = blocked ? 'Заблокировать' : 'Разблокировать';
  if (!confirm(`${verb} пользователя «${user.nickname}»?`)) return;
  busyId.value = user.id;
  try {
    const res = await api.request(`/api/users/${user.id}/block`, { method: 'PATCH', json: { is_blocked: blocked } });
    if (res.ok) {
      await load();
      emit('changed');
    } else {
      alert(await api.parseError(res));
    }
  } finally {
    busyId.value = null;
  }
}

onMounted(load);

defineExpose({ load });
</script>

<template>
  <div class="admin-content">
    <div class="admin-content-header">
      <span>{{ status === 'active' ? 'АКТИВНЫЕ ПОЛЬЗОВАТЕЛИ' : 'ЗАБЛОКИРОВАННЫЕ ПОЛЬЗОВАТЕЛИ' }}</span>
      <span class="content-count">{{ filtered.length }}</span>
    </div>
    <div class="admin-list">
      <div v-for="user in filtered" :key="user.id" class="admin-card">
        <div class="admin-card-info">
          <div class="admin-card-name">{{ user.nickname }}</div>
          <div class="admin-card-email">{{ user.email }}</div>
        </div>
        <div class="admin-card-actions">
          <span v-if="adminRoleId != null && user.role_id === adminRoleId" class="admin-card-role-badge">АДМИН</span>
          <button
            v-else-if="status === 'active'"
            class="admin-ban-btn"
            :disabled="busyId === user.id"
            @click="setBlocked(user, true)"
          >
            ЗАБЛОКИРОВАТЬ
          </button>
          <button v-else class="admin-unban-btn-card" :disabled="busyId === user.id" @click="setBlocked(user, false)">
            РАЗБЛОКИРОВАТЬ
          </button>
        </div>
      </div>
    </div>
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

.admin-card-role-badge {
  color: #6c757d;
  font-weight: 700;
}

.admin-ban-btn,
.admin-unban-btn-card {
  padding: 8px 20px;
  border: none;
  border-radius: 30px;
  font-size: 0.75rem;
  font-weight: 1000;
  cursor: pointer;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.admin-ban-btn {
  background-color: #dc3545;
  color: white;
}

.admin-ban-btn:hover {
  background-color: #c82333;
}

.admin-unban-btn-card {
  background-color: #28a745;
  color: white;
}

.admin-unban-btn-card:hover {
  background-color: #218838;
}

.admin-ban-btn:disabled,
.admin-unban-btn-card:disabled {
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
