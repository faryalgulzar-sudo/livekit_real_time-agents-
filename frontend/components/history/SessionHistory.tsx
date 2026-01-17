'use client';

import { useState } from 'react';
import { Drawer, Text, ActionButton } from '@/components/ui';
import { SessionCard } from './SessionCard';
import { SessionDetail } from './SessionDetail';
import { useSessionHistory, Session } from '@/hooks/useSessionHistory';

interface SessionHistoryProps {
  isOpen: boolean;
  onClose: () => void;
}

export function SessionHistory({ isOpen, onClose }: SessionHistoryProps) {
    const {
      filteredSessions,
      isLoading,
      error,
      selectedSession,
      selectSession,
      clearSelection,
      loadSessionDetail,
      filterByStatus,
      refreshSessions,
    } = useSessionHistory();

    const [activeFilter, setActiveFilter] = useState<'all' | 'completed' | 'cancelled'>('all');
    const [isLoadingDetail, setIsLoadingDetail] = useState(false);

    const handleSelectSession = async (session: Session) => {
      setIsLoadingDetail(true);
      await loadSessionDetail(session.id);
      setIsLoadingDetail(false);
    };

    const handleFilterChange = (filter: 'all' | 'completed' | 'cancelled') => {
      setActiveFilter(filter);
      filterByStatus(filter);
    };

    const handleExport = (session: Session) => {
      // Export session as JSON
      const dataStr = JSON.stringify(session, null, 2);
      const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
      const exportName = `session-${session.id}-${new Date().toISOString().split('T')[0]}.json`;

      const linkElement = document.createElement('a');
      linkElement.setAttribute('href', dataUri);
      linkElement.setAttribute('download', exportName);
      linkElement.click();
    };

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Session History"
      size="lg"
    >
        <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4">
          {selectedSession ? (
            <div className="flex-1 overflow-hidden px-4">
              {isLoadingDetail ? (
                <LoadingState message="Loading session details..." />
              ) : (
                <SessionDetail
                  session={selectedSession}
                  onClose={clearSelection}
                  onExport={handleExport}
                />
              )}
            </div>
          ) : (
            <>
              {/* Filters */}
              <div className="flex items-center gap-2 px-4 pb-3 border-b border-neutral-700/50">
                <FilterButton
                  active={activeFilter === 'all'}
                  onClick={() => handleFilterChange('all')}
                >
                  All
                </FilterButton>
                <FilterButton
                  active={activeFilter === 'completed'}
                  onClick={() => handleFilterChange('completed')}
                >
                  Completed
                </FilterButton>
                <FilterButton
                  active={activeFilter === 'cancelled'}
                  onClick={() => handleFilterChange('cancelled')}
                >
                  Cancelled
                </FilterButton>
                <div className="flex-1" />
                <ActionButton
                  variant="ghost"
                  size="sm"
                  onClick={refreshSessions}
                  aria-label="Refresh sessions"
                >
                  <RefreshIcon className="w-4 h-4" />
                </ActionButton>
              </div>

              {/* Session List */}
              <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
                {isLoading ? (
                  <LoadingState message="Loading sessions..." />
                ) : error ? (
                  <ErrorState message={error} onRetry={refreshSessions} />
                ) : filteredSessions.length === 0 ? (
                  <EmptyState filter={activeFilter} />
                ) : (
                  filteredSessions.map((session) => (
                    <SessionCard
                      key={session.id}
                      session={session}
                      onSelect={handleSelectSession}
                    />
                  ))
                )}
              </div>
            </>
          )}
        </div>
    </Drawer>
  );
}

// Filter Button
function FilterButton({
  children,
  active,
  onClick,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        px-3 py-1.5 text-sm rounded-lg transition-colors
        ${active
          ? 'bg-primary-500/20 text-primary-400 border border-primary-500/30'
          : 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-700/50'
        }
      `}
    >
      {children}
    </button>
  );
}

// Loading State
function LoadingState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-4" />
      <Text color="muted">{message}</Text>
    </div>
  );
}

// Error State
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <AlertIcon className="w-12 h-12 text-error-500 mb-4" />
      <Text color="error" className="mb-4">{message}</Text>
      <ActionButton variant="outline" onClick={onRetry}>
        Try Again
      </ActionButton>
    </div>
  );
}

// Empty State
function EmptyState({ filter }: { filter: string }) {
  return (
    <div className="flex flex-col items-center justify-center h-48 text-center">
      <HistoryIcon className="w-12 h-12 text-neutral-600 mb-4" />
      <Text weight="medium" color="muted" className="mb-2">
        No Sessions Found
      </Text>
      <Text size="sm" color="muted">
        {filter === 'all'
          ? 'There are no sessions recorded yet.'
          : `No ${filter} sessions found.`}
      </Text>
    </div>
  );
}

// Icons
function RefreshIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
  );
}

function AlertIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
    </svg>
  );
}

function HistoryIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}
