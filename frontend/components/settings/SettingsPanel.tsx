'use client';

import { useState } from 'react';
import { useSettings, AppSettings } from '@/hooks/useSettings';
import { AudioSettings } from './AudioSettings';
import { DisplaySettings } from './DisplaySettings';
import { LanguageSettings } from './LanguageSettings';
import { Drawer, Text, ActionButton, Heading } from '@/components/ui';

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type SettingsTab = 'audio' | 'display' | 'language';

const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
  { id: 'audio', label: 'Audio', icon: <AudioIcon className="w-4 h-4" /> },
  { id: 'display', label: 'Display', icon: <DisplayIcon className="w-4 h-4" /> },
  { id: 'language', label: 'Language', icon: <LanguageIcon className="w-4 h-4" /> },
];

export function SettingsPanel({ isOpen, onClose }: SettingsPanelProps) {
  const { settings, updateSetting, resetSettings, isLoaded } = useSettings();
  const [activeTab, setActiveTab] = useState<SettingsTab>('audio');
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  const handleUpdate = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    updateSetting(key, value);
  };

  const handleReset = () => {
    resetSettings();
    setShowResetConfirm(false);
  };

  if (!isLoaded) {
    return null;
  }

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Settings"
      size="lg"
    >
      <div className="flex flex-col h-full -mx-4 -mt-4">
        {/* Tabs */}
        <div className="flex border-b border-neutral-700 px-4">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`
                flex items-center gap-2 px-4 py-3
                border-b-2 transition-colors
                ${activeTab === tab.id
                  ? 'border-primary-500 text-primary-400'
                  : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }
              `}
              aria-selected={activeTab === tab.id}
              role="tab"
            >
              {tab.icon}
              <span className="text-sm font-medium">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === 'audio' && (
            <AudioSettings settings={settings} onUpdate={handleUpdate} />
          )}
          {activeTab === 'display' && (
            <DisplaySettings settings={settings} onUpdate={handleUpdate} />
          )}
          {activeTab === 'language' && (
            <LanguageSettings settings={settings} onUpdate={handleUpdate} />
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-700 p-4">
          {showResetConfirm ? (
            <div className="flex items-center justify-between">
              <Text size="sm" color="muted">Reset all settings to default?</Text>
              <div className="flex gap-2">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowResetConfirm(false)}
                >
                  Cancel
                </ActionButton>
                <ActionButton
                  variant="danger"
                  size="sm"
                  onClick={handleReset}
                >
                  Reset
                </ActionButton>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Text size="xs" color="muted">Agent 007 v1.0</Text>
              </div>
              <ActionButton
                variant="ghost"
                size="sm"
                onClick={() => setShowResetConfirm(true)}
              >
                Reset to Defaults
              </ActionButton>
            </div>
          )}
        </div>
      </div>
    </Drawer>
  );
}

// Icons
function AudioIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
    </svg>
  );
}

function DisplayIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}

function LanguageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5h12M9 3v2m1.048 9.5A18.022 18.022 0 016.412 9m6.088 9h7M11 21l5-10 5 10M12.751 5C11.783 10.77 8.07 15.61 3 18.129" />
    </svg>
  );
}
