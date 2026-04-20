<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import { api } from '@/api/client';
import ActionBar from '@/components/ActionBar.vue';
import AppHeader from '@/components/AppHeader.vue';
import NavigationTabs from '@/components/NavigationTabs.vue';
import AdminModal from '@/components/modals/AdminModal.vue';
import AuthModal from '@/components/modals/AuthModal.vue';
import CreatePostModal from '@/components/modals/CreatePostModal.vue';
import ReportModal from '@/components/modals/ReportModal.vue';
import RepliesModal from '@/components/modals/RepliesModal.vue';
import RespondModal from '@/components/modals/RespondModal.vue';
import PostsGrid from '@/components/PostsGrid.vue';
import { useAuthStore } from '@/stores/auth';
import type { AnnouncementDto, Paginated, Post, TabKey } from '@/types';
import { annToPost, filterPostsBySearch } from '@/utils/mapAnnouncement';

const auth = useAuthStore();

const currentTab = ref<TabKey>('searching');
const searchQuery = ref('');
const allPosts = ref<Post[]>([]);
let fetchGeneration = 0;

const showCreateModal = ref(false);
const showAuthModal = ref(false);
const showAdminModal = ref(false);
const showRespondModal = ref(false);
const showRepliesModal = ref(false);
const showReportModal = ref(false);
const activeAnnouncementId = ref<number | null>(null);

const filteredPosts = computed(() => filterPostsBySearch(allPosts.value, searchQuery.value));

function getTabEmptyMessage(): string {
  if (currentTab.value === 'mine' && !auth.currentUser) return 'ВОЙДИТЕ, ЧТОБЫ ВИДЕТЬ СВОИ ОБЪЯВЛЕНИЯ';
  if (currentTab.value === 'mine') return 'У ВАС ПОКА НЕТ ОБЪЯВЛЕНИЙ';
  if (currentTab.value === 'found') return 'НЕТ ОБЪЯВЛЕНИЙ В РАЗДЕЛЕ «НАЙДЕНО»';
  return 'НЕТ ОБЪЯВЛЕНИЙ В РАЗДЕЛЕ «В ПОИСКЕ»';
}

const emptyMessage = ref(getTabEmptyMessage());

function announcementsFetchOptions(): { skipAuth?: boolean } {
  if (currentTab.value === 'mine') return {};
  if (api.getAccess()) return {};
  return { skipAuth: true };
}

async function loadAnnouncements(): Promise<void> {
  const gen = ++fetchGeneration;
  const opts = announcementsFetchOptions();
  let res: Response;

  if (currentTab.value === 'mine') {
    const params = new URLSearchParams({ limit: '100', page: '1', mine: 'true' });
    res = await api.request(`/api/announcements?${params}`, {});
  } else {
    const state = currentTab.value === 'found' ? 'found' : 'searching';
    const params = new URLSearchParams({ limit: '100', page: '1', state });
    res = await api.request(`/api/announcements?${params}`, opts);
  }

  if (gen !== fetchGeneration) return;

  if (!res.ok) {
    allPosts.value = [];
    const needAuth = res.status === 401 && currentTab.value === 'mine';
    emptyMessage.value = needAuth ? 'ВОЙДИТЕ, ЧТОБЫ ВИДЕТЬ СВОИ ОБЪЯВЛЕНИЯ' : 'НЕ УДАЛОСЬ ЗАГРУЗИТЬ ОБЪЯВЛЕНИЯ';
    return;
  }

  const data: Paginated<AnnouncementDto> = await res.json();
  if (gen !== fetchGeneration) return;

  let items = data.items || [];
  const normStatus = (a: AnnouncementDto) => String(a.status || '').toLowerCase();
  if (currentTab.value === 'searching') items = items.filter((a) => normStatus(a) === 'searching');
  else if (currentTab.value === 'found') items = items.filter((a) => normStatus(a) === 'found');

  allPosts.value = items.map(annToPost);
  emptyMessage.value = getTabEmptyMessage();
}

async function loadPosts(): Promise<void> {
  if (currentTab.value === 'mine' && !auth.currentUser) {
    allPosts.value = [];
    emptyMessage.value = getTabEmptyMessage();
    return;
  }
  await loadAnnouncements();
}

function setActiveTab(tab: TabKey): void {
  currentTab.value = tab;
  loadPosts();
}

async function onDelete(id: number): Promise<void> {
  if (!confirm('Удалить объявление?')) return;
  const res = await api.request(`/api/announcements/${id}`, { method: 'DELETE' });
  if (res.ok) await loadPosts();
  else alert(await api.parseError(res));
}

async function onMarkFound(id: number): Promise<void> {
  if (!confirm('Отметить как найденное? Объявление уйдёт из «В поиске» в раздел «Найдено».')) return;
  const res = await api.request(`/api/announcements/${id}/mark-found`, { method: 'POST' });
  if (res.ok) await loadPosts();
  else alert(await api.parseError(res));
}

function onRespond(id: number): void {
  activeAnnouncementId.value = id;
  showRespondModal.value = true;
}

function onViewResponses(id: number): void {
  activeAnnouncementId.value = id;
  showRepliesModal.value = true;
}

function onReport(id: number): void {
  if (!auth.currentUser) {
    showAuthModal.value = true;
    return;
  }
  activeAnnouncementId.value = id;
  showReportModal.value = true;
}

async function onCreatePostClick(): Promise<void> {
  showCreateModal.value = true;
}

function onPostCreated(): void {
  setActiveTab('mine');
}

async function onAdminPanelClick(): Promise<void> {
  showAdminModal.value = true;
}

async function onLoggedOut(): Promise<void> {
  await loadPosts();
}

async function onLoggedIn(): Promise<void> {
  await loadPosts();
}

async function onAdminChanged(): Promise<void> {
  await auth.loadUser();
  await loadPosts();
}

onMounted(async () => {
  await auth.loadUser();
  await loadPosts();
});
</script>

<template>
  <AppHeader @open-auth="showAuthModal = true" @logged-out="onLoggedOut" />

  <NavigationTabs :model-value="currentTab" @update:model-value="setActiveTab" />

  <ActionBar
    v-model="searchQuery"
    :show-create="!!auth.currentUser"
    :show-admin="auth.isAdmin"
    @create-post="onCreatePostClick"
    @open-admin="onAdminPanelClick"
  />

  <PostsGrid
    :posts="filteredPosts"
    :empty-message="searchQuery.trim() ? 'ПО ВАШЕМУ ЗАПРОСУ НИЧЕГО НЕ НАЙДЕНО' : emptyMessage"
    :current-tab="currentTab"
    :current-user-id="auth.currentUser?.id ?? null"
    @delete="onDelete"
    @respond="onRespond"
    @mark-found="onMarkFound"
    @report="onReport"
    @view-responses="onViewResponses"
  />

  <CreatePostModal v-model="showCreateModal" @created="onPostCreated" />
  <AuthModal v-model="showAuthModal" @logged-in="onLoggedIn" />
  <AdminModal v-model="showAdminModal" @changed="onAdminChanged" />
  <RespondModal v-model="showRespondModal" :announcement-id="activeAnnouncementId" @submitted="loadPosts" />
  <RepliesModal v-model="showRepliesModal" :announcement-id="activeAnnouncementId" />
  <ReportModal v-model="showReportModal" :announcement-id="activeAnnouncementId" />
</template>
