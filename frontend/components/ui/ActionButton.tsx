'use client';

import { ButtonHTMLAttributes, forwardRef, ReactNode } from 'react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'ghost' | 'outline';
type ButtonSize = 'sm' | 'md' | 'lg' | 'icon';

interface ActionButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  fullWidth?: boolean;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: `
    bg-primary-500 hover:bg-primary-600 active:bg-primary-700
    text-white shadow-md hover:shadow-lg
    focus-visible:ring-primary-500
  `,
  secondary: `
    bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500
    text-neutral-100 shadow-sm hover:shadow-md
    focus-visible:ring-neutral-500
  `,
  success: `
    bg-success-500 hover:bg-success-600 active:bg-success-700
    text-white shadow-md hover:shadow-lg
    focus-visible:ring-success-500
  `,
  danger: `
    bg-error-500 hover:bg-error-600 active:bg-error-700
    text-white shadow-md hover:shadow-lg
    focus-visible:ring-error-500
  `,
  ghost: `
    bg-transparent hover:bg-neutral-700/50 active:bg-neutral-700
    text-neutral-300 hover:text-neutral-100
    focus-visible:ring-neutral-500
  `,
  outline: `
    bg-transparent border-2 border-neutral-600 hover:border-neutral-500
    text-neutral-300 hover:text-neutral-100 hover:bg-neutral-800/50
    focus-visible:ring-neutral-500
  `,
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm gap-1.5 rounded-lg',
  md: 'px-4 py-2.5 text-sm gap-2 rounded-xl',
  lg: 'px-6 py-3 text-base gap-2.5 rounded-xl',
  icon: 'p-2.5 rounded-xl',
};

export const ActionButton = forwardRef<HTMLButtonElement, ActionButtonProps>(
  ({
    children,
    variant = 'primary',
    size = 'md',
    loading = false,
    leftIcon,
    rightIcon,
    fullWidth = false,
    disabled,
    className = '',
    ...props
  }, ref) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={`
          inline-flex items-center justify-center
          font-medium
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900
          disabled:opacity-50 disabled:cursor-not-allowed disabled:pointer-events-none
          ${variantClasses[variant]}
          ${sizeClasses[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        aria-busy={loading}
        {...props}
      >
        {loading ? (
          <LoadingSpinner size={size} />
        ) : leftIcon ? (
          <span className="flex-shrink-0" aria-hidden="true">{leftIcon}</span>
        ) : null}

        {size !== 'icon' && (
          <span className={loading ? 'opacity-0' : ''}>
            {children}
          </span>
        )}

        {size === 'icon' && !loading && children}

        {rightIcon && !loading && (
          <span className="flex-shrink-0" aria-hidden="true">{rightIcon}</span>
        )}
      </button>
    );
  }
);

ActionButton.displayName = 'ActionButton';

// Loading Spinner Component
function LoadingSpinner({ size }: { size: ButtonSize }) {
  const sizeMap = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4 h-4',
    lg: 'w-5 h-5',
    icon: 'w-4 h-4',
  };

  return (
    <svg
      className={`animate-spin ${sizeMap[size]}`}
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

// Icon Button - Convenience wrapper for icon-only buttons
interface IconButtonProps extends Omit<ActionButtonProps, 'size' | 'leftIcon' | 'rightIcon'> {
  'aria-label': string;
}

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ children, ...props }, ref) => (
    <ActionButton ref={ref} size="icon" {...props}>
      {children}
    </ActionButton>
  )
);

IconButton.displayName = 'IconButton';
