<script setup lang="ts">
import { nextTick, ref, watch } from 'vue';

import { api } from '@/api/client';
import BaseModal from '@/components/BaseModal.vue';
import { loadGoogleIdentityScript, type GoogleCredentialResponse } from '@/composables/googleIdentity';
import { useGeoCascade } from '@/composables/useGeoCascade';
import { useAuthStore } from '@/stores/auth';

const modelValue = defineModel<boolean>({ required: true });
const emit = defineEmits<{ 'logged-in': [] }>();

const auth = useAuthStore();
const geo = useGeoCascade();

const activeTab = ref<'login' | 'register'>('login');

const loginEmail = ref('');
const loginPassword = ref('');

const regNickname = ref('');
const regEmail = ref('');
const regPassword = ref('');

const googleWrapLoginVisible = ref(false);
const googleWrapRegisterVisible = ref(false);
const googleBtnLogin = ref<HTMLElement | null>(null);
const googleBtnRegister = ref<HTMLElement | null>(null);

let googleSignInPrepared = false;
let googleGsiInitialized = false;

function resetForms(): void {
  loginEmail.value = '';
  loginPassword.value = '';
  regNickname.value = '';
  regEmail.value = '';
  regPassword.value = '';
}

async function afterAuthSuccess(accessToken: string, refreshToken: string): Promise<void> {
  api.setTokens(accessToken, refreshToken);
  modelValue.value = false;
  resetForms();
  await auth.loadUser();
  emit('logged-in');
}

async function submitLogin(): Promise<void> {
  const res = await api.request('/api/auth/login', {
    method: 'POST',
    json: { email: loginEmail.value, password: loginPassword.value },
    skipAuth: true,
  });
  if (res.ok) {
    const data = await res.json();
    await afterAuthSuccess(data.access_token, data.refresh_token);
  } else {
    alert(await api.parseError(res));
  }
}

async function submitRegister(): Promise<void> {
  const region_id = geo.regionId.value;
  const city_id = geo.cityId.value;

  const res = await api.request('/api/auth/register', {
    method: 'POST',
    json: { nickname: regNickname.value.trim(), email: regEmail.value.trim(), password: regPassword.value, region_id, city_id },
    skipAuth: true,
  });

  if (!res.ok) {
    alert(await api.parseError(res));
    return;
  }

  const loginRes = await api.request('/api/auth/login', {
    method: 'POST',
    json: { email: regEmail.value.trim(), password: regPassword.value },
    skipAuth: true,
  });
  if (loginRes.ok) {
    const data = await loginRes.json();
    await afterAuthSuccess(data.access_token, data.refresh_token);
  } else {
    modelValue.value = false;
    await auth.loadUser();
    emit('logged-in');
  }
}

async function onGoogleCredential(response: GoogleCredentialResponse): Promise<void> {
  if (!response.credential) return;

  const payload: Record<string, unknown> = { id_token: response.credential };

  if (activeTab.value === 'register') {
    const region_id = geo.regionId.value;
    const city_id = geo.cityId.value;
    if (region_id == null || city_id == null) {
      alert('Выберите регион и город, затем снова нажмите «Войти через Google».');
      return;
    }
    Object.assign(payload, { region_id, city_id });
    if (regNickname.value.trim()) payload.nickname = regNickname.value.trim();
  }

  const res = await api.request('/api/auth/google', { method: 'POST', json: payload, skipAuth: true });

  if (res.ok) {
    const data = await res.json();
    await afterAuthSuccess(data.access_token, data.refresh_token);
    return;
  }

  let body: { detail?: { code?: string; message?: string } | string; message?: string };
  try {
    body = await res.json();
  } catch {
    alert(`Ошибка ${res.status}`);
    return;
  }

  if (res.status === 400 && typeof body.detail === 'object' && body.detail?.code === 'google_profile_required') {
    alert(
      `${body.detail.message || 'Заполните профиль'}\n\nОткройте вкладку «Регистрация», выберите регион и город, при необходимости укажите никнейм, затем снова нажмите кнопку Google.`,
    );
    return;
  }

  alert(api.formatErrorDetail(body.detail) || body.message || `Ошибка ${res.status}`);
}

async function prepareGoogleSignIn(): Promise<void> {
  const res = await api.request('/api/auth/google-client-id', { skipAuth: true });
  if (!res.ok) return;
  const { client_id: clientId } = await res.json();
  if (!clientId) return;

  try {
    await loadGoogleIdentityScript();
  } catch (e) {
    console.warn(e);
    return;
  }

  if (!window.google) return;

  if (!googleGsiInitialized) {
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: onGoogleCredential,
      auto_select: false,
      cancel_on_tap_outside: true,
    });
    googleGsiInitialized = true;
  }

  const btnOpts = {
    type: 'standard',
    theme: 'outline',
    size: 'large',
    shape: 'pill',
    text: 'continue_with',
    locale: 'ru',
    logo_alignment: 'left',
    width: 300,
  };

  if (!googleSignInPrepared && googleBtnLogin.value && googleBtnRegister.value) {
    googleBtnLogin.value.replaceChildren();
    googleBtnRegister.value.replaceChildren();
    window.google.accounts.id.renderButton(googleBtnLogin.value, btnOpts);
    window.google.accounts.id.renderButton(googleBtnRegister.value, btnOpts);
    googleSignInPrepared = true;
  }

  googleWrapLoginVisible.value = true;
  googleWrapRegisterVisible.value = true;
}

async function openModal(): Promise<void> {
  activeTab.value = 'login';
  resetForms();
  await geo.init(undefined, undefined, false);
  await nextTick();
  prepareGoogleSignIn();
}

watch(modelValue, (isOpen) => {
  if (isOpen) openModal();
});

function selectTab(tab: 'login' | 'register'): void {
  activeTab.value = tab;
}
</script>

<template>
  <BaseModal v-model="modelValue" title="ДОБРО ПОЖАЛОВАТЬ" overflow-visible>
    <div class="auth-tabs">
      <button class="auth-tab-btn" :class="{ active: activeTab === 'login' }" @click="selectTab('login')">ВХОД</button>
      <button class="auth-tab-btn" :class="{ active: activeTab === 'register' }" @click="selectTab('register')">РЕГИСТРАЦИЯ</button>
    </div>

    <div v-show="activeTab === 'login'" class="auth-tab-content active">
      <form @submit.prevent="submitLogin">
        <div class="input-group">
          <label>EMAIL</label>
          <input v-model="loginEmail" type="email" placeholder="example@mail.com" required />
        </div>
        <div class="input-group">
          <label>ПАРОЛЬ</label>
          <input v-model="loginPassword" type="password" placeholder="••••••••" required />
        </div>
        <button type="submit" class="auth-submit-btn">ВОЙТИ</button>
        <div v-show="googleWrapLoginVisible" class="auth-google-wrap">
          <div class="auth-google-divider" aria-hidden="true"><span>или</span></div>
          <div class="auth-google-btn-surface">
            <div ref="googleBtnLogin" class="auth-google-btn-host" aria-label="Войти через Google"></div>
          </div>
        </div>
      </form>
    </div>

    <div v-show="activeTab === 'register'" class="auth-tab-content active">
      <form @submit.prevent="submitRegister">
        <div class="input-group">
          <label>НИКНЕЙМ</label>
          <input v-model="regNickname" type="text" placeholder="Как к вам обращаться?" required />
        </div>
        <div class="input-group">
          <label>EMAIL</label>
          <input v-model="regEmail" type="email" placeholder="example@mail.com" required />
        </div>
        <div class="input-group">
          <label>РЕГИОН</label>
          <select v-model.number="geo.regionId.value" required @change="geo.onRegionChange(false)">
            <option v-for="r in geo.regions.value" :key="r.id" :value="r.id">{{ r.region_name }}</option>
          </select>
        </div>
        <div class="input-group">
          <label>ГОРОД</label>
          <select v-model.number="geo.cityId.value" required>
            <option v-for="c in geo.cities.value" :key="c.id" :value="c.id">{{ c.city_name }}</option>
          </select>
        </div>
        <div class="input-group">
          <label>ПАРОЛЬ</label>
          <input v-model="regPassword" type="password" placeholder="Придумайте надежный пароль" required />
        </div>
        <button type="submit" class="auth-submit-btn">ЗАРЕГИСТРИРОВАТЬСЯ</button>
        <div v-show="googleWrapRegisterVisible" class="auth-google-wrap">
          <div class="auth-google-divider" aria-hidden="true"><span>или через Google</span></div>
          <p class="auth-google-subhint">Сначала выберите регион и город выше</p>
          <div class="auth-google-btn-surface">
            <div ref="googleBtnRegister" class="auth-google-btn-host" aria-label="Регистрация через Google"></div>
          </div>
        </div>
      </form>
    </div>
  </BaseModal>
</template>

<style scoped>
.auth-tabs {
  display: flex;
  gap: 12px;
  margin-bottom: 24px;
  border-bottom: 2px solid #e9ecef;
  padding-bottom: 12px;
}

.auth-tab-btn {
  flex: 1;
  padding: 12px;
  border: none;
  background: none;
  font-size: 0.9rem;
  font-weight: 1000;
  color: #6c757d;
  cursor: pointer;
  border-radius: 16px;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.auth-tab-btn:hover {
  color: #ff6b6b;
  background-color: #fff5f5;
}

.auth-tab-btn.active {
  color: #ff6b6b;
  background-color: #fff5f5;
}

.auth-tab-content.active {
  animation: fadeInAuthTab 0.25s ease;
}

/* Без transform: иначе на iOS/Safari ломается раскрытие <select> внутри вкладки. */
@keyframes fadeInAuthTab {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}

.auth-submit-btn {
  width: 100%;
  background: linear-gradient(135deg, #ff6b6b, #ff8787);
  color: white;
  margin-top: 16px;
  padding: 10px 24px;
  border: none;
  border-radius: 60px;
  cursor: pointer;
  font-weight: 1000;
  font-size: 0.85rem;
  transition: all 0.2s;
  letter-spacing: 0.5px;
}

.auth-submit-btn:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.auth-google-wrap {
  margin-top: 22px;
  text-align: center;
}

.auth-google-divider {
  display: flex;
  align-items: center;
  gap: 14px;
  margin: 0 0 14px;
  font-size: 0.78rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  color: #868e96;
}

.auth-google-divider::before,
.auth-google-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 107, 107, 0.35) 20%, rgba(255, 107, 107, 0.35) 80%, transparent);
}

.auth-google-divider span {
  flex-shrink: 0;
  max-width: 70%;
  line-height: 1.3;
}

.auth-google-subhint {
  margin: -6px 0 14px;
  font-size: 0.72rem;
  font-weight: 800;
  color: #6c757d;
  letter-spacing: 0.25px;
  line-height: 1.35;
}

.auth-google-btn-surface {
  display: inline-block;
  width: 100%;
}

.auth-google-btn-host {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 44px;
  overflow: hidden;
  border-radius: 14px;
}

.auth-google-btn-host :deep(iframe) {
  max-width: 100% !important;
}

body.dark-theme .auth-google-divider {
  color: #adb5bd;
}

body.dark-theme .auth-google-divider::before,
body.dark-theme .auth-google-divider::after {
  background: linear-gradient(90deg, transparent, rgba(255, 135, 135, 0.35) 25%, rgba(255, 135, 135, 0.35) 75%, transparent);
}

body.dark-theme .auth-google-subhint {
  color: #adb5bd;
}

body.dark-theme .auth-google-btn-surface {
  background: linear-gradient(160deg, #2a2426 0%, #1e1e22 50%, #2a2224 100%);
  border: 1px solid rgba(255, 135, 135, 0.28);
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.2),
    0 8px 28px rgba(0, 0, 0, 0.35);
}

body.dark-theme .auth-google-btn-surface:hover {
  border: 1px solid rgba(255, 135, 135, 0.45);
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    0 14px 36px rgba(255, 107, 107, 0.12);
}
</style>
