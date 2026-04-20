<script setup lang="ts">
withDefaults(
  defineProps<{
    modelValue: boolean;
    title: string;
    wide?: boolean;
    xwide?: boolean;
    overflowVisible?: boolean;
  }>(),
  {
    wide: false,
    xwide: false,
    overflowVisible: false,
  },
);

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>();

function close(): void {
  emit('update:modelValue', false);
}

function onBackdropClick(e: MouseEvent): void {
  if (e.target === e.currentTarget) close();
}
</script>

<template>
  <Teleport to="body">
    <div v-if="modelValue" class="modal" @click="onBackdropClick">
      <div
        class="modal-content"
        :class="{
          'modal-content--wide': wide,
          'modal-content--xwide': xwide,
          'modal-content--overflow-visible': overflowVisible,
        }"
      >
        <span class="close" @click="close">&times;</span>
        <slot name="title"><h2>{{ title }}</h2></slot>
        <slot />
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.modal {
  display: block;
  position: fixed;
  z-index: 1000;
  left: 0;
  top: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(15, 23, 42, 0.48);
  backdrop-filter: blur(6px);
  -webkit-backdrop-filter: blur(6px);
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  padding: 24px 16px 40px;
  box-sizing: border-box;
}

.modal-content {
  background-color: var(--lf-surface);
  margin: 0 auto;
  padding: 28px;
  border-radius: 24px;
  width: 90%;
  max-width: 500px;
  max-height: min(85vh, calc(100vh - 64px));
  overflow-x: hidden;
  overflow-y: auto;
  box-shadow: var(--lf-shadow-modal);
  border: 1px solid var(--lf-border);
  scrollbar-width: thin;
  scrollbar-color: #ced4da #f1f3f5;
}

.modal-content::-webkit-scrollbar {
  width: 8px;
}

.modal-content::-webkit-scrollbar-track {
  background: #f1f3f5;
  border-radius: 8px;
}

.modal-content::-webkit-scrollbar-thumb {
  background: #ced4da;
  border-radius: 8px;
}

.modal-content::-webkit-scrollbar-thumb:hover {
  background: #adb5bd;
}

.modal-content--wide {
  max-width: 560px;
}

.modal-content--xwide {
  max-width: 820px;
  width: 92%;
  padding: 31px 28px 32px;
}

/* Нативный <select>: без внутреннего overflow — список не обрезается; скролл у .modal */
.modal-content--overflow-visible {
  overflow: visible;
  max-height: none;
}

.modal-content h2 {
  font-size: 1.28rem;
  font-weight: 1000;
  margin-bottom: 22px;
  padding-right: 36px;
  color: var(--lf-accent);
  letter-spacing: -0.35px;
  line-height: 1.25;
}

.close {
  float: right;
  font-size: 26px;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  color: #adb5bd;
  transition:
    color 0.2s,
    background 0.2s;
  padding: 6px 12px;
  margin: -8px -6px 4px 12px;
  border-radius: var(--lf-radius-pill);
}

.close:hover {
  color: var(--lf-accent);
  background: var(--lf-accent-soft);
}

body.dark-theme .modal-content {
  background-color: #1e1e1e;
  color: #e9ecef;
  scrollbar-color: #495057 #2d2d2d;
}

body.dark-theme .modal-content::-webkit-scrollbar-track {
  background: #2d2d2d;
}

body.dark-theme .modal-content::-webkit-scrollbar-thumb {
  background: #495057;
}

body.dark-theme .modal-content::-webkit-scrollbar-thumb:hover {
  background: #6c757d;
}
</style>
