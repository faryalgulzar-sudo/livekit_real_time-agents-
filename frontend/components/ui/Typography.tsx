'use client';

import { ReactNode, HTMLAttributes, forwardRef } from 'react';

// Heading Component
type HeadingLevel = 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';

interface HeadingProps extends HTMLAttributes<HTMLHeadingElement> {
  as?: HeadingLevel;
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl';
  weight?: 'normal' | 'medium' | 'semibold' | 'bold';
  color?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';
}

const headingSizeClasses = {
  xs: 'text-sm',
  sm: 'text-base',
  md: 'text-lg',
  lg: 'text-xl',
  xl: 'text-2xl',
  '2xl': 'text-3xl',
  '3xl': 'text-4xl',
};

const weightClasses = {
  normal: 'font-normal',
  medium: 'font-medium',
  semibold: 'font-semibold',
  bold: 'font-bold',
};

const colorClasses = {
  default: 'text-neutral-100',
  muted: 'text-neutral-400',
  primary: 'text-primary-400',
  success: 'text-success-500',
  warning: 'text-warning-500',
  error: 'text-error-500',
};

export const Heading = forwardRef<HTMLHeadingElement, HeadingProps>(
  ({
    as: Component = 'h2',
    children,
    size = 'lg',
    weight = 'semibold',
    color = 'default',
    className = '',
    ...props
  }, ref) => (
    <Component
      ref={ref}
      className={`
        ${headingSizeClasses[size]}
        ${weightClasses[weight]}
        ${colorClasses[color]}
        leading-tight tracking-tight
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  )
);

Heading.displayName = 'Heading';

// Text Component
interface TextProps extends HTMLAttributes<HTMLParagraphElement> {
  as?: 'p' | 'span' | 'div';
  children: ReactNode;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  weight?: 'normal' | 'medium' | 'semibold';
  color?: 'default' | 'muted' | 'primary' | 'success' | 'warning' | 'error';
  leading?: 'tight' | 'normal' | 'relaxed';
}

const textSizeClasses = {
  xs: 'text-xs',
  sm: 'text-sm',
  md: 'text-base',
  lg: 'text-lg',
};

const leadingClasses = {
  tight: 'leading-tight',
  normal: 'leading-normal',
  relaxed: 'leading-relaxed',
};

export const Text = forwardRef<HTMLParagraphElement, TextProps>(
  ({
    as: Component = 'p',
    children,
    size = 'md',
    weight = 'normal',
    color = 'default',
    leading = 'normal',
    className = '',
    ...props
  }, ref) => (
    <Component
      ref={ref as any}
      className={`
        ${textSizeClasses[size]}
        ${weightClasses[weight]}
        ${color === 'default' ? 'text-neutral-300' : colorClasses[color]}
        ${leadingClasses[leading]}
        ${className}
      `}
      {...props}
    >
      {children}
    </Component>
  )
);

Text.displayName = 'Text';

// Label Component
interface LabelProps extends HTMLAttributes<HTMLLabelElement> {
  children: ReactNode;
  htmlFor?: string;
  required?: boolean;
  size?: 'sm' | 'md';
}

export const Label = forwardRef<HTMLLabelElement, LabelProps>(
  ({
    children,
    htmlFor,
    required = false,
    size = 'md',
    className = '',
    ...props
  }, ref) => (
    <label
      ref={ref}
      htmlFor={htmlFor}
      className={`
        block font-medium text-neutral-200
        ${size === 'sm' ? 'text-xs' : 'text-sm'}
        ${className}
      `}
      {...props}
    >
      {children}
      {required && (
        <span className="text-error-500 ml-1" aria-hidden="true">*</span>
      )}
    </label>
  )
);

Label.displayName = 'Label';

// Caption/Helper Text Component
interface CaptionProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'default' | 'error' | 'success';
}

export const Caption = forwardRef<HTMLSpanElement, CaptionProps>(
  ({ children, variant = 'default', className = '', ...props }, ref) => {
    const variantClasses = {
      default: 'text-neutral-500',
      error: 'text-error-500',
      success: 'text-success-500',
    };

    return (
      <span
        ref={ref}
        className={`text-xs ${variantClasses[variant]} ${className}`}
        {...props}
      >
        {children}
      </span>
    );
  }
);

Caption.displayName = 'Caption';

// Badge/Tag Component
interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error';
  size?: 'sm' | 'md';
}

const badgeVariantClasses = {
  default: 'bg-neutral-700 text-neutral-200',
  primary: 'bg-primary-500/20 text-primary-400 border border-primary-500/30',
  success: 'bg-success-500/20 text-success-500 border border-success-500/30',
  warning: 'bg-warning-500/20 text-warning-500 border border-warning-500/30',
  error: 'bg-error-500/20 text-error-500 border border-error-500/30',
};

const badgeSizeClasses = {
  sm: 'px-1.5 py-0.5 text-xs',
  md: 'px-2 py-1 text-xs',
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  ({
    children,
    variant = 'default',
    size = 'md',
    className = '',
    ...props
  }, ref) => (
    <span
      ref={ref}
      className={`
        inline-flex items-center
        font-medium rounded-full
        ${badgeVariantClasses[variant]}
        ${badgeSizeClasses[size]}
        ${className}
      `}
      {...props}
    >
      {children}
    </span>
  )
);

Badge.displayName = 'Badge';

// Visually Hidden - for screen reader only text
interface VisuallyHiddenProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
}

export const VisuallyHidden = forwardRef<HTMLSpanElement, VisuallyHiddenProps>(
  ({ children, ...props }, ref) => (
    <span
      ref={ref}
      className="sr-only"
      {...props}
    >
      {children}
    </span>
  )
);

VisuallyHidden.displayName = 'VisuallyHidden';
