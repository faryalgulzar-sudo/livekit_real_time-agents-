'use client';

import { forwardRef, HTMLAttributes } from 'react';
import { Card, CardHeader, CardTitle, CardContent, Text, Badge } from '@/components/ui';
import { IntakeField } from '@/hooks/usePatientData';

interface IntakeProgressProps extends HTMLAttributes<HTMLDivElement> {
  progress: number;
  fields: IntakeField[];
  onFieldClick?: (field: IntakeField) => void;
}

const categoryConfig = {
  personal: { label: 'Personal Info', icon: '👤' },
  medical: { label: 'Medical History', icon: '🏥' },
  insurance: { label: 'Insurance', icon: '📋' },
  appointment: { label: 'Appointment', icon: '📅' },
};

export const IntakeProgress = forwardRef<HTMLDivElement, IntakeProgressProps>(
  ({ progress, fields, onFieldClick, className = '', ...props }, ref) => {
    // Group fields by category
    const groupedFields = fields.reduce((acc, field) => {
      if (!acc[field.category]) {
        acc[field.category] = [];
      }
      acc[field.category].push(field);
      return acc;
    }, {} as Record<string, IntakeField[]>);

    const categories = Object.entries(groupedFields).map(([category, categoryFields]) => {
      const completed = categoryFields.filter(f => f.completed).length;
      const total = categoryFields.length;
      const categoryProgress = Math.round((completed / total) * 100);
      return {
        category: category as keyof typeof categoryConfig,
        fields: categoryFields,
        completed,
        total,
        progress: categoryProgress,
      };
    });

    return (
      <Card ref={ref} className={className} {...props}>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Intake Progress</CardTitle>
            <Badge
              variant={progress === 100 ? 'success' : progress >= 50 ? 'warning' : 'default'}
            >
              {progress}% Complete
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          {/* Overall Progress Bar */}
          <div className="mb-6">
            <div className="h-2 bg-neutral-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-primary-500 to-accent-500 transition-all duration-500"
                style={{ width: `${progress}%` }}
                role="progressbar"
                aria-valuenow={progress}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`Intake progress: ${progress}%`}
              />
            </div>
          </div>

          {/* Category Sections */}
          <div className="space-y-4">
            {categories.map(({ category, fields: categoryFields, completed, total, progress: catProgress }) => {
              const config = categoryConfig[category];
              return (
                <div key={category} className="space-y-2">
                  {/* Category Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm">{config.icon}</span>
                      <Text weight="medium" size="sm">{config.label}</Text>
                    </div>
                    <Text size="xs" color="muted">
                      {completed}/{total}
                    </Text>
                  </div>

                  {/* Category Progress */}
                  <div className="h-1 bg-neutral-700 rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all duration-300 ${
                        catProgress === 100 ? 'bg-success-500' : 'bg-primary-500'
                      }`}
                      style={{ width: `${catProgress}%` }}
                    />
                  </div>

                  {/* Fields List */}
                  <div className="grid grid-cols-2 gap-1 pl-6">
                    {categoryFields.map((field) => (
                      <button
                        key={field.id}
                        onClick={() => onFieldClick?.(field)}
                        className={`
                          flex items-center gap-1.5 text-left py-0.5 px-1 rounded
                          transition-colors hover:bg-neutral-700/30
                          ${field.completed ? 'text-neutral-400' : 'text-neutral-200'}
                        `}
                        disabled={field.completed}
                      >
                        <span className={`w-3 h-3 flex-shrink-0 ${field.completed ? 'text-success-500' : 'text-neutral-500'}`}>
                          {field.completed ? <CheckIcon /> : <CircleIcon />}
                        </span>
                        <Text size="xs" className={field.completed ? 'line-through' : ''}>
                          {field.label}
                          {field.required && !field.completed && (
                            <span className="text-error-500 ml-0.5">*</span>
                          )}
                        </Text>
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }
);

IntakeProgress.displayName = 'IntakeProgress';

// Icons
function CheckIcon() {
  return (
    <svg fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
    </svg>
  );
}

function CircleIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="6" strokeWidth="2" />
    </svg>
  );
}
