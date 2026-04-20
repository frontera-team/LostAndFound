<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useRouter } from 'vue-router';

import { api } from '@/api/client';
import { useGeoCascade } from '@/composables/useGeoCascade';
import { useAuthStore } from '@/stores/auth';
import type { ProfileDto } from '@/types';
import { readFileAsBase64 } from '@/utils/file';

const router = useRouter();
const auth = useAuthStore();
const geo = useGeoCascade();

const nickname = ref('');
const email = ref('');
const regionName = ref('-');
const cityName = ref('-');
const avatarPreview = ref('https://via.placeholder.com/160x160/f8f9fa/6c757d?text=AVATAR');
const avatarFile = ref<File | null>(null);
const savedAvatar = ref('');
const savedAvatarMime = ref('image/png');
const saving = ref(false);

const avatarInputEl = ref<HTMLInputElement | null>(null);

function avatarDataUrl(raw: string, mime: string): string {
  return raw.startsWith('data:') ? raw : `data:${mime};base64,${raw}`;
}

async function loadProfile(): Promise<void> {
  const res = await api.request('/api/profile');
  if (!res.ok) {
    router.replace('/');
    return;
  }
  const user: ProfileDto = await res.json();
  nickname.value = user.nickname || '';
  email.value = user.email || '-';
  regionName.value = user.region_name || '-';
  cityName.value = user.city_name || '-';

  await geo.init(user.region_id, user.city_id, false);

  savedAvatar.value = user.avatar || '';
  savedAvatarMime.value = user.avatar_mime || 'image/png';
  avatarPreview.value = savedAvatar.value
    ? avatarDataUrl(savedAvatar.value, savedAvatarMime.value)
    : 'https://via.placeholder.com/160x160/f8f9fa/6c757d?text=AVATAR';
}

function onAvatarChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0] ?? null;
  avatarFile.value = file;
  if (!file) {
    avatarPreview.value = savedAvatar.value
      ? avatarDataUrl(savedAvatar.value, savedAvatarMime.value)
      : 'https://via.placeholder.com/160x160/f8f9fa/6c757d?text=AVATAR';
    return;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    avatarPreview.value = String(ev.target?.result || '');
  };
  reader.readAsDataURL(file);
}

async function submit(): Promise<void> {
  saving.value = true;
  try {
    const res = await api.request('/api/profile', {
      method: 'PUT',
      json: {
        nickname: nickname.value.trim(),
        region_id: geo.regionId.value,
        city_id: geo.cityId.value,
      },
    });
    if (!res.ok) {
      alert(await api.parseError(res));
      return;
    }

    if (avatarFile.value) {
      const { base64, mime } = await readFileAsBase64(avatarFile.value);
      const avatarRes = await api.request('/api/profile/avatar', {
        method: 'PUT',
        json: { avatar: base64, avatar_mime: mime },
      });
      if (!avatarRes.ok) {
        alert(await api.parseError(avatarRes));
        return;
      }
    }

    avatarFile.value = null;
    if (avatarInputEl.value) avatarInputEl.value.value = '';
    await loadProfile();
    await auth.loadUser();
    alert('Профиль обновлён');
  } finally {
    saving.value = false;
  }
}

async function logout(): Promise<void> {
  await auth.logout();
  router.replace('/');
}

const homeHref = computed(() => '/');

onMounted(loadProfile);
</script>

<template>
  <div class="avatar-wrap">
    <img :src="avatarPreview" class="avatar" alt="Аватар пользователя" />
  </div>

  <form @submit.prevent="submit">
    <div class="field-group">
      <label for="nicknameInput">НИКНЕЙМ</label>
      <input id="nicknameInput" v-model="nickname" type="text" required />
    </div>

    <div class="field-group">
      <label for="regionSelect">РЕГИОН</label>
      <select id="regionSelect" v-model.number="geo.regionId.value" @change="geo.onRegionChange(false)">
        <option v-for="r in geo.regions.value" :key="r.id" :value="r.id">{{ r.region_name }}</option>
      </select>
    </div>

    <div class="field-group">
      <label for="citySelect">ГОРОД</label>
      <select id="citySelect" v-model.number="geo.cityId.value">
        <option v-for="c in geo.cities.value" :key="c.id" :value="c.id">{{ c.city_name }}</option>
      </select>
    </div>

    <div class="field-group">
      <label for="avatarInput">АВАТАРКА</label>
      <input id="avatarInput" ref="avatarInputEl" type="file" accept="image/*" @change="onAvatarChange" />
    </div>

    <div class="meta-grid">
      <div>
        <div class="meta-title">EMAIL</div>
        <div class="meta-value">{{ email }}</div>
      </div>
      <div>
        <div class="meta-title">РЕГИОН</div>
        <div class="meta-value">{{ regionName }}</div>
      </div>
      <div>
        <div class="meta-title">ГОРОД</div>
        <div class="meta-value">{{ cityName }}</div>
      </div>
    </div>

    <button type="submit" class="primary-btn" :disabled="saving">СОХРАНИТЬ ИЗМЕНЕНИЯ</button>
  </form>

  <div class="actions">
    <a class="secondary-btn" :href="homeHref">НА ГЛАВНУЮ</a>
    <button class="danger-btn" type="button" @click="logout">ВЫЙТИ</button>
  </div>
</template>

<style scoped>
.avatar-wrap {
  display: flex;
  justify-content: center;
  margin-bottom: 20px;
}

.avatar {
  width: 160px;
  height: 160px;
  border-radius: 50%;
  object-fit: cover;
  border: 4px solid #ff8787;
  box-shadow: 0 8px 24px rgba(255, 107, 107, 0.28);
}

.field-group {
  margin-bottom: 16px;
}

.field-group label {
  display: block;
  margin-bottom: 8px;
  font-size: 0.74rem;
  font-weight: 1000;
  color: #495057;
  letter-spacing: 0.6px;
}

.field-group input,
.field-group select {
  width: 100%;
  border: 1px solid #ced4da;
  border-radius: 14px;
  padding: 11px 14px;
  font-size: 0.92rem;
}

.field-group input:focus {
  outline: none;
  border-color: #ff6b6b;
  box-shadow: 0 0 0 3px rgba(255, 107, 107, 0.12);
}

.meta-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
  margin: 8px 0 20px;
}

.meta-title {
  font-size: 0.7rem;
  color: #adb5bd;
  letter-spacing: 0.6px;
  font-weight: 1000;
  margin-bottom: 4px;
}

.meta-value {
  font-size: 0.95rem;
  font-weight: 700;
  color: #343a40;
}

.primary-btn,
.secondary-btn,
.danger-btn {
  border: none;
  border-radius: 60px;
  padding: 11px 20px;
  cursor: pointer;
  text-decoration: none;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 0.82rem;
  font-weight: 1000;
  letter-spacing: 0.45px;
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.primary-btn {
  width: 100%;
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: #ffffff;
}

.primary-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.primary-btn:hover,
.secondary-btn:hover,
.danger-btn:hover {
  transform: translateY(-2px);
}

.actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}

.secondary-btn {
  flex: 1;
  background: #e9ecef;
  color: #495057;
}

.danger-btn {
  flex: 1;
  background: #dc3545;
  color: #ffffff;
}
</style>
