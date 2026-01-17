'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AppSettings {
  // Audio
  inputDeviceId: string;
  outputDeviceId: string;
  inputVolume: number;
  outputVolume: number;
  echoCancellation: boolean;
  noiseSuppression: boolean;
  autoGainControl: boolean;

  // Display
  theme: 'dark' | 'light' | 'system';
  reducedMotion: boolean;
  fontSize: 'small' | 'medium' | 'large';

  // Language
  uiLanguage: 'en' | 'ur';
  voiceLanguage: 'en' | 'ur';

  // Notifications
  soundEnabled: boolean;
  notificationsEnabled: boolean;
}

const defaultSettings: AppSettings = {
  inputDeviceId: 'default',
  outputDeviceId: 'default',
  inputVolume: 100,
  outputVolume: 80,
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  theme: 'dark',
  reducedMotion: false,
  fontSize: 'medium',
  uiLanguage: 'en',
  voiceLanguage: 'en',
  soundEnabled: true,
  notificationsEnabled: true,
};

const STORAGE_KEY = 'livekit-agent-settings';

interface UseSettingsReturn {
  settings: AppSettings;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
  updateSettings: (updates: Partial<AppSettings>) => void;
  resetSettings: () => void;
  isLoaded: boolean;
}

export function useSettings(): UseSettingsReturn {
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load settings from localStorage on mount
  useEffect(() => {
    if (typeof window === 'undefined') return;

    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setSettings({ ...defaultSettings, ...parsed });
      }
    } catch (err) {
      console.error('Failed to load settings:', err);
    } finally {
      setIsLoaded(true);
    }
  }, []);

  // Save settings to localStorage when they change
  useEffect(() => {
    if (!isLoaded || typeof window === 'undefined') return;

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (err) {
      console.error('Failed to save settings:', err);
    }
  }, [settings, isLoaded]);

  const updateSetting = useCallback(<K extends keyof AppSettings>(
    key: K,
    value: AppSettings[K]
  ) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  }, []);

  const updateSettings = useCallback((updates: Partial<AppSettings>) => {
    setSettings(prev => ({ ...prev, ...updates }));
  }, []);

  const resetSettings = useCallback(() => {
    setSettings(defaultSettings);
    if (typeof window !== 'undefined') {
      localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  return {
    settings,
    updateSetting,
    updateSettings,
    resetSettings,
    isLoaded,
  };
}

// Export default settings for reference
export { defaultSettings };
