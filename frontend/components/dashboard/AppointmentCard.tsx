'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Text, Badge, ActionButton } from '@/components/ui';
import { Appointment } from '@/hooks/usePatientData';

interface AppointmentCardProps extends HTMLAttributes<HTMLDivElement> {
  appointment: Appointment;
  onCancel?: (appointment: Appointment) => void;
  onReschedule?: (appointment: Appointment) => void;
}

const typeConfig = {
  checkup: { label: 'Checkup', icon: '🦷', color: 'primary' as const },
  cleaning: { label: 'Cleaning', icon: '✨', color: 'accent' as const },
  consultation: { label: 'Consultation', icon: '💬', color: 'info' as const },
  treatment: { label: 'Treatment', icon: '🏥', color: 'warning' as const },
  emergency: { label: 'Emergency', icon: '🚨', color: 'error' as const },
};

const statusConfig = {
  pending: { label: 'Pending', variant: 'warning' as const },
  confirmed: { label: 'Confirmed', variant: 'success' as const },
  cancelled: { label: 'Cancelled', variant: 'error' as const },
  completed: { label: 'Completed', variant: 'default' as const },
};

export const AppointmentCard = forwardRef<HTMLDivElement, AppointmentCardProps>(
  ({ appointment, onCancel, onReschedule, className = '', ...props }, ref) => {
    const typeInfo = typeConfig[appointment.type];
    const statusInfo = statusConfig[appointment.status];

    const formatDate = (date: Date): string => {
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      });
    };

    const getDaysUntil = (date: Date): string => {
      const now = new Date();
      const diffTime = date.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      if (diffDays < 0) return `${Math.abs(diffDays)} days ago`;
      if (diffDays <= 7) return `In ${diffDays} days`;
      return formatDate(date);
    };

    const isPast = appointment.date < new Date();
    const isUpcoming = !isPast && appointment.status !== 'cancelled';

    return (
      <Card
        ref={ref}
        variant={isUpcoming ? 'elevated' : 'default'}
        className={`${isUpcoming ? 'ring-1 ring-primary-500/30' : ''} ${className}`}
        {...props}
      >
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-xl">{typeInfo.icon}</span>
              <CardTitle>{typeInfo.label}</CardTitle>
            </div>
            <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Date & Time */}
          <div className="flex items-start gap-3 mb-4">
            <div className="w-12 h-12 bg-primary-500/10 rounded-xl flex flex-col items-center justify-center">
              <Text size="xs" color="muted" className="uppercase">
                {appointment.date.toLocaleDateString('en-US', { month: 'short' })}
              </Text>
              <Text weight="semibold" size="lg">
                {appointment.date.getDate()}
              </Text>
            </div>
            <div className="flex-1">
              <Text weight="medium">{getDaysUntil(appointment.date)}</Text>
              <Text size="sm" color="muted">{appointment.time}</Text>
            </div>
          </div>

          {/* Details */}
          <div className="space-y-2 mb-4">
            {appointment.dentist && (
              <div className="flex items-center gap-2">
                <DentistIcon className="w-4 h-4 text-neutral-500" />
                <Text size="sm" color="muted">{appointment.dentist}</Text>
              </div>
            )}
            {appointment.notes && (
              <div className="flex items-start gap-2">
                <NoteIcon className="w-4 h-4 text-neutral-500 mt-0.5" />
                <Text size="sm" color="muted">{appointment.notes}</Text>
              </div>
            )}
          </div>

          {/* Actions */}
          {isUpcoming && (onCancel || onReschedule) && (
            <div className="flex gap-2 pt-3 border-t border-neutral-700/50">
              {onReschedule && (
                <ActionButton
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => onReschedule(appointment)}
                >
                  <CalendarIcon className="w-4 h-4 mr-1.5" />
                  Reschedule
                </ActionButton>
              )}
              {onCancel && (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  className="text-error-500 hover:bg-error-500/10"
                  onClick={() => onCancel(appointment)}
                >
                  Cancel
                </ActionButton>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }
);

AppointmentCard.displayName = 'AppointmentCard';

// Icons
function DentistIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

function NoteIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
    </svg>
  );
}

function CalendarIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
