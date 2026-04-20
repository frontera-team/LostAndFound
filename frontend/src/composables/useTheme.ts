import { ref } from 'vue';

export type Theme = 'light' | 'dark';

const theme = ref<Theme>(localStorage.getItem('theme') === 'dark' ? 'dark' : 'light');

function applyTheme(value: Theme): void {
  document.body.classList.toggle('dark-theme', value === 'dark');
  localStorage.setItem('theme', value);
}

applyTheme(theme.value);

function setTheme(value: Theme): void {
  theme.value = value;
  applyTheme(value);
}

export function useTheme() {
  return { theme, setTheme };
}
