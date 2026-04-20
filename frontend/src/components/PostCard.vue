<script setup lang="ts">
import { computed } from 'vue';

import type { Post, TabKey } from '@/types';

const props = defineProps<{
  post: Post;
  currentTab: TabKey;
  currentUserId: number | null;
}>();

const emit = defineEmits<{
  delete: [id: number];
  respond: [id: number];
  'mark-found': [id: number];
  report: [id: number];
  'view-responses': [id: number];
}>();

const status = computed(() => String(props.post.status || '').toLowerCase());

const isOwner = computed(
  () => props.currentUserId != null && props.post.userId != null && Number(props.post.userId) === Number(props.currentUserId),
);

const showStatusBadge = computed(() => props.currentTab === 'mine');

const badge = computed(() => {
  if (!showStatusBadge.value) return null;
  const s = status.value;
  if (s === 'pending') return { text: 'НА МОДЕРАЦИИ', cls: 'post-moderation-status' };
  if (s === 'rejected') return { text: 'ОТКЛОНЕНО', cls: 'post-moderation-status rejected' };
  if (s === 'searching') return { text: 'В ПОИСКЕ', cls: 'post-status-pill searching' };
  if (s === 'found') return { text: 'НАЙДЕНО', cls: 'post-status-pill found' };
  return null;
});

const showDelete = computed(() => isOwner.value);
const showMarkFound = computed(() => props.currentTab === 'mine' && isOwner.value && status.value === 'searching');
const showRespond = computed(
  () => props.currentTab === 'searching' && props.currentUserId != null && !isOwner.value && status.value === 'searching',
);
const showReport = computed(
  () =>
    (props.currentTab === 'searching' || props.currentTab === 'found') &&
    props.currentUserId != null &&
    !isOwner.value &&
    (status.value === 'searching' || status.value === 'found'),
);
const showViewResponses = computed(
  () =>
    props.currentUserId != null &&
    isOwner.value &&
    (status.value === 'searching' || status.value === 'found') &&
    (props.currentTab === 'searching' || props.currentTab === 'found' || props.currentTab === 'mine'),
);
</script>

<template>
  <div class="post-card">
    <img :src="post.image" class="post-image" :alt="`Фото ${post.title}`" />
    <div class="post-title">{{ post.title }}</div>
    <div class="post-description">{{ post.description }}</div>
    <div class="post-meta">{{ post.location }} | {{ post.authorNickname }}</div>
    <div v-if="badge" :class="badge.cls">{{ badge.text }}</div>
    <div class="post-reward" :class="post.rewardType">
      {{ post.rewardType === 'money' ? `ВОЗНАГРАЖДЕНИЕ: ${post.reward} ₽` : 'ДОБРОВОЛЬНАЯ ПОМОЩЬ' }}
    </div>
    <div class="card-buttons">
      <button v-if="showDelete" type="button" class="delete-btn" @click="emit('delete', post.id)">УДАЛИТЬ</button>
      <button v-if="showMarkFound" type="button" class="mark-found-btn" @click="emit('mark-found', post.id)">НАЙДЕНО</button>
      <button v-if="showRespond" type="button" class="respond-btn" @click="emit('respond', post.id)">ОТКЛИКНУТЬСЯ</button>
      <button v-if="showReport" type="button" class="report-btn" @click="emit('report', post.id)">ПОЖАЛОВАТЬСЯ</button>
      <button v-if="showViewResponses" type="button" class="view-responses-btn" @click="emit('view-responses', post.id)">
        ОТКЛИКИ ({{ post.responseCount ?? 0 }})
      </button>
    </div>
  </div>
</template>

<style scoped>
.post-card {
  background: var(--lf-surface);
  border-radius: var(--lf-radius-lg);
  overflow: hidden;
  box-shadow: var(--lf-shadow-card);
  transition: box-shadow 0.28s ease;
  border: 1px solid var(--lf-border);
  display: flex;
  flex-direction: column;
  height: 100%;
}

.post-card:hover {
  box-shadow: var(--lf-shadow-card-hover);
}

body.dark-theme .post-card {
  background-color: var(--lf-surface);
  border: 1px solid var(--lf-border-strong);
}

.post-image {
  width: 100%;
  height: 220px;
  object-fit: cover;
  background: linear-gradient(145deg, #f1f3f5 0%, #e9ecef 100%);
}

body.dark-theme .post-image {
  background: linear-gradient(145deg, #2d2d2d 0%, #252525 100%);
}

.post-title {
  font-size: 1.2rem;
  font-weight: 1000;
  margin: 16px 16px 8px;
  color: #212529;
}

body.dark-theme .post-title {
  color: #e9ecef;
}

.post-description {
  font-size: 0.9rem;
  color: #495057;
  margin: 0 16px 12px;
  line-height: 1.4;
}

body.dark-theme .post-description {
  color: #adb5bd;
}

.post-meta {
  margin: 0 16px 8px;
  font-size: 0.85rem;
  color: #6c757d;
}

body.dark-theme .post-meta {
  color: #868e96;
}

.post-reward {
  margin: 0 16px 12px;
  font-weight: 1000;
  font-size: 1rem;
}

.post-reward.money {
  color: #28a745;
}

body.dark-theme .post-reward.money {
  color: #51cf66;
}

.post-reward.voluntary {
  color: #6c757d;
  font-weight: 1000;
}

.post-moderation-status {
  margin: 0 16px 10px;
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 1000;
  letter-spacing: 0.5px;
  color: #856404;
  background: #fff3cd;
  border: 1px solid #ffc107;
  border-radius: 30px;
  padding: 4px 10px;
}

body.dark-theme .post-moderation-status {
  color: #ffc107;
  background: #2d2d2d;
  border: 1px solid #ffc107;
}

.post-moderation-status.rejected {
  color: #721c24;
  background: #f8d7da;
  border: 1px solid #f5c6cb;
}

body.dark-theme .post-moderation-status.rejected {
  color: #ff8b94;
  background: #2f1f22;
  border: 1px solid #ff8b94;
}

.post-status-pill {
  margin: 0 16px 8px;
  display: inline-block;
  font-size: 0.72rem;
  font-weight: 1000;
  letter-spacing: 0.35px;
  border-radius: 30px;
  padding: 4px 12px;
}

.post-status-pill.searching {
  color: #2b8a3e;
  background: #d3f9d8;
  border: 1px solid #b2f2bb;
}

body.dark-theme .post-status-pill.searching {
  color: #8ce99a;
  background: #1f3326;
  border: 1px solid #2f9e44;
}

.post-status-pill.found {
  color: #1864ab;
  background: #e7f5ff;
  border: 1px solid #a5d8ff;
}

body.dark-theme .post-status-pill.found {
  color: #74c0fc;
  background: #1c2f42;
  border: 1px solid #339af0;
}

.card-buttons {
  display: flex;
  gap: 8px;
  padding: 14px 16px;
  border-top: 1px solid var(--lf-border);
  background: linear-gradient(180deg, rgba(248, 249, 250, 0.9) 0%, #fff 100%);
  flex-wrap: wrap;
  margin-top: auto;
}

body.dark-theme .card-buttons {
  background: linear-gradient(180deg, rgba(37, 37, 37, 0.95) 0%, var(--lf-surface) 100%);
  border-top: 1px solid var(--lf-border-strong);
}

.respond-btn,
.report-btn,
.view-responses-btn,
.mark-found-btn,
.delete-btn {
  flex: 1;
  padding: 8px;
  border: none;
  border-radius: 30px;
  cursor: pointer;
  font-size: 0.8rem;
  font-weight: 1000;
  transition: all 0.2s;
  letter-spacing: 0.3px;
}

.respond-btn {
  background-color: #4c6ef5;
  color: white;
}

.respond-btn:hover {
  background-color: #3b5bdb;
}

.report-btn {
  background-color: #868e96;
  color: white;
}

.report-btn:hover {
  background-color: #6c757d;
}

.view-responses-btn {
  background-color: #17a2b8;
  color: white;
}

.view-responses-btn:hover {
  background-color: #138496;
}

.mark-found-btn {
  background-color: #20c997;
  color: white;
}

.mark-found-btn:hover {
  background-color: #12b886;
}

.delete-btn {
  background-color: #dc3545;
  color: white;
}

.delete-btn:hover {
  background-color: #c82333;
}
</style>
