'use client';

import { Drawer, Card, CardContent, Text, ActionButton, Badge } from '@/components/ui';
import { IntakeProgress } from './IntakeProgress';
import { AppointmentCard } from './AppointmentCard';
import { usePatientData, ActionItem } from '@/hooks/usePatientData';

interface PatientDashboardProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId?: string;
}

export function PatientDashboard({ isOpen, onClose, sessionId }: PatientDashboardProps) {
  const { patientData, isLoading, error, refreshData, completeActionItem } = usePatientData({
    sessionId,
  });

  if (!isOpen) return null;

  return (
    <Drawer
      isOpen={isOpen}
      onClose={onClose}
      title="Patient Dashboard"
      size="lg"
    >
        <div className="flex flex-col h-[calc(100vh-8rem)] -mx-4 overflow-y-auto">
          {isLoading ? (
            <LoadingState />
          ) : error ? (
            <ErrorState message={error} onRetry={refreshData} />
          ) : patientData ? (
            <div className="px-4 space-y-6 pb-6">
              {/* Patient Info Header */}
              <PatientHeader
                name={patientData.name}
                email={patientData.email}
                phone={patientData.phone}
                lastVisit={patientData.lastVisit}
              />

              {/* Intake Progress */}
              <IntakeProgress
                progress={patientData.intakeProgress}
                fields={patientData.intakeFields}
              />

              {/* Upcoming Appointments */}
              <div className="space-y-3">
                <Text weight="semibold">Upcoming Appointments</Text>
                {patientData.appointments.length > 0 ? (
                  patientData.appointments.map((apt) => (
                    <AppointmentCard
                      key={apt.id}
                      appointment={apt}
                      onReschedule={() => {/* TODO: Implement reschedule */}}
                      onCancel={() => {/* TODO: Implement cancel */}}
                    />
                  ))
                ) : (
                  <Card variant="default">
                    <CardContent className="py-8 text-center">
                      <CalendarIcon className="w-10 h-10 text-neutral-600 mx-auto mb-3" />
                      <Text color="muted">No upcoming appointments</Text>
                    </CardContent>
                  </Card>
                )}
              </div>

              {/* Action Items */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Text weight="semibold">Action Items</Text>
                  <Badge variant="default">
                    {patientData.actionItems.filter(i => !i.completed).length} remaining
                  </Badge>
                </div>
                <div className="space-y-2">
                  {patientData.actionItems.map((item) => (
                    <ActionItemRow
                      key={item.id}
                      item={item}
                      onComplete={() => completeActionItem(item.id)}
                    />
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <EmptyState />
          )}
        </div>
      </Drawer>
  );
}

// Patient Header Component
function PatientHeader({
  name,
  email,
  phone,
  lastVisit,
}: {
  name: string;
  email?: string;
  phone?: string;
  lastVisit?: Date;
}) {
  return (
    <Card variant="elevated" className="bg-gradient-to-r from-primary-500/10 to-accent-500/10">
      <CardContent className="py-5">
        <div className="flex items-center gap-4">
          {/* Avatar */}
          <div className="w-14 h-14 rounded-full bg-primary-500/20 flex items-center justify-center">
            <span className="text-2xl">👤</span>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <Text weight="semibold" size="lg" className="truncate">{name}</Text>
            <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1">
              {phone && (
                <div className="flex items-center gap-1">
                  <PhoneIcon className="w-3.5 h-3.5 text-neutral-500" />
                  <Text size="sm" color="muted">{phone}</Text>
                </div>
              )}
              {email && (
                <div className="flex items-center gap-1">
                  <EmailIcon className="w-3.5 h-3.5 text-neutral-500" />
                  <Text size="sm" color="muted" className="truncate">{email}</Text>
                </div>
              )}
            </div>
            {lastVisit && (
              <Text size="xs" color="muted" className="mt-2">
                Last visit: {lastVisit.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
              </Text>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Action Item Row
function ActionItemRow({
  item,
  onComplete,
}: {
  item: ActionItem;
  onComplete: () => void;
}) {
  const priorityColors = {
    low: 'bg-neutral-500',
    medium: 'bg-warning-500',
    high: 'bg-error-500',
  };

  return (
    <Card variant={item.completed ? 'default' : 'elevated'} className={item.completed ? 'opacity-60' : ''}>
      <CardContent className="py-3 px-4">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={onComplete}
            disabled={item.completed}
            className={`
              w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5 transition-colors
              ${item.completed
                ? 'bg-success-500 border-success-500'
                : 'border-neutral-500 hover:border-primary-500'
              }
            `}
            aria-label={item.completed ? 'Completed' : 'Mark as complete'}
          >
            {item.completed && <CheckIcon className="w-full h-full text-white p-0.5" />}
          </button>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Text
                weight="medium"
                size="sm"
                className={item.completed ? 'line-through' : ''}
              >
                {item.title}
              </Text>
              <span className={`w-2 h-2 rounded-full ${priorityColors[item.priority]}`} />
            </div>
            <Text size="xs" color="muted" className="mt-0.5">
              {item.description}
            </Text>
            {item.dueDate && !item.completed && (
              <Text size="xs" color="warning" className="mt-1">
                Due: {item.dueDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </Text>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// Loading State
function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center h-64">
      <div className="w-8 h-8 border-2 border-primary-500/30 border-t-primary-500 rounded-full animate-spin mb-4" />
      <Text color="muted">Loading patient data...</Text>
    </div>
  );
}

// Error State
function ErrorState({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
      <AlertIcon className="w-12 h-12 text-error-500 mb-4" />
      <Text color="error" className="mb-4">{message}</Text>
      <ActionButton variant="outline" onClick={onRetry}>
        Try Again
      </ActionButton>
    </div>
  );
}

// Empty State
function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center h-64 px-4 text-center">
      <UserIcon className="w-12 h-12 text-neutral-600 mb-4" />
      <Text weight="medium" color="muted" className="mb-2">
        No Patient Data
      </Text>
      <Text size="sm" color="muted">
        Patient information will appear here after the intake process begins.
      </Text>
    </div>
  );
}

// Icons
function PhoneIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
    </svg>
  );
}

function EmailIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
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

function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
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

function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}
