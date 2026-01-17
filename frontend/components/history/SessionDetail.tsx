'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Text, Badge, ActionButton } from '@/components/ui';
import { Session, SessionTranscript } from '@/hooks/useSessionHistory';

interface SessionDetailProps extends HTMLAttributes<HTMLDivElement> {
  session: Session;
  onClose?: () => void;
  onExport?: (session: Session) => void;
}

const statusConfig = {
  completed: { label: 'Completed', variant: 'success' as const },
  in_progress: { label: 'In Progress', variant: 'warning' as const },
  cancelled: { label: 'Cancelled', variant: 'error' as const },
};

export const SessionDetail = forwardRef<HTMLDivElement, SessionDetailProps>(
  ({ session, onClose, onExport, className = '', ...props }, ref) => {
    const statusInfo = statusConfig[session.status];

    const formatDuration = (seconds: number): string => {
      const mins = Math.floor(seconds / 60);
      const secs = seconds % 60;
      return `${mins} min ${secs} sec`;
    };

    const formatDateTime = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    };

    return (
      <div ref={ref} className={`flex flex-col h-full ${className}`} {...props}>
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-neutral-700/50">
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-1 rounded-lg hover:bg-neutral-700/50 transition-colors"
              aria-label="Go back"
            >
              <ArrowLeftIcon className="w-5 h-5 text-neutral-400" />
            </button>
            <div>
              <Text weight="semibold" size="lg">
                {session.patientName || 'Unknown Patient'}
              </Text>
              <Text size="sm" color="muted">
                Session Details
              </Text>
            </div>
          </div>
          <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-2 gap-3 py-4">
          <InfoCard icon={<ClockIcon />} label="Duration" value={formatDuration(session.duration)} />
          <InfoCard icon={<CalendarIcon />} label="Date" value={formatDateTime(session.startTime)} />
          <InfoCard icon={<PhoneIcon />} label="Phone" value={session.patientPhone || 'Not provided'} />
          <InfoCard
            icon={session.appointmentBooked ? <CheckCircleIcon className="text-success-500" /> : <XCircleIcon className="text-neutral-500" />}
            label="Appointment"
            value={session.appointmentBooked ? 'Booked' : 'Not booked'}
          />
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex items-center justify-between py-3">
            <Text weight="medium">Transcript</Text>
            <Text size="sm" color="muted">{session.transcriptCount} messages</Text>
          </div>

          <div className="flex-1 overflow-y-auto space-y-3 pr-2" role="log" aria-label="Session transcript">
            {session.transcripts && session.transcripts.length > 0 ? (
              session.transcripts.map((transcript) => (
                <TranscriptItem key={transcript.id} transcript={transcript} />
              ))
            ) : (
              <div className="flex items-center justify-center h-32 text-neutral-500">
                <Text color="muted">No transcript available</Text>
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="pt-4 border-t border-neutral-700/50 flex gap-2">
          <ActionButton
            variant="outline"
            className="flex-1"
            onClick={() => onExport?.(session)}
          >
            <DownloadIcon className="w-4 h-4 mr-2" />
            Export
          </ActionButton>
          <ActionButton
            variant="primary"
            className="flex-1"
            onClick={onClose}
          >
            Close
          </ActionButton>
        </div>
      </div>
    );
  }
);

SessionDetail.displayName = 'SessionDetail';

// Info Card Component
function InfoCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <Card variant="default" className="p-3">
      <div className="flex items-start gap-2">
        <div className="text-neutral-500">{icon}</div>
        <div>
          <Text size="xs" color="muted">{label}</Text>
          <Text size="sm" weight="medium" className="truncate">{value}</Text>
        </div>
      </div>
    </Card>
  );
}

// Transcript Item Component
function TranscriptItem({ transcript }: { transcript: SessionTranscript }) {
  const isAgent = transcript.speaker === 'agent';

  return (
    <div className={`flex ${isAgent ? 'justify-start' : 'justify-end'}`}>
      <div
        className={`
          max-w-[80%] px-3 py-2 rounded-xl
          ${isAgent
            ? 'bg-neutral-700/50 rounded-bl-md'
            : 'bg-primary-500/20 border border-primary-500/30 rounded-br-md'
          }
        `}
      >
        <Text size="xs" color="muted" className="mb-0.5">
          {isAgent ? 'Agent' : 'Patient'}
        </Text>
        <Text size="sm">{transcript.text}</Text>
        <Text size="xs" color="muted" className="mt-1">
          {transcript.timestamp.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </div>
    </div>
  );
}

// Icons
function ArrowLeftIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
    </svg>
  );
}

function ClockIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}

function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function CheckCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function XCircleIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={`w-4 h-4 ${className}`} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  );
}

function DownloadIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
    </svg>
  );
}
