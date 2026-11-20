export interface SiteLanguage {
  code: string;
  shortCode: string;
  label: string;
  englishName: string;
}

export const SITE_LANGUAGES: SiteLanguage[] = [
  { code: 'en', shortCode: 'EN', label: 'English', englishName: 'English' },
  { code: 'es', shortCode: 'ES', label: 'Español', englishName: 'Spanish' },
  { code: 'fr', shortCode: 'FR', label: 'Français', englishName: 'French' },
  { code: 'de', shortCode: 'DE', label: 'Deutsch', englishName: 'German' },
  { code: 'it', shortCode: 'IT', label: 'Italiano', englishName: 'Italian' },
  { code: 'pt', shortCode: 'PT', label: 'Português', englishName: 'Portuguese' },
  { code: 'nl', shortCode: 'NL', label: 'Nederlands', englishName: 'Dutch' },
  { code: 'zh-CN', shortCode: 'ZH', label: '中文 (简体)', englishName: 'Chinese Simplified' },
  { code: 'ja', shortCode: 'JA', label: '日本語', englishName: 'Japanese' },
  { code: 'ko', shortCode: 'KO', label: '한국어', englishName: 'Korean' },
  { code: 'ar', shortCode: 'AR', label: 'العربية', englishName: 'Arabic' },
  { code: 'ru', shortCode: 'RU', label: 'Русский', englishName: 'Russian' },
  { code: 'hi', shortCode: 'HI', label: 'हिन्दी', englishName: 'Hindi' },
  { code: 'tr', shortCode: 'TR', label: 'Türkçe', englishName: 'Turkish' },
  { code: 'pl', shortCode: 'PL', label: 'Polski', englishName: 'Polish' },
  { code: 'sv', shortCode: 'SV', label: 'Svenska', englishName: 'Swedish' },
  { code: 'id', shortCode: 'ID', label: 'Bahasa Indonesia', englishName: 'Indonesian' },
  { code: 'vi', shortCode: 'VI', label: 'Tiếng Việt', englishName: 'Vietnamese' },
];

const STORAGE_KEY = 'richmond_inv_site_lang';
const HOST_ID = 'richmond_google_translate_host';
const SCRIPT_ID = 'richmond_google_translate_script';

declare global {
  interface Window {
    __richmondGoogleTranslateInit?: () => void;
    __richmondTranslateDomPatched?: boolean;
    google?: {
      translate?: {
        TranslateElement?: new (
          options: {
            pageLanguage: string;
            includedLanguages?: string;
            autoDisplay?: boolean;
          },
          elementId: string
        ) => unknown;
      };
    };
  }
}

/**
 * Prevents React NotFoundError reconciliation crashes when Google Translate
 * wraps DOM text nodes inside <font> tags during SPA navigation.
 */
export function installTranslateDomGuard(): void {
  if (typeof window === 'undefined' || typeof Node === 'undefined') return;
  if (window.__richmondTranslateDomPatched) return;
  window.__richmondTranslateDomPatched = true;

  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

function readCookieLanguage(): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(/(?:^|;\s*)googtrans=([^;]+)/);
  if (!match) return null;
  const decoded = decodeURIComponent(match[1]);
  const parts = decoded.split('/').filter(Boolean);
  return parts.length >= 2 ? parts[parts.length - 1] : null;
}

export function getActiveSiteLanguage(): string {
  const fromCookie = readCookieLanguage();
  if (fromCookie && SITE_LANGUAGES.some((l) => l.code === fromCookie)) {
    return fromCookie;
  }
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (stored && SITE_LANGUAGES.some((l) => l.code === stored)) {
      return stored;
    }
  } catch {
    // ignore storage restrictions
  }
  return 'en';
}

function writeGoogTransCookie(langCode: string): void {
  if (typeof document === 'undefined' || typeof window === 'undefined') return;
  const host = window.location.hostname;
  const isIpOrLocal =
    host === 'localhost' || /^\d{1,3}(\.\d{1,3}){3}$/.test(host) || !host.includes('.');
  const rootDomain = isIpOrLocal ? '' : `.${host.replace(/^www\./i, '')}`;

  if (langCode === 'en') {
    const expired = 'Thu, 01 Jan 1970 00:00:00 GMT';
    document.cookie = `googtrans=; expires=${expired}; path=/`;
    if (rootDomain) {
      document.cookie = `googtrans=; expires=${expired}; path=/; domain=${rootDomain}`;
      document.cookie = `googtrans=; expires=${expired}; path=/; domain=.${host}`;
    }
    return;
  }

  const value = `/en/${langCode}`;
  document.cookie = `googtrans=${value}; path=/; SameSite=Lax`;
  if (rootDomain) {
    document.cookie = `googtrans=${value}; path=/; domain=${rootDomain}; SameSite=Lax`;
  }
}

function ensureHiddenTranslateHost(): HTMLElement {
  let host = document.getElementById(HOST_ID);
  if (!host) {
    host = document.createElement('div');
    host.id = HOST_ID;
    host.className = 'notranslate';
    host.setAttribute('aria-hidden', 'true');
    host.style.position = 'fixed';
    host.style.left = '-9999px';
    host.style.top = '-9999px';
    host.style.width = '1px';
    host.style.height = '1px';
    host.style.overflow = 'hidden';
    host.style.opacity = '0';
    host.style.pointerEvents = 'none';
    document.body.appendChild(host);
  }
  return host;
}

function initializeTranslateWidget(): void {
  if (!window.google?.translate?.TranslateElement) return;
  const host = ensureHiddenTranslateHost();
  if (host.querySelector('.goog-te-combo')) return;

  const includedLanguages = SITE_LANGUAGES.map((l) => l.code).join(',');
  new window.google.translate.TranslateElement(
    {
      pageLanguage: 'en',
      includedLanguages,
      autoDisplay: false,
    },
    HOST_ID
  );
}

export function ensureGoogleTranslateLoaded(): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  installTranslateDomGuard();
  ensureHiddenTranslateHost();

  if (window.google?.translate?.TranslateElement) {
    initializeTranslateWidget();
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    const prevCallback = window.__richmondGoogleTranslateInit;
    window.__richmondGoogleTranslateInit = () => {
      if (prevCallback) prevCallback();
      initializeTranslateWidget();
      resolve();
    };

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      const checkTimer = window.setInterval(() => {
        if (window.google?.translate?.TranslateElement) {
          window.clearInterval(checkTimer);
          initializeTranslateWidget();
          resolve();
        }
      }, 120);
      window.setTimeout(() => {
        window.clearInterval(checkTimer);
        resolve();
      }, 5000);
      return;
    }

    const script = document.createElement('script');
    script.id = SCRIPT_ID;
    script.src = 'https://translate.google.com/translate_a/element.js?cb=__richmondGoogleTranslateInit';
    script.async = true;
    script.onerror = () => resolve();
    document.head.appendChild(script);
  });
}

function waitForCombo(timeoutMs = 4000): Promise<HTMLSelectElement | null> {
  return new Promise((resolve) => {
    const existing = document.querySelector<HTMLSelectElement>(`#${HOST_ID} select.goog-te-combo`);
    if (existing) {
      resolve(existing);
      return;
    }

    const started = Date.now();
    const timer = window.setInterval(() => {
      const combo = document.querySelector<HTMLSelectElement>(`#${HOST_ID} select.goog-te-combo`);
      if (combo) {
        window.clearInterval(timer);
        resolve(combo);
      } else if (Date.now() - started >= timeoutMs) {
        window.clearInterval(timer);
        resolve(null);
      }
    }, 100);
  });
}

export async function switchSiteLanguage(langCode: string): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(STORAGE_KEY, langCode);
  } catch {
    // ignore storage errors
  }

  writeGoogTransCookie(langCode);

  if (langCode === 'en') {
    const isCurrentlyTranslated =
      document.documentElement.classList.contains('translated-ltr') ||
      document.documentElement.classList.contains('translated-rtl');
    if (isCurrentlyTranslated) {
      window.location.reload();
    }
    return;
  }

  await ensureGoogleTranslateLoaded();
  const combo = await waitForCombo(4000);
  if (combo) {
    combo.value = langCode;
    combo.dispatchEvent(new Event('change', { bubbles: true }));
    return;
  }

  // Fallback: reload once so Google Translate picks up the googtrans cookie directly
  window.location.reload();
}
