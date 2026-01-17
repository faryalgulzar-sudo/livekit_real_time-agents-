'use client';

import { AppSettings } from '@/hooks/useSettings';
import { Text } from '@/components/ui';

interface LanguageSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

const languages = [
  { code: 'en', label: 'English', nativeLabel: 'English', flag: '🇺🇸' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰' },
] as const;

export function LanguageSettings({ settings, onUpdate }: LanguageSettingsProps) {
  return (
    <div className="space-y-6">
      {/* UI Language */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Interface Language</Text>
        <Text size="xs" color="muted" className="mb-3">
          Choose the language for buttons, labels, and menus.
        </Text>
        <div className="space-y-2">
          {languages.map(lang => (
            <LanguageOption
              key={lang.code}
              flag={lang.flag}
              label={lang.label}
              nativeLabel={lang.nativeLabel}
              selected={settings.uiLanguage === lang.code}
              onClick={() => onUpdate('uiLanguage', lang.code)}
            />
          ))}
        </div>
      </div>

      {/* Voice Language */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Voice Language</Text>
        <Text size="xs" color="muted" className="mb-3">
          Choose the language the AI agent will speak in.
        </Text>
        <div className="space-y-2">
          {languages.map(lang => (
            <LanguageOption
              key={lang.code}
              flag={lang.flag}
              label={lang.label}
              nativeLabel={lang.nativeLabel}
              selected={settings.voiceLanguage === lang.code}
              onClick={() => onUpdate('voiceLanguage', lang.code)}
            />
          ))}
        </div>
      </div>

      {/* Info Note */}
      <div className="p-4 bg-neutral-800/50 rounded-xl border border-neutral-700/50">
        <div className="flex items-start gap-3">
          <InfoIcon className="w-5 h-5 text-primary-400 flex-shrink-0 mt-0.5" />
          <div>
            <Text size="sm" weight="medium" className="mb-1">
              Language Support
            </Text>
            <Text size="xs" color="muted">
              The voice agent can understand both English and Urdu. You can speak in either language
              and the agent will respond in your selected voice language.
            </Text>
          </div>
        </div>
      </div>
    </div>
  );
}

// Language Option Component
interface LanguageOptionProps {
  flag: string;
  label: string;
  nativeLabel: string;
  selected: boolean;
  onClick: () => void;
}

function LanguageOption({ flag, label, nativeLabel, selected, onClick }: LanguageOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`
        w-full flex items-center gap-3 p-3 rounded-xl
        border-2 transition-all duration-200 text-left
        ${selected
          ? 'bg-primary-500/10 border-primary-500'
          : 'bg-neutral-800/50 border-neutral-700 hover:border-neutral-600'
        }
      `}
      aria-pressed={selected}
    >
      <span className="text-2xl">{flag}</span>
      <div className="flex-1">
        <Text size="sm" weight="medium" color={selected ? 'primary' : 'default'}>
          {label}
        </Text>
        <Text size="xs" color="muted">{nativeLabel}</Text>
      </div>
      {selected && (
        <CheckIcon className="w-5 h-5 text-primary-400" />
      )}
    </button>
  );
}

// Icons
function InfoIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
