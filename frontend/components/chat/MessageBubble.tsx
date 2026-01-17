'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Text } from '@/components/ui';

export interface ChatMessageData {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
  status?: 'sending' | 'sent' | 'delivered' | 'error';
}

interface MessageBubbleProps extends HTMLAttributes<HTMLDivElement> {
  message: ChatMessageData;
  showTimestamp?: boolean;
  showAvatar?: boolean;
  isGrouped?: boolean;
}

const senderConfig = {
  user: {
    align: 'justify-end',
    bubble: 'bg-primary-500/20 border border-primary-500/30 rounded-2xl rounded-br-md',
    text: 'text-neutral-100',
    avatar: '👤',
    avatarBg: 'bg-primary-500/20',
  },
  agent: {
    align: 'justify-start',
    bubble: 'bg-neutral-700/50 border border-neutral-600/30 rounded-2xl rounded-bl-md',
    text: 'text-neutral-100',
    avatar: '🤖',
    avatarBg: 'bg-accent-500/20',
  },
  system: {
    align: 'justify-center',
    bubble: 'bg-neutral-800/50 border border-neutral-700/30 rounded-xl',
    text: 'text-neutral-400 italic',
    avatar: 'ℹ️',
    avatarBg: 'bg-neutral-700',
  },
};

export const MessageBubble = forwardRef<HTMLDivElement, MessageBubbleProps>(
  ({ message, showTimestamp = true, showAvatar = true, isGrouped = false, className = '', ...props }, ref) => {
    const config = senderConfig[message.sender];
    const timeString = message.timestamp.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
    });

    const isSystem = message.sender === 'system';

    return (
      <div
        ref={ref}
        className={`flex ${config.align} ${isGrouped ? 'mt-1' : 'mt-3'} ${className}`}
        {...props}
      >
        <div className={`flex items-end gap-2 max-w-[85%] ${message.sender === 'user' ? 'flex-row-reverse' : ''}`}>
          {/* Avatar */}
          {showAvatar && !isGrouped && !isSystem && (
            <div className={`w-8 h-8 rounded-full ${config.avatarBg} flex items-center justify-center flex-shrink-0`}>
              <span className="text-sm">{config.avatar}</span>
            </div>
          )}
          {showAvatar && isGrouped && !isSystem && (
            <div className="w-8 flex-shrink-0" /> // Spacer for alignment
          )}

          {/* Message Content */}
          <div className={`${config.bubble} px-4 py-2.5 ${isSystem ? 'text-center' : ''}`}>
            <Text size="sm" className={config.text}>
              {message.text}
            </Text>

            {/* Timestamp & Status */}
            {showTimestamp && (
              <div className={`flex items-center gap-1.5 mt-1 ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                <Text size="xs" color="muted">{timeString}</Text>
                {message.sender === 'user' && message.status && (
                  <StatusIndicator status={message.status} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }
);

MessageBubble.displayName = 'MessageBubble';

// Status Indicator
function StatusIndicator({ status }: { status: NonNullable<ChatMessageData['status']> }) {
  const statusConfig = {
    sending: { icon: '○', color: 'text-neutral-500', label: 'Sending' },
    sent: { icon: '✓', color: 'text-neutral-500', label: 'Sent' },
    delivered: { icon: '✓✓', color: 'text-primary-400', label: 'Delivered' },
    error: { icon: '!', color: 'text-error-500', label: 'Error' },
  };

  const config = statusConfig[status];

  return (
    <span
      className={`text-xs ${config.color}`}
      aria-label={config.label}
      title={config.label}
    >
      {config.icon}
    </span>
  );
}
