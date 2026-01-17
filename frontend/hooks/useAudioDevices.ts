'use client';

import { useState, useEffect, useCallback } from 'react';

export interface AudioDevice {
  deviceId: string;
  label: string;
  kind: 'audioinput' | 'audiooutput';
}

interface UseAudioDevicesReturn {
  inputDevices: AudioDevice[];
  outputDevices: AudioDevice[];
  selectedInputId: string;
  selectedOutputId: string;
  setSelectedInputId: (id: string) => void;
  setSelectedOutputId: (id: string) => void;
  refreshDevices: () => Promise<void>;
  hasPermission: boolean | null;
  requestPermission: () => Promise<boolean>;
  isLoading: boolean;
  error: string | null;
}

export function useAudioDevices(): UseAudioDevicesReturn {
  const [inputDevices, setInputDevices] = useState<AudioDevice[]>([]);
  const [outputDevices, setOutputDevices] = useState<AudioDevice[]>([]);
  const [selectedInputId, setSelectedInputId] = useState<string>('default');
  const [selectedOutputId, setSelectedOutputId] = useState<string>('default');
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const enumerateDevices = useCallback(async () => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      setError('Media devices not supported');
      setIsLoading(false);
      return;
    }

    try {
      const devices = await navigator.mediaDevices.enumerateDevices();

      const inputs: AudioDevice[] = devices
        .filter(d => d.kind === 'audioinput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Microphone ${d.deviceId.slice(0, 8)}`,
          kind: 'audioinput' as const,
        }));

      const outputs: AudioDevice[] = devices
        .filter(d => d.kind === 'audiooutput')
        .map(d => ({
          deviceId: d.deviceId,
          label: d.label || `Speaker ${d.deviceId.slice(0, 8)}`,
          kind: 'audiooutput' as const,
        }));

      setInputDevices(inputs);
      setOutputDevices(outputs);

      // Check if we have labels (indicates permission granted)
      const hasLabels = devices.some(d => d.label && d.label.length > 0);
      setHasPermission(hasLabels);

      setError(null);
    } catch (err) {
      console.error('Failed to enumerate devices:', err);
      setError('Failed to get audio devices');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) {
      return false;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Stop all tracks immediately
      stream.getTracks().forEach(track => track.stop());
      setHasPermission(true);
      // Re-enumerate to get labels
      await enumerateDevices();
      return true;
    } catch (err) {
      console.error('Permission denied:', err);
      setHasPermission(false);
      setError('Microphone permission denied');
      return false;
    }
  }, [enumerateDevices]);

  const refreshDevices = useCallback(async () => {
    setIsLoading(true);
    await enumerateDevices();
  }, [enumerateDevices]);

  // Initial load
  useEffect(() => {
    enumerateDevices();
  }, [enumerateDevices]);

  // Listen for device changes
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices) return;

    const handleDeviceChange = () => {
      enumerateDevices();
    };

    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [enumerateDevices]);

  return {
    inputDevices,
    outputDevices,
    selectedInputId,
    selectedOutputId,
    setSelectedInputId,
    setSelectedOutputId,
    refreshDevices,
    hasPermission,
    requestPermission,
    isLoading,
    error,
  };
}
