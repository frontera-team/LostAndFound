<script setup lang="ts">
import { ref } from 'vue';

import BaseModal from '@/components/BaseModal.vue';
import AdminReportsPanel from '@/components/admin/AdminReportsPanel.vue';
import AdminPostsPanel from '@/components/admin/AdminPostsPanel.vue';
import AdminUsersPanel from '@/components/admin/AdminUsersPanel.vue';
import type { AdminStatus, AdminType } from '@/types';

const modelValue = defineModel<boolean>({ required: true });
const emit = defineEmits<{ changed: [] }>();

const adminType = ref<AdminType>('users');
const adminStatus = ref<AdminStatus>('active');

function selectType(type: AdminType): void {
  adminType.value = type;
}

function selectStatus(status: AdminStatus): void {
  adminStatus.value = status;
}
</script>

<template>
  <BaseModal v-model="modelValue" title="ПАНЕЛЬ АДМИНИСТРАТОРА" xwide>
    <template #title>
      <h2 class="admin-modal-title">ПАНЕЛЬ АДМИНИСТРАТОРА</h2>
    </template>

    <div class="admin-section">
      <div class="section-label">ТИП</div>
      <div class="admin-toggle-group">
        <button class="admin-toggle-btn" :class="{ active: adminType === 'users' }" @click="selectType('users')">ПОЛЬЗОВАТЕЛИ</button>
        <button class="admin-toggle-btn" :class="{ active: adminType === 'posts' }" @click="selectType('posts')">ОБЪЯВЛЕНИЯ</button>
        <button class="admin-toggle-btn" :class="{ active: adminType === 'reports' }" @click="selectType('reports')">ЖАЛОБЫ</button>
      </div>
    </div>

    <div v-if="adminType !== 'reports'" class="admin-section">
      <div class="section-label">СТАТУС</div>
      <div class="admin-toggle-group">
        <button class="admin-status-btn" :class="{ active: adminStatus === 'active' }" @click="selectStatus('active')">АКТИВНЫЕ</button>
        <button class="admin-status-btn" :class="{ active: adminStatus === 'banned' }" @click="selectStatus('banned')">
          ЗАБЛОКИРОВАННЫЕ
        </button>
      </div>
    </div>

    <AdminUsersPanel v-if="adminType === 'users'" :status="adminStatus" @changed="emit('changed')" />
    <AdminPostsPanel v-else-if="adminType === 'posts'" :status="adminStatus" @changed="emit('changed')" />
    <AdminReportsPanel v-else @changed="emit('changed')" />
  </BaseModal>
</template>

<style scoped>
.admin-modal-title {
  font-size: 1.45rem;
  font-weight: 1000;
  margin-bottom: 22px;
  padding-bottom: 14px;
  color: var(--lf-accent);
  letter-spacing: -0.4px;
  border-bottom: 1px solid var(--lf-border);
}

.admin-section {
  margin-bottom: 24px;
}

.section-label {
  font-size: 0.7rem;
  font-weight: 1000;
  letter-spacing: 1px;
  color: #adb5bd;
  margin-bottom: 8px;
  text-transform: uppercase;
}

.admin-toggle-group {
  display: flex;
  gap: 6px;
  background: #eef1f4;
  padding: 5px;
  border-radius: var(--lf-radius-pill);
  border: 1px solid var(--lf-border);
  box-shadow: inset 0 1px 2px rgba(15, 23, 42, 0.04);
}

body.dark-theme .admin-toggle-group {
  background: #2d2d2d;
}

.admin-toggle-btn,
.admin-status-btn {
  flex: 1;
  padding: 12px 20px;
  border: none;
  background: transparent;
  font-size: 0.85rem;
  font-weight: 1000;
  letter-spacing: 0.5px;
  color: #6c757d;
  cursor: pointer;
  border-radius: 60px;
  transition: all 0.2s ease;
}

.admin-toggle-btn.active,
.admin-status-btn.active {
  background: linear-gradient(135deg, var(--lf-accent), var(--lf-accent-mid));
  color: white;
  box-shadow:
    0 2px 10px rgba(255, 107, 107, 0.28),
    0 1px 0 rgba(255, 255, 255, 0.2) inset;
}

body.dark-theme .admin-toggle-btn.active,
body.dark-theme .admin-status-btn.active {
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
}

.admin-toggle-btn:hover:not(.active),
.admin-status-btn:hover:not(.active) {
  background: #e9ecef;
  color: #495057;
}
</style>
