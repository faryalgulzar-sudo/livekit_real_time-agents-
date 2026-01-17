'use client';

import { useState, useRef, KeyboardEvent, forwardRef, HTMLAttributes } from 'react';
import { ActionButton, IconButton } from '@/components/ui';

interface ChatInputProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSubmit'> {
  onSubmit: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  maxLength?: number;
  showCharCount?: boolean;
  autoFocus?: boolean;
}

export const ChatInput = forwardRef<HTMLDivElement, ChatInputProps>(
  ({
    onSubmit,
    disabled = false,
    placeholder = 'Type a message...',
    maxLength = 1000,
    showCharCount = false,
    autoFocus = false,
    className = '',
    ...props
  }, ref) => {
    const [message, setMessage] = useState('');
    const inputRef = useRef<HTMLTextAreaElement>(null);

    const handleSubmit = () => {
      const trimmed = message.trim();
      if (trimmed && !disabled) {
        onSubmit(trimmed);
        setMessage('');
        // Reset textarea height
        if (inputRef.current) {
          inputRef.current.style.height = 'auto';
        }
      }
    };

    const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    };

    const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const target = e.target;
      setMessage(target.value);

      // Auto-resize textarea
      target.style.height = 'auto';
      target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
    };

    const charCount = message.length;
    const isNearLimit = Boolean(maxLength && charCount > maxLength * 0.9);
    const isOverLimit = Boolean(maxLength && charCount > maxLength);

    return (
      <div
        ref={ref}
        className={`border-t border-neutral-700/50 p-3 ${className}`}
        {...props}
      >
        <div className="flex items-end gap-2">
          {/* Text Input */}
          <div className="flex-1 relative">
            <textarea
              ref={inputRef}
              value={message}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              disabled={disabled}
              placeholder={disabled ? 'Connect to chat...' : placeholder}
              maxLength={maxLength}
              autoFocus={autoFocus}
              rows={1}
              className="
                w-full px-4 py-3 pr-10
                bg-neutral-800 border border-neutral-700 rounded-xl
                text-neutral-100 placeholder-neutral-500
                focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500
                disabled:opacity-50 disabled:cursor-not-allowed
                resize-none transition-colors
                min-h-[48px] max-h-[120px]
              "
              style={{ height: '48px' }}
              aria-label="Chat message input"
            />

            {/* Emoji Button (placeholder) */}
            <button
              type="button"
              className="absolute right-3 bottom-3 text-neutral-500 hover:text-neutral-300 transition-colors"
              aria-label="Add emoji"
              disabled={disabled}
            >
              <EmojiIcon className="w-5 h-5" />
            </button>
          </div>

          {/* Send Button */}
          <ActionButton
            variant="primary"
            size="lg"
            onClick={handleSubmit}
            disabled={disabled || !message.trim() || isOverLimit}
            aria-label="Send message"
          >
            <SendIcon className="w-5 h-5" />
          </ActionButton>
        </div>

        {/* Character Count */}
        {showCharCount && maxLength && (
          <div className="flex justify-end mt-1">
            <span
              className={`text-xs ${
                isOverLimit
                  ? 'text-error-500'
                  : isNearLimit
                  ? 'text-warning-500'
                  : 'text-neutral-500'
              }`}
            >
              {charCount}/{maxLength}
            </span>
          </div>
        )}
      </div>
    );
  }
);

ChatInput.displayName = 'ChatInput';

// Icons
function SendIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
    </svg>
  );
}

function EmojiIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
