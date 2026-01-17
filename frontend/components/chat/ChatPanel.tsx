'use client';

import { useEffect, useRef, forwardRef, HTMLAttributes } from 'react';
import { MessageBubble, ChatMessageData } from './MessageBubble';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';
import { Drawer, Text, ActionButton } from '@/components/ui';

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
  messages: ChatMessageData[];
  onSendMessage: (message: string) => void;
  isConnected: boolean;
  isAgentTyping?: boolean;
  onClearChat?: () => void;
}

export function ChatPanel({
  isOpen,
  onClose,
  messages,
  onSendMessage,
  isConnected,
  isAgentTyping = false,
  onClearChat,
}: ChatPanelProps) {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isAgentTyping]);

  // Group messages by sender for visual continuity
  const shouldGroup = (current: ChatMessageData, previous: ChatMessageData | undefined): boolean => {
    if (!previous) return false;
    if (current.sender !== previous.sender) return false;
    const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
    return timeDiff < 60000; // 1 minute
  };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Chat"
      size="md"
    >
      <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4">
        {/* Header Actions */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-neutral-700/50">
          <div className="flex items-center gap-2">
            <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-success-500' : 'bg-neutral-500'}`} />
            <Text size="sm" color={isConnected ? 'success' : 'muted'}>
              {isConnected ? 'Connected' : 'Offline'}
            </Text>
          </div>
          {onClearChat && messages.length > 0 && (
            <ActionButton
              variant="ghost"
              size="sm"
              onClick={onClearChat}
            >
              Clear
            </ActionButton>
          )}
        </div>

        {/* Messages */}
        <div
          ref={scrollContainerRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          role="log"
          aria-live="polite"
          aria-label="Chat messages"
        >
          {messages.length === 0 ? (
            <EmptyState isConnected={isConnected} />
          ) : (
            <>
              {messages.map((msg, index) => (
                <MessageBubble
                  key={msg.id}
                  message={msg}
                  isGrouped={shouldGroup(msg, messages[index - 1])}
                  showAvatar={!shouldGroup(msg, messages[index - 1])}
                  showTimestamp={!shouldGroup(messages[index + 1], msg)}
                />
              ))}
              {isAgentTyping && <TypingIndicator who="agent" />}
              <div ref={messagesEndRef} />
            </>
          )}
        </div>

        {/* Input */}
        <ChatInput
          onSubmit={onSendMessage}
          disabled={!isConnected}
          placeholder={isConnected ? 'Type a message...' : 'Connect to start chatting'}
          showCharCount={false}
        />
      </div>
    </Drawer>
  );
}

// Empty State Component
function EmptyState({ isConnected }: { isConnected: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center py-12">
      <div className="w-16 h-16 rounded-full bg-neutral-800 flex items-center justify-center mb-4">
        <ChatIcon className="w-8 h-8 text-neutral-600" />
      </div>
      <Text weight="medium" color="muted" className="mb-2">
        {isConnected ? 'No Messages Yet' : 'Not Connected'}
      </Text>
      <Text size="sm" color="muted" className="max-w-xs">
        {isConnected
          ? 'Start a conversation by typing a message below or speaking to the agent.'
          : 'Connect to the voice agent to start chatting.'}
      </Text>
    </div>
  );
}

// Standalone Chat Messages List (for inline use)
interface ChatMessagesListProps extends HTMLAttributes<HTMLDivElement> {
  messages: ChatMessageData[];
  isAgentTyping?: boolean;
  maxHeight?: string;
}

export const ChatMessagesList = forwardRef<HTMLDivElement, ChatMessagesListProps>(
  ({ messages, isAgentTyping = false, maxHeight = '400px', className = '', ...props }, ref) => {
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
      if (messagesEndRef.current) {
        messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, [messages, isAgentTyping]);

    const shouldGroup = (current: ChatMessageData, previous: ChatMessageData | undefined): boolean => {
      if (!previous) return false;
      if (current.sender !== previous.sender) return false;
      const timeDiff = current.timestamp.getTime() - previous.timestamp.getTime();
      return timeDiff < 60000;
    };

    return (
      <div
        ref={ref}
        className={`overflow-y-auto ${className}`}
        style={{ maxHeight }}
        role="log"
        aria-live="polite"
        {...props}
      >
        {messages.map((msg, index) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isGrouped={shouldGroup(msg, messages[index - 1])}
            showAvatar={!shouldGroup(msg, messages[index - 1])}
            showTimestamp={!shouldGroup(messages[index + 1], msg)}
          />
        ))}
        {isAgentTyping && <TypingIndicator who="agent" />}
        <div ref={messagesEndRef} />
      </div>
    );
  }
);

ChatMessagesList.displayName = 'ChatMessagesList';

// Icon
function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}
