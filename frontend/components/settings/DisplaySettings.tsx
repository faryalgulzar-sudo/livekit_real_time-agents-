'use client';

import { AppSettings } from '@/hooks/useSettings';
import { Text } from '@/components/ui';

interface DisplaySettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function DisplaySettings({ settings, onUpdate }: DisplaySettingsProps) {
  return (
    <div className="space-y-6">
      {/* Theme */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Theme</Text>
        <div className="grid grid-cols-3 gap-2">
          <ThemeOption
            label="Dark"
            value="dark"
            selected={settings.theme === 'dark'}
            onClick={() => onUpdate('theme', 'dark')}
            icon={<MoonIcon className="w-5 h-5" />}
          />
          <ThemeOption
            label="Light"
            value="light"
            selected={settings.theme === 'light'}
            onClick={() => onUpdate('theme', 'light')}
            icon={<SunIcon className="w-5 h-5" />}
          />
          <ThemeOption
            label="System"
            value="system"
            selected={settings.theme === 'system'}
            onClick={() => onUpdate('theme', 'system')}
            icon={<ComputerIcon className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Font Size */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Font Size</Text>
        <div className="grid grid-cols-3 gap-2">
          <FontSizeOption
            label="Small"
            value="small"
            selected={settings.fontSize === 'small'}
            onClick={() => onUpdate('fontSize', 'small')}
            preview="Aa"
            textSize="text-xs"
          />
          <FontSizeOption
            label="Medium"
            value="medium"
            selected={settings.fontSize === 'medium'}
            onClick={() => onUpdate('fontSize', 'medium')}
            preview="Aa"
            textSize="text-base"
          />
          <FontSizeOption
            label="Large"
            value="large"
            selected={settings.fontSize === 'large'}
            onClick={() => onUpdate('fontSize', 'large')}
            preview="Aa"
            textSize="text-xl"
          />
        </div>
      </div>

      {/* Accessibility */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Accessibility</Text>
        <div className="space-y-3">
          <ToggleOption
            label="Reduced Motion"
            description="Minimize animations and transitions"
            checked={settings.reducedMotion}
            onChange={(checked) => onUpdate('reducedMotion', checked)}
          />
          <ToggleOption
            label="Sound Effects"
            description="Play sounds for notifications and actions"
            checked={settings.soundEnabled}
            onChange={(checked) => onUpdate('soundEnabled', checked)}
          />
        </div>
      </div>
    </div>
  );
}

// Theme Option Component
interface ThemeOptionProps {
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  icon: React.ReactNode;
}

function ThemeOption({ label, selected, onClick, icon }: ThemeOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl
        border-2 transition-all duration-200
        ${selected
          ? 'bg-primary-500/10 border-primary-500 text-primary-400'
          : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
        }
      `}
      aria-pressed={selected}
    >
      {icon}
      <Text size="xs" weight="medium">{label}</Text>
    </button>
  );
}

// Font Size Option Component
interface FontSizeOptionProps {
  label: string;
  value: string;
  selected: boolean;
  onClick: () => void;
  preview: string;
  textSize: string;
}

function FontSizeOption({ label, selected, onClick, preview, textSize }: FontSizeOptionProps) {
  return (
    <button
      onClick={onClick}
      className={`
        flex flex-col items-center gap-2 p-4 rounded-xl
        border-2 transition-all duration-200
        ${selected
          ? 'bg-primary-500/10 border-primary-500 text-primary-400'
          : 'bg-neutral-800/50 border-neutral-700 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300'
        }
      `}
      aria-pressed={selected}
    >
      <span className={`font-semibold ${textSize}`}>{preview}</span>
      <Text size="xs" weight="medium">{label}</Text>
    </button>
  );
}

// Toggle Option Component
interface ToggleOptionProps {
  label: string;
  description: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

function ToggleOption({ label, description, checked, onChange }: ToggleOptionProps) {
  return (
    <label className="flex items-center justify-between p-3 bg-neutral-800/50 rounded-lg cursor-pointer hover:bg-neutral-800 transition-colors">
      <div>
        <Text size="sm" weight="medium">{label}</Text>
        <Text size="xs" color="muted">{description}</Text>
      </div>
      <div
        className={`
          relative w-11 h-6 rounded-full transition-colors cursor-pointer
          ${checked ? 'bg-primary-500' : 'bg-neutral-600'}
        `}
        onClick={() => onChange(!checked)}
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onChange(!checked);
          }
        }}
      >
        <div
          className={`
            absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform
            ${checked ? 'translate-x-6' : 'translate-x-1'}
          `}
        />
      </div>
    </label>
  );
}

// Icons
function MoonIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z" />
    </svg>
  );
}

function SunIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}

function ComputerIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
