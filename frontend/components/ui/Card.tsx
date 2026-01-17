'use client';

import { ReactNode, HTMLAttributes, forwardRef } from 'react';

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'none' | 'sm' | 'md' | 'lg';
  hover?: boolean;
}

const paddingClasses = {
  none: '',
  sm: 'p-3',
  md: 'p-4 sm:p-5',
  lg: 'p-5 sm:p-6',
};

const variantClasses = {
  default: 'bg-neutral-800/50 backdrop-blur-sm border border-neutral-700/50',
  elevated: 'bg-neutral-800 shadow-lg border border-neutral-700/30',
  outlined: 'bg-transparent border-2 border-neutral-600',
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({
    children,
    variant = 'default',
    padding = 'md',
    hover = false,
    className = '',
    ...props
  }, ref) => {
    const hoverStyles = hover
      ? 'transition-all duration-200 hover:bg-neutral-700/50 hover:border-neutral-600 hover:shadow-md cursor-pointer'
      : '';

    return (
      <div
        ref={ref}
        className={`
          rounded-2xl
          ${variantClasses[variant]}
          ${paddingClasses[padding]}
          ${hoverStyles}
          ${className}
        `}
        {...props}
      >
        {children}
      </div>
    );
  }
);

Card.displayName = 'Card';

// Card Header Component
interface CardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`mb-4 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardHeader.displayName = 'CardHeader';

// Card Title Component
interface CardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
  as?: 'h1' | 'h2' | 'h3' | 'h4';
}

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(
  ({ children, as: Component = 'h2', className = '', ...props }, ref) => (
    <Component
      ref={ref}
      className={`text-lg font-semibold text-neutral-100 ${className}`}
      {...props}
    >
      {children}
    </Component>
  )
);

CardTitle.displayName = 'CardTitle';

// Card Content Component
interface CardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`text-neutral-300 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardContent.displayName = 'CardContent';

// Card Footer Component
interface CardFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const CardFooter = forwardRef<HTMLDivElement, CardFooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`mt-4 pt-4 border-t border-neutral-700/50 ${className}`}
      {...props}
    >
      {children}
    </div>
  )
);

CardFooter.displayName = 'CardFooter';
