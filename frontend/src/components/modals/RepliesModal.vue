<script setup lang="ts">
import { ref, watch } from 'vue';

import { api } from '@/api/client';
import BaseModal from '@/components/BaseModal.vue';
import type { Reply } from '@/types';
import { formatReplyDate } from '@/utils/date';

const modelValue = defineModel<boolean>({ required: true });
const props = defineProps<{ announcementId: number | null }>();

const loading = ref(false);
const errorMessage = ref('');
const replies = ref<Reply[]>([]);

async function load(): Promise<void> {
  if (props.announcementId == null) return;
  loading.value = true;
  errorMessage.value = '';
  replies.value = [];
  const res = await api.request(`/api/announcements/${props.announcementId}/replies`);
  if (!res.ok) {
    errorMessage.value = await api.parseError(res);
    loading.value = false;
    return;
  }
  const data = await res.json();
  replies.value = data.items || [];
  loading.value = false;
}

watch(modelValue, (isOpen) => {
  if (isOpen) load();
});
</script>

<template>
  <BaseModal v-model="modelValue" title="ОТКЛИКИ" wide>
    <div class="replies-list-container">
      <div v-if="loading" class="info-message">ЗАГРУЗКА…</div>
      <div v-else-if="errorMessage" class="info-message">{{ errorMessage }}</div>
      <div v-else-if="replies.length === 0" class="info-message">ПОКА НЕТ ОТКЛИКОВ</div>
      <div v-for="r in replies" v-else :key="r.id" class="reply-item">
        <div class="reply-item-header">
          <span>{{ r.nickname }}</span>
          <span class="reply-item-meta">{{ formatReplyDate(r.created_at) }}</span>
        </div>
        <div class="reply-item-text">{{ r.message }}</div>
      </div>
    </div>
  </BaseModal>
</template>

<style scoped>
.replies-list-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: min(420px, 55vh);
  overflow-y: auto;
}

.reply-item {
  border: 1px solid var(--lf-border);
  border-radius: var(--lf-radius-md);
  padding: 14px 16px;
  background: #f4f6f8;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
}

body.dark-theme .reply-item {
  background: #252525;
  border: 1px solid var(--lf-border-strong);
  box-shadow: none;
}

.reply-item-header {
  display: flex;
  flex-wrap: wrap;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 8px;
  font-size: 0.78rem;
  font-weight: 1000;
  color: #495057;
}

body.dark-theme .reply-item-header {
  color: #e9ecef;
}

.reply-item-meta {
  font-weight: 700;
  color: #868e96;
}

.reply-item-text {
  font-size: 0.88rem;
  line-height: 1.45;
  color: #212529;
  white-space: pre-wrap;
}

body.dark-theme .reply-item-text {
  color: #dee2e6;
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
</style>
