'use client';

import { Text } from '@/components/ui';

interface TypingIndicatorProps {
  who?: 'agent' | 'user';
}

export function TypingIndicator({ who = 'agent' }: TypingIndicatorProps) {
  const label = who === 'agent' ? 'Agent is typing' : 'You are typing';

  return (
    <div className="flex items-center gap-2 px-4 py-2">
      <div className="flex items-center gap-1">
        <span
          className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '0ms' }}
        />
        <span
          className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '150ms' }}
        />
        <span
          className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce"
          style={{ animationDelay: '300ms' }}
        />
      </div>
      <Text size="xs" color="muted">{label}</Text>
    </div>
  );
}
