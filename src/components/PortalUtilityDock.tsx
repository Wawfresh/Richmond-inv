import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Globe, Search, X } from 'lucide-react';
import {
  SITE_LANGUAGES,
  ensureGoogleTranslateLoaded,
  getActiveSiteLanguage,
  switchSiteLanguage,
} from '../lib/googleTranslate';

const TELEGRAM_HANDLE = '@Rmigsuport';
const TELEGRAM_URL = 'https://t.me/Rmigsuport';

function TelegramMark({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M21.2 4.35L2.95 11.42C1.7 11.92 1.71 12.62 2.72 12.93L7.41 14.39L18.25 7.55C18.76 7.24 19.23 7.41 18.84 7.75L10.06 15.67H10.05L10.06 15.68L9.74 20.51C10.21 20.51 10.42 20.29 10.69 20.03L12.96 17.82L17.69 21.31C18.56 21.79 19.19 21.54 19.41 20.5L22.52 5.83C22.84 4.56 22.03 3.98 21.2 4.35Z"
        fill="currentColor"
      />
    </svg>
  );
}

/**
 * Institutional Language Selector & Telegram Support dock.
 * Intentionally mounted ONLY on the Home Page (/) and Investor Dashboard (/portal).
 */
export function PortalUtilityDock() {
  const [activeCode, setActiveCode] = useState<string>(() => getActiveSiteLanguage());
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [switching, setSwitching] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const activeLanguage = useMemo(
    () => SITE_LANGUAGES.find((lang) => lang.code === activeCode) || SITE_LANGUAGES[0],
    [activeCode]
  );

  const filteredLanguages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return SITE_LANGUAGES;
    return SITE_LANGUAGES.filter(
      (l) =>
        l.label.toLowerCase().includes(q) ||
        l.englishName.toLowerCase().includes(q) ||
        l.shortCode.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  // If a non-English language is already active in cookie/storage, keep the hidden translator ready.
  useEffect(() => {
    if (activeCode !== 'en') {
      ensureGoogleTranslateLoaded();
    }
  }, [activeCode]);

  // Close language panel on outside click or Escape key.
  useEffect(() => {
    if (!menuOpen) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  const handleSelectLanguage = async (code: string) => {
    setMenuOpen(false);
    setSearchQuery('');
    if (code === activeCode) return;

    setActiveCode(code);
    setSwitching(true);
    try {
      await switchSiteLanguage(code);
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div
      ref={containerRef}
      translate="no"
      className="notranslate no-print fixed bottom-4 right-4 sm:bottom-6 sm:right-6 z-40 flex flex-col items-end"
    >
      {/* Anchored Editorial Language Selector Panel */}
      {menuOpen && (
        <div
          role="dialog"
          aria-label="Select website language"
          className="mb-2.5 w-[290px] sm:w-[336px] bg-[#FCFBF8] text-[#0B172A] border border-[#D6DAE2] shadow-[0_18px_42px_rgba(6,14,28,0.18)]"
        >
          <div className="px-4 py-3 border-b border-[#E5E8EE] bg-[#F9F7F2] flex items-center justify-between gap-2">
            <div>
              <div className="text-[10px] uppercase tracking-[0.18em] text-[#997837] font-semibold">
                Language Preference
              </div>
              <div className="text-xs text-[#4A5260] mt-0.5">
                Current: <span className="font-semibold text-[#0B172A]">{activeLanguage.label}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setMenuOpen(false)}
              aria-label="Close language selector"
              className="w-7 h-7 inline-flex items-center justify-center border border-[#D6DAE2] bg-white text-[#4A5260] hover:text-[#0B172A] cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="p-2.5 border-b border-[#E5E8EE] bg-white">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-[#8E99AA] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search language..."
                className="w-full pl-8 pr-3 py-1.5 text-xs bg-[#FCFBF8] border border-[#D6DAE2] text-[#0B172A] placeholder:text-[#8E99AA] focus:outline-none focus:border-[#0B172A]"
              />
            </div>
          </div>

          <div className="max-h-60 overflow-y-auto p-1.5 grid grid-cols-2 gap-1 bg-[#FCFBF8]">
            {filteredLanguages.length === 0 ? (
              <div className="col-span-2 py-5 text-center text-xs text-[#4A5260]">
                No matching language found.
              </div>
            ) : (
              filteredLanguages.map((lang) => {
                const isSelected = lang.code === activeCode;
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => handleSelectLanguage(lang.code)}
                    className={`w-full px-2.5 py-2 text-left flex items-center justify-between gap-2 border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#0B172A] text-[#FCFBF8] border-[#0B172A]'
                        : 'bg-white text-[#1C2026] border-transparent hover:border-[#D6DAE2] hover:bg-[#F9F7F2]'
                    }`}
                  >
                    <span className="min-w-0 flex items-center gap-2">
                      <span
                        className={`font-mono text-[10px] font-semibold shrink-0 ${
                          isSelected ? 'text-[#C9A968]' : 'text-[#997837]'
                        }`}
                      >
                        {lang.shortCode}
                      </span>
                      <span className="text-xs font-medium truncate">{lang.label}</span>
                    </span>
                    {isSelected && <Check className="w-3.5 h-3.5 text-[#C9A968] shrink-0" />}
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Unified Institutional Dock: Language Switcher + Telegram Support */}
      <div className="flex items-stretch bg-[#0B172A] text-[#FCFBF8] border border-[#2A4166] shadow-[0_12px_30px_rgba(6,14,28,0.22)] divide-x divide-[#1E365C]">
        <button
          type="button"
          onClick={() => setMenuOpen((prev) => !prev)}
          aria-expanded={menuOpen}
          aria-haspopup="dialog"
          aria-label="Change website language"
          className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#FCFBF8] hover:bg-[#132542] transition-colors cursor-pointer whitespace-nowrap"
        >
          <Globe className="w-3.5 h-3.5 text-[#C9A968] shrink-0" />
          <span className="font-mono text-[11px] font-semibold tracking-wider text-[#C9A968]">
            {switching ? '...' : activeLanguage.shortCode}
          </span>
          <span className="hidden sm:inline text-xs text-[#E5E8EE]">{activeLanguage.label}</span>
          {menuOpen ? (
            <ChevronDown className="w-3.5 h-3.5 text-[#8E99AA] shrink-0" />
          ) : (
            <ChevronUp className="w-3.5 h-3.5 text-[#8E99AA] shrink-0" />
          )}
        </button>

        <a
          href={TELEGRAM_URL}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`Telegram Support ${TELEGRAM_HANDLE}`}
          className="inline-flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium text-[#FCFBF8] hover:bg-[#132542] transition-colors whitespace-nowrap"
        >
          <TelegramMark className="w-3.5 h-3.5 text-[#C9A968] shrink-0" />
          <span className="hidden sm:inline text-[11px] uppercase tracking-wider text-[#8E99AA]">Support</span>
          <span className="font-mono text-xs font-semibold text-[#FCFBF8]">{TELEGRAM_HANDLE}</span>
        </a>
      </div>
    </div>
  );
}
