'use client';

import { HTMLAttributes, forwardRef } from 'react';

type Status = 'disconnected' | 'connecting' | 'connected';

interface ConnectionStatusProps extends HTMLAttributes<HTMLDivElement> {
  status: Status;
  showLabel?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const statusConfig = {
  disconnected: {
    label: 'Offline',
    dotClass: 'bg-neutral-500',
    textClass: 'text-neutral-400',
    ringClass: '',
  },
  connecting: {
    label: 'Connecting...',
    dotClass: 'bg-warning-500 animate-pulse',
    textClass: 'text-warning-500',
    ringClass: 'ring-2 ring-warning-500/30',
  },
  connected: {
    label: 'Connected',
    dotClass: 'bg-success-500',
    textClass: 'text-success-500',
    ringClass: '',
  },
};

const sizeConfig = {
  sm: {
    dot: 'w-1.5 h-1.5',
    text: 'text-xs',
    gap: 'gap-1.5',
    padding: 'px-2 py-1',
  },
  md: {
    dot: 'w-2 h-2',
    text: 'text-sm',
    gap: 'gap-2',
    padding: 'px-3 py-1.5',
  },
  lg: {
    dot: 'w-2.5 h-2.5',
    text: 'text-base',
    gap: 'gap-2.5',
    padding: 'px-4 py-2',
  },
};

export const ConnectionStatus = forwardRef<HTMLDivElement, ConnectionStatusProps>(
  ({ status, showLabel = true, size = 'md', className = '', ...props }, ref) => {
    const config = statusConfig[status];
    const sizeStyles = sizeConfig[size];

    return (
      <div
        ref={ref}
        role="status"
        aria-live="polite"
        aria-label={`Connection status: ${config.label}`}
        className={`
          inline-flex items-center ${sizeStyles.gap}
          bg-neutral-800/80 backdrop-blur-sm
          rounded-full ${sizeStyles.padding}
          border border-neutral-700/50
          ${className}
        `}
        {...props}
      >
        <span
          className={`
            ${sizeStyles.dot} rounded-full
            ${config.dotClass} ${config.ringClass}
          `}
          aria-hidden="true"
        />

        {showLabel && (
          <span className={`${sizeStyles.text} font-medium ${config.textClass}`}>
            {config.label}
          </span>
        )}

        {status === 'connected' && (
          <CheckIcon className={`${sizeStyles.dot} text-success-500`} />
        )}
      </div>
    );
  }
);

ConnectionStatus.displayName = 'ConnectionStatus';

// Check Icon
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
    </svg>
  );
}

// Simple dot indicator for inline use
interface StatusDotProps extends HTMLAttributes<HTMLSpanElement> {
  status: Status;
  size?: 'sm' | 'md' | 'lg';
}

export const StatusDot = forwardRef<HTMLSpanElement, StatusDotProps>(
  ({ status, size = 'md', className = '', ...props }, ref) => {
    const config = statusConfig[status];
    const sizeStyles = sizeConfig[size];

    return (
      <span
        ref={ref}
        className={`
          inline-block rounded-full
          ${sizeStyles.dot}
          ${config.dotClass}
          ${className}
        `}
        aria-hidden="true"
        {...props}
      />
    );
  }
);

StatusDot.displayName = 'StatusDot';
