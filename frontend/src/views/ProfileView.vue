<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import AdminModerationTab from '@/components/profile/AdminModerationTab.vue';
import FoundByMeTab from '@/components/profile/FoundByMeTab.vue';
import ProfileInfoTab from '@/components/profile/ProfileInfoTab.vue';
import { useAuthStore } from '@/stores/auth';

type ProfileTab = 'info' | 'found-by-me' | 'moderation';

const auth = useAuthStore();
const router = useRouter();

const activeTab = ref<ProfileTab>('info');
const ready = ref(false);

const showModerationTab = computed(() => auth.isAdmin);

function selectTab(tab: ProfileTab): void {
  if (tab === 'moderation' && !showModerationTab.value) tab = 'info';
  activeTab.value = tab;
}

onMounted(async () => {
  await auth.loadUser();
  if (!auth.currentUser) {
    router.replace('/');
    return;
  }
  ready.value = true;
});
</script>

<template>
  <main v-if="ready" class="profile-page">
    <section class="profile-card" :class="{ 'profile-card--admin': showModerationTab }">
      <h1>ПРОФИЛЬ</h1>

      <div class="profile-tabs">
        <button class="profile-tab-btn" :class="{ active: activeTab === 'info' }" type="button" @click="selectTab('info')">
          ДАННЫЕ ПРОФИЛЯ
        </button>
        <button class="profile-tab-btn" :class="{ active: activeTab === 'found-by-me' }" type="button" @click="selectTab('found-by-me')">
          ЧТО Я НАШЕЛ
        </button>
        <button
          v-if="showModerationTab"
          class="profile-tab-btn"
          :class="{ active: activeTab === 'moderation' }"
          type="button"
          @click="selectTab('moderation')"
        >
          МОДЕРАЦИЯ
        </button>
      </div>

      <div v-show="activeTab === 'info'" class="profile-tab-content" :class="{ active: activeTab === 'info' }">
        <ProfileInfoTab />
      </div>

      <div v-show="activeTab === 'found-by-me'" class="profile-tab-content" :class="{ active: activeTab === 'found-by-me' }">
        <FoundByMeTab />
      </div>

      <div
        v-if="showModerationTab"
        v-show="activeTab === 'moderation'"
        class="profile-tab-content"
        :class="{ active: activeTab === 'moderation' }"
      >
        <AdminModerationTab :active="activeTab === 'moderation'" />
      </div>
    </section>
  </main>
</template>

<style>
.profile-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
}

.profile-card {
  width: min(560px, 100%);
  background: var(--lf-surface);
  border-radius: 24px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.1);
  border: 1px solid var(--lf-border-strong);
  padding: 28px;
}

.profile-card.profile-card--admin {
  width: min(720px, 100%);
}

.profile-card h1 {
  text-align: center;
  color: #ff6b6b;
  font-size: 1.5rem;
  margin-bottom: 20px;
  font-weight: 1000;
}

.profile-tabs {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  margin-bottom: 20px;
}

.profile-tab-btn {
  flex: 1;
  border: none;
  border-radius: 60px;
  padding: 10px 14px;
  cursor: pointer;
  font-size: 0.78rem;
  font-weight: 1000;
  letter-spacing: 0.45px;
  background: #f1f3f5;
  color: #6c757d;
  transition: all 0.2s ease;
}

body.dark-theme .profile-tab-btn {
  background: #2d2d2d;
  color: #adb5bd;
}

.profile-tab-btn.active {
  color: #ffffff;
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  box-shadow: 0 4px 14px rgba(255, 107, 107, 0.3);
}

.profile-empty {
  padding: 22px;
  border: 1px dashed #ced4da;
  border-radius: 16px;
  color: #6c757d;
  text-align: center;
  font-weight: 700;
  font-size: 0.9rem;
}

@media (max-width: 640px) {
  .profile-card {
    padding: 20px;
  }
}
</style>
