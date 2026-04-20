export interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleAccountsId {
  initialize: (opts: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    auto_select?: boolean;
    cancel_on_tap_outside?: boolean;
  }) => void;
  renderButton: (
    el: HTMLElement,
    opts: {
      type?: string;
      theme?: string;
      size?: string;
      shape?: string;
      text?: string;
      locale?: string;
      logo_alignment?: string;
      width?: number;
    },
  ) => void;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: GoogleAccountsId;
      };
    };
  }
}

let scriptPromise: Promise<void> | null = null;

export function loadGoogleIdentityScript(): Promise<void> {
  if (window.google?.accounts?.id) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-lf-google-gsi]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Не удалось загрузить Google Sign-In')));
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.async = true;
    s.defer = true;
    s.dataset.lfGoogleGsi = '1';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('Не удалось загрузить Google Sign-In'));
    document.head.appendChild(s);
  });

  return scriptPromise;
}
