<script setup lang="ts">
import { ref, watch } from 'vue';

import { api } from '@/api/client';
import BaseModal from '@/components/BaseModal.vue';

const modelValue = defineModel<boolean>({ required: true });
const props = defineProps<{ announcementId: number | null }>();

const message = ref('');

watch(modelValue, (isOpen) => {
  if (isOpen) message.value = '';
});

async function submit(): Promise<void> {
  const id = props.announcementId;
  const text = message.value.trim();
  if (id == null || !text) return;
  const res = await api.request(`/api/announcements/${id}/reports`, { method: 'POST', json: { message: text } });
  if (res.ok) {
    modelValue.value = false;
    alert('Жалоба отправлена');
  } else {
    alert(await api.parseError(res));
  }
}
</script>

<template>
  <BaseModal v-model="modelValue" title="ПОЖАЛОВАТЬСЯ">
    <form @submit.prevent="submit">
      <div class="input-group">
        <label>ПРИЧИНА / КОММЕНТАРИЙ</label>
        <textarea v-model="message" rows="5" required maxlength="4000" placeholder="Опишите нарушение или причину жалобы…"></textarea>
      </div>
      <button type="submit" class="submit-btn">ОТПРАВИТЬ ЖАЛОБУ</button>
    </form>
  </BaseModal>
</template>

<style scoped>
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
</style>
