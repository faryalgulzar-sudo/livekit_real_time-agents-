'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Text } from '@/components/ui';

export interface TranscriptMessageData {
  id: string;
  speaker: 'user' | 'agent' | 'system';
  text: string;
  timestamp: Date;
  isFinal?: boolean;
}

interface TranscriptMessageProps extends HTMLAttributes<HTMLDivElement> {
  message: TranscriptMessageData;
  showTimestamp?: boolean;
  compact?: boolean;
}

const speakerConfig = {
  user: {
    label: 'You',
    bgClass: 'bg-primary-500/10 border-l-primary-500',
    textClass: 'text-primary-400',
    icon: '🎤',
  },
  agent: {
    label: 'Agent',
    bgClass: 'bg-accent-500/10 border-l-accent-500',
    textClass: 'text-accent-400',
    icon: '🤖',
  },
  system: {
    label: 'System',
    bgClass: 'bg-neutral-700/50 border-l-neutral-500',
    textClass: 'text-neutral-400',
    icon: 'ℹ️',
  },
};

export const TranscriptMessage = forwardRef<HTMLDivElement, TranscriptMessageProps>(
  ({ message, showTimestamp = true, compact = false, className = '', ...props }, ref) => {
    const config = speakerConfig[message.speaker];
    const timeString = message.timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

    return (
      <div
        ref={ref}
        className={`
          ${compact ? 'p-2' : 'p-3'}
          rounded-lg border-l-4
          ${config.bgClass}
          ${message.isFinal === false ? 'opacity-70' : ''}
          transition-opacity duration-200
          ${className}
        `}
        role="listitem"
        aria-label={`${config.label} said: ${message.text}`}
        {...props}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-1">
          <div className="flex items-center gap-2">
            <span className="text-sm" aria-hidden="true">{config.icon}</span>
            <Text size="xs" weight="medium" className={config.textClass}>
              {config.label}
            </Text>
            {message.isFinal === false && (
              <span className="text-xs text-neutral-500 italic">(listening...)</span>
            )}
          </div>
          {showTimestamp && (
            <Text size="xs" color="muted">
              {timeString}
            </Text>
          )}
        </div>

        {/* Message Text */}
        <Text size={compact ? 'xs' : 'sm'} className="leading-relaxed">
          {message.text}
        </Text>
      </div>
    );
  }
);

TranscriptMessage.displayName = 'TranscriptMessage';
