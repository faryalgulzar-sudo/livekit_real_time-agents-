'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Card, CardContent, Text, Badge } from '@/components/ui';
import { Session } from '@/hooks/useSessionHistory';

interface SessionCardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onSelect'> {
  session: Session;
  isSelected?: boolean;
  onSelect?: (session: Session) => void;
}

const statusConfig = {
  completed: {
    label: 'Completed',
    variant: 'success' as const,
  },
  in_progress: {
    label: 'In Progress',
    variant: 'warning' as const,
  },
  cancelled: {
    label: 'Cancelled',
    variant: 'error' as const,
  },
};

export const SessionCard = forwardRef<HTMLDivElement, SessionCardProps>(
  ({ session, isSelected = false, onSelect, className = '', ...props }, ref) => {
    const statusInfo = statusConfig[session.status];

    const formatDuration = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const formatDate = (date: Date): string => {
      const now = new Date();
      const diffDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));

      if (diffDays === 0) {
        return `Today at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays === 1) {
        return `Yesterday at ${date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;
      } else if (diffDays < 7) {
        return date.toLocaleDateString('en-US', { weekday: 'long', hour: '2-digit', minute: '2-digit' });
      } else {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      }
    };

    return (
      <Card
        ref={ref}
        variant={isSelected ? 'elevated' : 'default'}
        className={`
          cursor-pointer transition-all duration-200
          hover:border-primary-500/50 hover:bg-neutral-800/50
          ${isSelected ? 'ring-2 ring-primary-500 border-primary-500' : ''}
          ${className}
        `}
        onClick={() => onSelect?.(session)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect?.(session);
          }
        }}
        aria-selected={isSelected}
        {...props}
      >
        <CardContent className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              {/* Patient Name & Status */}
              <div className="flex items-center gap-2 mb-1">
                <Text weight="medium" className="truncate">
                  {session.patientName || 'Unknown Patient'}
                </Text>
                <Badge variant={statusInfo.variant} size="sm">
                  {statusInfo.label}
                </Badge>
              </div>

              {/* Date & Duration */}
              <Text size="sm" color="muted" className="mb-2">
                {formatDate(session.startTime)} • {formatDuration(session.duration)}
              </Text>

              {/* Details Row */}
              <div className="flex items-center gap-4">
                {session.patientPhone && (
                  <div className="flex items-center gap-1">
                    <PhoneIcon className="w-3.5 h-3.5 text-neutral-500" />
                    <Text size="xs" color="muted">{session.patientPhone}</Text>
                  </div>
                )}
                <div className="flex items-center gap-1">
                  <MessageIcon className="w-3.5 h-3.5 text-neutral-500" />
                  <Text size="xs" color="muted">{session.transcriptCount} messages</Text>
                </div>
                {session.appointmentBooked && (
                  <div className="flex items-center gap-1">
                    <CheckIcon className="w-3.5 h-3.5 text-success-500" />
                    <Text size="xs" color="success">Booked</Text>
                  </div>
                )}
              </div>
            </div>

            {/* Arrow Icon */}
            <ChevronRightIcon className="w-5 h-5 text-neutral-500 flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    );
  }
);

SessionCard.displayName = 'SessionCard';

// Icons
function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function MessageIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function ChevronRightIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
