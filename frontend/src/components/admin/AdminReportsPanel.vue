<script setup lang="ts">
import { onMounted, ref } from 'vue';

import { api } from '@/api/client';
import type { Paginated, ReportGroup } from '@/types';
import { formatReplyDate } from '@/utils/date';

const emit = defineEmits<{ changed: [] }>();

const groups = ref<ReportGroup[]>([]);
const total = ref(0);
const errorMessage = ref('');
const openOnly = ref(true);

function canReject(status: string): boolean {
  return ['pending', 'searching', 'found'].includes(String(status || '').toLowerCase());
}

async function load(): Promise<void> {
  errorMessage.value = '';
  const params = new URLSearchParams({ limit: '50', page: '1', open_groups_only: openOnly.value ? 'true' : 'false' });
  const res = await api.request(`/api/announcements/reports?${params}`);
  if (!res.ok) {
    groups.value = [];
    total.value = 0;
    errorMessage.value = await api.parseError(res);
    return;
  }
  const data: Paginated<ReportGroup> = await res.json();
  groups.value = data.items || [];
  total.value = data.total != null ? data.total : groups.value.length;
}

async function resolveReport(reportId: number): Promise<void> {
  const res = await api.request(`/api/announcements/reports/${reportId}`, { method: 'PATCH', json: { status: 'resolved' } });
  if (res.ok) await load();
  else alert(await api.parseError(res));
}

async function rejectAnnouncement(announcementId: number): Promise<void> {
  if (!confirm('Отклонить объявление? Оно пропадёт из ленты, все открытые жалобы будут помечены обработанными.')) return;
  const res = await api.request(`/api/announcements/${announcementId}/reject`, { method: 'POST' });
  if (res.ok) {
    await load();
    emit('changed');
  } else {
    alert(await api.parseError(res));
  }
}

onMounted(load);

defineExpose({ load });
</script>

<template>
  <div class="admin-content">
    <div class="admin-content-header">
      <span>ЖАЛОБЫ НА ОБЪЯВЛЕНИЯ</span>
      <span class="content-count">{{ total }}</span>
    </div>

    <label class="admin-reports-filter">
      <input v-model="openOnly" type="checkbox" @change="load" />
      Только объявления с открытыми жалобами
    </label>

    <div v-if="errorMessage" class="info-message">{{ errorMessage }}</div>
    <div v-else-if="groups.length === 0" class="info-message">ЖАЛОБ ПОКА НЕТ</div>
    <div v-else class="admin-list">
      <div v-for="g in groups" :key="g.announcement_id" class="admin-card admin-card--report-group">
        <div class="admin-report-group-head">
          <div class="admin-card-info">
            <div class="admin-card-name">{{ g.ann_name }}</div>
            <div class="admin-card-email">Объявление #{{ g.announcement_id }} · {{ g.announcement_status || '—' }}</div>
          </div>
          <div class="admin-report-group-actions">
            <button v-if="canReject(g.announcement_status)" class="admin-reject-from-reports-btn" @click="rejectAnnouncement(g.announcement_id)">
              ОТКЛОНИТЬ ОБЪЯВЛЕНИЕ
            </button>
          </div>
        </div>
        <div class="admin-report-rows">
          <div v-for="it in g.reports" :key="it.id" class="admin-report-row">
            <div class="admin-report-row-main">
              <div class="admin-report-row-top">
                <span class="report-status-badge" :class="String(it.status).toLowerCase() === 'resolved' ? 'resolved' : 'open'">
                  {{ String(it.status).toLowerCase() === 'resolved' ? 'обработана' : 'открыта' }}
                </span>
              </div>
              <span class="admin-report-meta">{{ it.reporter_nickname }} ({{ it.reporter_email }}) · {{ formatReplyDate(it.created_at) }}</span>
              <div class="admin-report-text">{{ it.message }}</div>
            </div>
            <div class="admin-report-row-actions">
              <button v-if="String(it.status).toLowerCase() !== 'resolved'" class="admin-report-resolve-btn" @click="resolveReport(it.id)">
                ОБРАБОТАНО
              </button>
            </div>
          </div>
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

.admin-reports-filter {
  display: inline-flex;
  align-items: center;
  gap: 10px;
  font-size: 0.8rem;
  font-weight: 700;
  color: #495057;
  margin: 0 0 14px;
  padding: 10px 14px;
  cursor: pointer;
  user-select: none;
  background: #f1f3f5;
  border-radius: var(--lf-radius-sm);
  border: 1px solid var(--lf-border);
}

.admin-reports-filter:hover {
  background: #e9ecef;
}

.admin-reports-filter input {
  cursor: pointer;
  width: 17px;
  height: 17px;
  accent-color: var(--lf-accent);
}

body.dark-theme .admin-reports-filter {
  background: #2d2d2d;
  border: 1px solid var(--lf-border-strong);
  color: #adb5bd;
}

body.dark-theme .admin-reports-filter:hover {
  background: #333;
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

.admin-card--report-group {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  background: linear-gradient(180deg, #f8f9fb 0%, var(--lf-surface) 48%);
}

body.dark-theme .admin-card--report-group {
  background: linear-gradient(180deg, #252525 0%, var(--lf-surface) 50%);
  box-shadow:
    inset 3px 0 0 rgba(255, 135, 135, 0.4),
    var(--lf-shadow-card);
}

body.dark-theme .admin-card--report-group:hover {
  box-shadow:
    inset 3px 0 0 rgba(255, 135, 135, 0.4),
    var(--lf-shadow-card-hover);
}

.admin-report-group-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  width: 100%;
}

.admin-report-group-actions {
  display: flex;
  flex-shrink: 0;
}

.admin-report-rows {
  width: 100%;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--lf-border);
  display: flex;
  flex-direction: column;
  gap: 10px;
}

body.dark-theme .admin-report-rows {
  border-top: 1px solid #2d2d2d;
}

.admin-report-row {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  background: var(--lf-surface);
  border-bottom: 1px solid #eef0f3;
  border-radius: var(--lf-radius-sm);
  padding: 12px 0px;
}

body.dark-theme .admin-report-row {
  background: var(--lf-surface);
  border: 1px solid var(--lf-border-strong);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
}

.admin-report-row-main {
  flex: 1;
  min-width: 0;
}

.admin-report-row-top {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.admin-report-row-actions {
  flex-shrink: 0;
}

.report-status-badge {
  font-size: 0.62rem;
  font-weight: 1000;
  text-transform: uppercase;
  padding: 4px 10px;
  border-radius: var(--lf-radius-pill);
  letter-spacing: 0.06em;
}

.report-status-badge.open {
  background: #fff3cd;
  color: #856404;
}

body.dark-theme .report-status-badge.open {
  background: #5c4a00;
  color: #ffe066;
}

.report-status-badge.resolved {
  background: #d3f9d8;
  color: #2b8a3e;
}

body.dark-theme .report-status-badge.resolved {
  background: #1e4620;
  color: #8ce99a;
}

.admin-report-resolve-btn,
.admin-reject-from-reports-btn {
  padding: 9px 14px;
  border: none;
  border-radius: var(--lf-radius-pill);
  cursor: pointer;
  font-size: 0.7rem;
  font-weight: 1000;
  letter-spacing: 0.35px;
  transition: all 0.2s;
  box-shadow: 0 2px 6px rgba(15, 23, 42, 0.08);
}

.admin-report-resolve-btn {
  background-color: #20c997;
  color: white;
}

.admin-report-resolve-btn:hover {
  background-color: #12b886;
}

.admin-reject-from-reports-btn {
  background-color: #fa5252;
  color: white;
}

.admin-reject-from-reports-btn:hover {
  background-color: #e03131;
}

.admin-report-meta {
  font-size: 0.75rem;
  color: #868e96;
  margin-top: 8px;
  display: block;
}

.admin-report-text {
  font-size: 0.85rem;
  color: #495057;
  margin-top: 10px;
  white-space: pre-wrap;
  line-height: 1.45;
}

body.dark-theme .admin-report-text {
  color: #ced4da;
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
