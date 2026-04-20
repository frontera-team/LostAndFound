<script setup lang="ts">
import { ref, watch } from 'vue';

import { api } from '@/api/client';
import BaseModal from '@/components/BaseModal.vue';
import { useGeoCascade } from '@/composables/useGeoCascade';
import type { Category, RewardType } from '@/types';
import { readFileAsBase64 } from '@/utils/file';

const modelValue = defineModel<boolean>({ required: true });
const emit = defineEmits<{ created: [] }>();

const title = ref('');
const description = ref('');
const rewardType = ref<RewardType>('voluntary');
const reward = ref<number | null>(null);
const categories = ref<Category[]>([]);
const categoryId = ref<number | null>(null);
const imageFile = ref<File | null>(null);
const publishInFound = ref(false);
const submitting = ref(false);

const geo = useGeoCascade();

function resetForm(): void {
  title.value = '';
  description.value = '';
  rewardType.value = 'voluntary';
  reward.value = null;
  imageFile.value = null;
  publishInFound.value = false;
}

async function open(): Promise<void> {
  resetForm();
  const [, catRes] = await Promise.all([geo.init(undefined, undefined, true), api.request('/api/categories', { skipAuth: true })]);
  categories.value = catRes.ok ? await catRes.json() : [];
  categoryId.value = categories.value[0]?.id ?? null;
}

watch(modelValue, (open_) => {
  if (open_) open();
});

function onFileChange(e: Event): void {
  const input = e.target as HTMLInputElement;
  imageFile.value = input.files?.[0] ?? null;
}

async function submit(): Promise<void> {
  if (submitting.value) return;
  submitting.value = true;
  try {
    let ann_pic: string | null = null;
    let ann_pic_mime: string | null = null;
    if (imageFile.value) {
      try {
        const { base64, mime } = await readFileAsBase64(imageFile.value);
        ann_pic = base64;
        ann_pic_mime = mime;
      } catch {
        alert('Не удалось прочитать файл изображения');
        return;
      }
    }

    const rewardValue = rewardType.value === 'money' && reward.value != null ? reward.value : null;

    const body = {
      ann_name: title.value.trim(),
      ann_description: description.value.trim(),
      ann_reward: rewardValue,
      ann_region_id: geo.regionId.value,
      ann_city_id: geo.cityId.value,
      ann_district_id: geo.districtId.value,
      category_ids: categoryId.value != null ? [categoryId.value] : [],
      ann_pic,
      ann_pic_mime,
      publish_in_found: publishInFound.value,
    };

    const res = await api.request('/api/announcements', { method: 'POST', json: body });
    if (res.ok) {
      modelValue.value = false;
      emit('created');
    } else {
      alert(await api.parseError(res));
    }
  } finally {
    submitting.value = false;
  }
}
</script>

<template>
  <BaseModal v-model="modelValue" title="НОВОЕ ОБЪЯВЛЕНИЕ">
    <form @submit.prevent="submit">
      <div class="input-group">
        <label>НАЗВАНИЕ</label>
        <input v-model="title" type="text" placeholder="Например: Черный рюкзак" required />
      </div>
      <div class="input-group">
        <label>ОПИСАНИЕ</label>
        <textarea v-model="description" placeholder="Опишите вещь, особые приметы..." rows="3" required></textarea>
      </div>
      <div class="input-group">
        <label>РЕГИОН</label>
        <select v-model.number="geo.regionId.value" required @change="geo.onRegionChange(true)">
          <option v-for="r in geo.regions.value" :key="r.id" :value="r.id">{{ r.region_name }}</option>
        </select>
      </div>
      <div class="input-group">
        <label>ГОРОД</label>
        <select v-model.number="geo.cityId.value" required @change="geo.onCityChange()">
          <option v-for="c in geo.cities.value" :key="c.id" :value="c.id">{{ c.city_name }}</option>
        </select>
      </div>
      <div class="input-group">
        <label>РАЙОН</label>
        <select v-model.number="geo.districtId.value" required>
          <option v-for="d in geo.districts.value" :key="d.id" :value="d.id">{{ d.district }}</option>
        </select>
      </div>
      <div class="input-group">
        <label>КАТЕГОРИЯ</label>
        <select v-model.number="categoryId" required>
          <option v-for="c in categories" :key="c.id" :value="c.id">{{ c.category_name }}</option>
        </select>
      </div>

      <div class="reward-option">
        <label><input v-model="rewardType" type="radio" value="voluntary" /> ДОБРОВОЛЬНО</label>
        <label><input v-model="rewardType" type="radio" value="money" /> ВОЗНАГРАЖДЕНИЕ</label>
      </div>

      <div v-if="rewardType === 'money'" class="input-group">
        <label>СУММА (₽)</label>
        <input v-model.number="reward" type="number" placeholder="1000" step="100" />
      </div>

      <div class="input-group">
        <label>ФОТО</label>
        <input type="file" accept="image/*" @change="onFileChange" />
      </div>

      <div class="input-group">
        <label>
          <input v-model="publishInFound" type="checkbox" />
          После одобрения модератором показывать в «Найдено», а не в «Общие»
        </label>
      </div>

      <button type="submit" class="submit-btn" :disabled="submitting">ОПУБЛИКОВАТЬ</button>
    </form>
  </BaseModal>
</template>

<style scoped>
.reward-option {
  display: flex;
  gap: 20px;
  margin: 12px 0 20px;
}

.reward-option label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-weight: 1000;
  font-size: 0.85rem;
}

.reward-option input[type='radio'] {
  width: auto;
  padding: 0;
  margin: 0;
  border: none;
  border-radius: 0;
  box-shadow: none;
}

.submit-btn {
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

.submit-btn:hover {
  box-shadow: 0 4px 12px rgba(255, 107, 107, 0.3);
}

.submit-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
</style>
