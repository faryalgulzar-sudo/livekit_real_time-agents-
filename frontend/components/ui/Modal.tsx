'use client';

import {
  Fragment,
  ReactNode,
  useEffect,
  useRef,
  KeyboardEvent,
  MouseEvent,
  HTMLAttributes,
  forwardRef
} from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  description?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  position?: 'center' | 'right' | 'bottom';
  showCloseButton?: boolean;
  closeOnOverlayClick?: boolean;
  closeOnEscape?: boolean;
}

const sizeClasses = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  full: 'max-w-full mx-4',
};

const positionClasses = {
  center: 'items-center justify-center',
  right: 'items-stretch justify-end',
  bottom: 'items-end justify-center',
};

const panelPositionClasses = {
  center: 'rounded-2xl m-4',
  right: 'rounded-l-2xl h-full',
  bottom: 'rounded-t-2xl w-full',
};

export function Modal({
  isOpen,
  onClose,
  children,
  title,
  description,
  size = 'md',
  position = 'center',
  showCloseButton = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
}: ModalProps) {
  const modalRef = useRef<HTMLDivElement>(null);
  const previousActiveElement = useRef<HTMLElement | null>(null);

  // Handle escape key
  useEffect(() => {
    if (!isOpen || !closeOnEscape) return;

    const handleKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, closeOnEscape, onClose]);

  // Focus management
  useEffect(() => {
    if (isOpen) {
      previousActiveElement.current = document.activeElement as HTMLElement;

      // Focus the modal after animation
      setTimeout(() => {
        modalRef.current?.focus();
      }, 50);

      // Prevent body scroll
      document.body.style.overflow = 'hidden';
    } else {
      // Restore focus
      previousActiveElement.current?.focus();
      document.body.style.overflow = '';
    }

    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  // Focus trap
  const handleKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab') return;

    const focusableElements = modalRef.current?.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );

    if (!focusableElements || focusableElements.length === 0) return;

    const firstElement = focusableElements[0] as HTMLElement;
    const lastElement = focusableElements[focusableElements.length - 1] as HTMLElement;

    if (e.shiftKey && document.activeElement === firstElement) {
      e.preventDefault();
      lastElement.focus();
    } else if (!e.shiftKey && document.activeElement === lastElement) {
      e.preventDefault();
      firstElement.focus();
    }
  };

  const handleOverlayClick = (e: MouseEvent<HTMLDivElement>) => {
    if (closeOnOverlayClick && e.target === e.currentTarget) {
      onClose();
    }
  };

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={`
        fixed inset-0 z-50 flex
        ${positionClasses[position]}
      `}
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? 'modal-title' : undefined}
      aria-describedby={description ? 'modal-description' : undefined}
    >
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-fadeIn"
        onClick={handleOverlayClick}
        aria-hidden="true"
      />

      {/* Modal Panel */}
      <div
        ref={modalRef}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
        className={`
          relative z-10
          bg-neutral-800 border border-neutral-700
          shadow-2xl
          w-full ${sizeClasses[size]}
          ${panelPositionClasses[position]}
          animate-scaleIn
          focus:outline-none
        `}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-center justify-between p-4 border-b border-neutral-700">
            <div>
              {title && (
                <h2 id="modal-title" className="text-lg font-semibold text-neutral-100">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="mt-1 text-sm text-neutral-400">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                onClick={onClose}
                className="
                  p-2 rounded-lg
                  text-neutral-400 hover:text-neutral-100
                  hover:bg-neutral-700
                  transition-colors
                  focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
                "
                aria-label="Close modal"
              >
                <CloseIcon className="w-5 h-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="p-4 overflow-y-auto max-h-[calc(100vh-12rem)]">
          {children}
        </div>
      </div>
    </div>
  );

  // Use portal to render modal at document root
  if (typeof window === 'undefined') return null;

  return createPortal(modalContent, document.body);
}

// Close Icon
function CloseIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

// Drawer variant - slides from right
interface DrawerProps extends Omit<ModalProps, 'position'> {
  side?: 'left' | 'right';
}

export function Drawer({ side = 'right', ...props }: DrawerProps) {
  return <Modal {...props} position="right" />;
}

// BottomSheet variant - slides from bottom
export function BottomSheet(props: Omit<ModalProps, 'position'>) {
  return <Modal {...props} position="bottom" />;
}

// Modal Footer component for consistent action layouts
interface ModalFooterProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export const ModalFooter = forwardRef<HTMLDivElement, ModalFooterProps>(
  ({ children, className = '', ...props }, ref) => (
    <div
      ref={ref}
      className={`
        flex items-center justify-end gap-3
        pt-4 mt-4 border-t border-neutral-700
        ${className}
      `}
      {...props}
    >
      {children}
    </div>
  )
);

ModalFooter.displayName = 'ModalFooter';
