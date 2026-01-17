'use client';

import { useAudioDevices } from '@/hooks/useAudioDevices';
import { AppSettings } from '@/hooks/useSettings';
import { Text, ActionButton } from '@/components/ui';

interface AudioSettingsProps {
  settings: AppSettings;
  onUpdate: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => void;
}

export function AudioSettings({ settings, onUpdate }: AudioSettingsProps) {
  const {
    inputDevices,
    outputDevices,
    hasPermission,
    requestPermission,
    isLoading,
    refreshDevices,
  } = useAudioDevices();

  return (
    <div className="space-y-6">
      {/* Permission Warning */}
      {hasPermission === false && (
        <div className="p-4 bg-warning-500/10 border border-warning-500/30 rounded-xl">
          <div className="flex items-start gap-3">
            <MicOffIcon className="w-5 h-5 text-warning-500 flex-shrink-0 mt-0.5" />
            <div className="flex-1">
              <Text size="sm" weight="medium" className="text-warning-400 mb-1">
                Microphone Access Required
              </Text>
              <Text size="xs" color="muted" className="mb-3">
                Grant microphone permission to select audio devices.
              </Text>
              <ActionButton
                variant="primary"
                size="sm"
                onClick={requestPermission}
              >
                Grant Permission
              </ActionButton>
            </div>
          </div>
        </div>
      )}

      {/* Input Device */}
      <div>
        <label className="block mb-2">
          <Text size="sm" weight="medium">Microphone</Text>
        </label>
        <select
          value={settings.inputDeviceId}
          onChange={(e) => onUpdate('inputDeviceId', e.target.value)}
          disabled={isLoading || !hasPermission}
          className="input"
        >
          <option value="default">Default Microphone</option>
          {inputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      {/* Output Device */}
      <div>
        <label className="block mb-2">
          <Text size="sm" weight="medium">Speaker</Text>
        </label>
        <select
          value={settings.outputDeviceId}
          onChange={(e) => onUpdate('outputDeviceId', e.target.value)}
          disabled={isLoading}
          className="input"
        >
          <option value="default">Default Speaker</option>
          {outputDevices.map(device => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label}
            </option>
          ))}
        </select>
      </div>

      {/* Volume Controls */}
      <div>
        <label className="block mb-2">
          <Text size="sm" weight="medium">Output Volume</Text>
        </label>
        <div className="flex items-center gap-3">
          <input
            type="range"
            min="0"
            max="100"
            value={settings.outputVolume}
            onChange={(e) => onUpdate('outputVolume', parseInt(e.target.value))}
            className="flex-1 h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500"
          />
          <Text size="sm" className="w-10 text-right">{settings.outputVolume}%</Text>
        </div>
      </div>

      {/* Audio Processing */}
      <div>
        <Text size="sm" weight="medium" className="mb-3">Audio Processing</Text>
        <div className="space-y-3">
          <ToggleOption
            label="Echo Cancellation"
            description="Reduce echo from speakers"
            checked={settings.echoCancellation}
            onChange={(checked) => onUpdate('echoCancellation', checked)}
          />
          <ToggleOption
            label="Noise Suppression"
            description="Filter background noise"
            checked={settings.noiseSuppression}
            onChange={(checked) => onUpdate('noiseSuppression', checked)}
          />
          <ToggleOption
            label="Auto Gain Control"
            description="Automatically adjust microphone volume"
            checked={settings.autoGainControl}
            onChange={(checked) => onUpdate('autoGainControl', checked)}
          />
        </div>
      </div>

      {/* Refresh Button */}
      <ActionButton
        variant="ghost"
        size="sm"
        onClick={refreshDevices}
        leftIcon={<RefreshIcon className="w-4 h-4" />}
      >
        Refresh Devices
      </ActionButton>
    </div>
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
function MicOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3l18 18" />
    </svg>
  );
}

function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}
