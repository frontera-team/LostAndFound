<script setup lang="ts">
import PostCard from '@/components/PostCard.vue';
import type { Post, TabKey } from '@/types';

defineProps<{
  posts: Post[];
  emptyMessage: string;
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
</script>

<template>
  <main>
    <div v-if="posts.length === 0" class="posts-empty">{{ emptyMessage }}</div>
    <div v-else class="posts-grid">
      <PostCard
        v-for="post in posts"
        :key="post.id"
        :post="post"
        :current-tab="currentTab"
        :current-user-id="currentUserId"
        @delete="emit('delete', $event)"
        @respond="emit('respond', $event)"
        @mark-found="emit('mark-found', $event)"
        @report="emit('report', $event)"
        @view-responses="emit('view-responses', $event)"
      />
    </div>
  </main>
</template>

<style scoped>
.posts-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 26px;
  padding: 28px 24px 40px;
  max-width: 1400px;
  margin: 0 auto;
  align-items: stretch;
}

.posts-empty {
  position: fixed;
  top: 50%;
  left: 50%;
  translate: -50% -50%;
  text-align: center;
  padding: 60px;
  color: #6c757d;
}

@media (max-width: 768px) {
  .posts-grid {
    grid-template-columns: 1fr;
    padding: 16px;
  }
}
</style>
