'use client';

import { useEffect, useRef, useState, forwardRef, HTMLAttributes } from 'react';
import { TranscriptMessage, TranscriptMessageData } from './TranscriptMessage';
import { Drawer, Card, CardHeader, CardTitle, Text, ActionButton, IconButton } from '@/components/ui';

// Re-export for convenience
export type TranscriptEntry = TranscriptMessageData;

// Drawer-based TranscriptPanel (for use in page.tsx)
interface TranscriptPanelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  entries: TranscriptMessageData[];
  isRecording?: boolean;
  onClear?: () => void;
  onExport?: () => void;
}

export function TranscriptPanel({
  isOpen,
  onClose,
  entries,
  isRecording = false,
  onClear,
  onExport,
}: TranscriptPanelDrawerProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [filter, setFilter] = useState<'all' | 'user' | 'agent'>('all');

  // Auto-scroll to bottom when new entries arrive
  useEffect(() => {
    if (isAtBottom && scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
    }
  }, [entries, isAtBottom]);

  // Track scroll position
  const handleScroll = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
    setIsAtBottom(isNearBottom);
  };

  // Scroll to bottom
  const scrollToBottom = () => {
    if (scrollContainerRef.current) {
      scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      setIsAtBottom(true);
    }
  };

  // Export transcript
  const handleExport = () => {
    if (onExport) {
      onExport();
    } else {
      const transcript = entries.map(entry => {
        const time = entry.timestamp.toLocaleTimeString('en-US', {
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        });
        return `[${time}] ${entry.speaker.toUpperCase()}: ${entry.text}`;
      }).join('\n');

      const blob = new Blob([transcript], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `transcript-${new Date().toISOString().split('T')[0]}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  // Filter entries
  const filteredEntries = entries.filter(entry => {
    if (filter === 'all') return true;
    return entry.speaker === filter;
  });

  // Count by speaker
  const userCount = entries.filter(m => m.speaker === 'user').length;
  const agentCount = entries.filter(m => m.speaker === 'agent').length;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Live Transcript"
      size="md"
    >
      <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4">
        {/* Header */}
        <div className="flex items-center justify-between px-4 pb-3 border-b border-neutral-700/50">
          <div className="flex items-center gap-2">
            {isRecording && (
              <span className="flex items-center gap-1.5 px-2 py-0.5 bg-success-500/20 rounded-full">
                <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
                <Text size="xs" color="success">Listening</Text>
              </span>
            )}
            <Text size="sm" color="muted">{entries.length} messages</Text>
          </div>

          <div className="flex items-center gap-2">
            <IconButton
              variant="ghost"
              onClick={handleExport}
              aria-label="Export transcript"
            >
              <ExportIcon className="w-4 h-4" />
            </IconButton>
            {onClear && entries.length > 0 && (
              <IconButton
                variant="ghost"
                onClick={onClear}
                aria-label="Clear transcript"
              >
                <TrashIcon className="w-4 h-4" />
              </IconButton>
            )}
          </div>
        </div>

        {/* Filter Tabs */}
        <div className="flex gap-2 px-4 py-3 border-b border-neutral-700/50">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={entries.length}
          >
            All
          </FilterButton>
          <FilterButton
            active={filter === 'user'}
            onClick={() => setFilter('user')}
            count={userCount}
          >
            You
          </FilterButton>
          <FilterButton
            active={filter === 'agent'}
            onClick={() => setFilter('agent')}
            count={agentCount}
          >
            Agent
          </FilterButton>
        </div>

        {/* Messages Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-2"
          role="log"
          aria-live="polite"
          aria-label="Transcript messages"
        >
          {filteredEntries.length === 0 ? (
            <EmptyStateSimple />
          ) : (
            filteredEntries.map((entry) => (
              <TranscriptMessage
                key={entry.id}
                message={entry}
                showTimestamp
                compact={false}
              />
            ))
          )}
        </div>

        {/* Scroll to Bottom Button */}
        {!isAtBottom && entries.length > 5 && (
          <div className="absolute bottom-20 left-1/2 -translate-x-1/2">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={scrollToBottom}
              leftIcon={<ArrowDownIcon className="w-4 h-4" />}
            >
              New messages
            </ActionButton>
          </div>
        )}
      </div>
    </Drawer>
  );
}

// Inline Transcript Panel (Card-based, for embedding)
interface TranscriptPanelInlineProps extends HTMLAttributes<HTMLDivElement> {
  messages: TranscriptMessageData[];
  isConnected: boolean;
  isListening?: boolean;
  onClear?: () => void;
  onExport?: () => void;
  maxHeight?: string;
  showHeader?: boolean;
  autoScroll?: boolean;
}

export const TranscriptPanelInline = forwardRef<HTMLDivElement, TranscriptPanelInlineProps>(
  ({
    messages,
    isConnected,
    isListening = false,
    onClear,
    onExport,
    maxHeight = '400px',
    showHeader = true,
    autoScroll = true,
    className = '',
    ...props
  }, ref) => {
    const scrollContainerRef = useRef<HTMLDivElement>(null);
    const [isAtBottom, setIsAtBottom] = useState(true);
    const [filter, setFilter] = useState<'all' | 'user' | 'agent'>('all');

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
      if (autoScroll && isAtBottom && scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
      }
    }, [messages, autoScroll, isAtBottom]);

    // Track scroll position
    const handleScroll = () => {
      if (!scrollContainerRef.current) return;
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 50;
      setIsAtBottom(isNearBottom);
    };

    // Scroll to bottom button
    const scrollToBottom = () => {
      if (scrollContainerRef.current) {
        scrollContainerRef.current.scrollTop = scrollContainerRef.current.scrollHeight;
        setIsAtBottom(true);
      }
    };

    // Filter messages
    const filteredMessages = messages.filter(msg => {
      if (filter === 'all') return true;
      return msg.speaker === filter;
    });

    // Count by speaker
    const userCount = messages.filter(m => m.speaker === 'user').length;
    const agentCount = messages.filter(m => m.speaker === 'agent').length;

    return (
      <Card ref={ref} className={`flex flex-col ${className}`} padding="none" {...props}>
        {showHeader && (
          <CardHeader className="p-4 border-b border-neutral-700/50">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <TranscriptIcon className="w-5 h-5 text-primary-400" />
                <CardTitle>Live Transcript</CardTitle>
                {isListening && (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 bg-success-500/20 rounded-full">
                    <span className="w-1.5 h-1.5 bg-success-500 rounded-full animate-pulse" />
                    <Text size="xs" color="success">Listening</Text>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                {onExport && (
                  <IconButton
                    variant="ghost"
                    onClick={onExport}
                    aria-label="Export transcript"
                  >
                    <ExportIcon className="w-4 h-4" />
                  </IconButton>
                )}
                {onClear && messages.length > 0 && (
                  <IconButton
                    variant="ghost"
                    onClick={onClear}
                    aria-label="Clear transcript"
                  >
                    <TrashIcon className="w-4 h-4" />
                  </IconButton>
                )}
              </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex gap-2">
              <FilterButton
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                count={messages.length}
              >
                All
              </FilterButton>
              <FilterButton
                active={filter === 'user'}
                onClick={() => setFilter('user')}
                count={userCount}
              >
                You
              </FilterButton>
              <FilterButton
                active={filter === 'agent'}
                onClick={() => setFilter('agent')}
                count={agentCount}
              >
                Agent
              </FilterButton>
            </div>
          </CardHeader>
        )}

        {/* Messages Container */}
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto p-4 space-y-2"
          style={{ maxHeight }}
          role="log"
          aria-live="polite"
          aria-label="Transcript messages"
        >
          {!isConnected ? (
            <EmptyState
              icon={<WifiOffIcon className="w-10 h-10" />}
              title="Not Connected"
              description="Connect to start seeing transcripts"
            />
          ) : filteredMessages.length === 0 ? (
            <EmptyState
              icon={<TranscriptIcon className="w-10 h-10" />}
              title="No Transcripts Yet"
              description="Start speaking to see your conversation transcribed here"
            />
          ) : (
            filteredMessages.map((msg) => (
              <TranscriptMessage
                key={msg.id}
                message={msg}
                showTimestamp
                compact={false}
              />
            ))
          )}
        </div>

        {/* Scroll to Bottom Button */}
        {!isAtBottom && messages.length > 5 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
            <ActionButton
              variant="secondary"
              size="sm"
              onClick={scrollToBottom}
              leftIcon={<ArrowDownIcon className="w-4 h-4" />}
            >
              New messages
            </ActionButton>
          </div>
        )}
      </Card>
    );
  }
);

TranscriptPanelInline.displayName = 'TranscriptPanelInline';

// Filter Button Component
interface FilterButtonProps {
  active: boolean;
  onClick: () => void;
  count: number;
  children: React.ReactNode;
}

function FilterButton({ active, onClick, count, children }: FilterButtonProps) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 rounded-lg text-xs font-medium
        transition-colors duration-200
        ${active
          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
          : 'bg-neutral-700/30 text-neutral-400 hover:bg-neutral-700/50 hover:text-neutral-300'
        }
      `}
    >
      {children}
      <span className={`ml-1.5 ${active ? 'text-primary-300' : 'text-neutral-500'}`}>
        ({count})
      </span>
    </button>
  );
}

// Simple Empty State
function EmptyStateSimple() {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <TranscriptIcon className="w-12 h-12 text-neutral-600 mb-4" />
      <Text weight="medium" color="muted" className="mb-2">No Transcripts Yet</Text>
      <Text size="sm" color="muted">
        Start speaking to see your conversation transcribed here
      </Text>
    </div>
  );
}

// Empty State Component
interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  description: string;
}

function EmptyState({ icon, title, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-neutral-600 mb-3">{icon}</div>
      <Text weight="medium" color="muted" className="mb-1">{title}</Text>
      <Text size="sm" color="muted">{description}</Text>
    </div>
  );
}

// Icons
function TranscriptIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function ExportIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
    </svg>
  );
}

function TrashIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
    </svg>
  );
}

function WifiOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 5.636a9 9 0 010 12.728m0 0l-2.829-2.829m2.829 2.829L21 21M15.536 8.464a5 5 0 010 7.072m0 0l-2.829-2.829m-4.243 2.829a4.978 4.978 0 01-1.414-2.83m-1.414 5.658a9 9 0 01-2.167-9.238m7.824 2.167a1 1 0 111.414 1.414m-1.414-1.414L3 3m8.293 8.293l1.414 1.414" />
    </svg>
  );
}

function ArrowDownIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );
}
