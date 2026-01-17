'use client';

import { HTMLAttributes, ReactNode, forwardRef } from 'react';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface BottomNavProps extends HTMLAttributes<HTMLElement> {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
  onConnect: () => void;
  onDisconnect: () => void;
  onToggleSpeaking: () => void;
  onOpenSettings: () => void;
  onOpenChat: () => void;
  isConnecting?: boolean;
  agentJoined?: boolean;
}

interface NavItemProps {
  icon: ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
  disabled?: boolean;
  variant?: 'default' | 'primary' | 'success' | 'danger';
}

const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  ({ icon, label, onClick, active = false, disabled = false, variant = 'default' }, ref) => {
    const variantStyles = {
      default: active ? 'text-primary-400' : 'text-neutral-400',
      primary: 'text-primary-400',
      success: 'text-success-400',
      danger: 'text-error-400',
    };

    const bgStyles = active ? 'bg-neutral-700/50' : 'bg-transparent';

    return (
      <button
        ref={ref}
        onClick={onClick}
        disabled={disabled}
        className={`
          flex flex-col items-center justify-center
          px-3 py-2 rounded-xl min-w-[60px]
          transition-all duration-200
          focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500
          disabled:opacity-40 disabled:cursor-not-allowed
          ${variantStyles[variant]}
          ${bgStyles}
        `}
        aria-label={label}
      >
        <span className="mb-0.5">{icon}</span>
        <span className="text-[10px] font-medium">{label}</span>
      </button>
    );
  }
);

NavItem.displayName = 'NavItem';

export function BottomNav({
  connectionStatus,
  isSpeaking,
  onConnect,
  onDisconnect,
  onToggleSpeaking,
  onOpenSettings,
  onOpenChat,
  isConnecting = false,
  agentJoined = false,
  className = '',
  ...props
}: BottomNavProps) {
  const isConnected = connectionStatus === 'connected';
  const canSpeak = isConnected && agentJoined;

  return (
    <nav
      className={`
        lg:hidden fixed bottom-0 left-0 right-0 z-40
        bg-neutral-900/95 backdrop-blur-md
        border-t border-neutral-700/50
        px-2 py-2 pb-safe
        ${className}
      `}
      aria-label="Mobile navigation"
      {...props}
    >
      <div className="flex items-center justify-around max-w-md mx-auto">
        {/* Connect/Live */}
        {!isConnected ? (
          <NavItem
            icon={<BoltIcon className="w-6 h-6" />}
            label="Connect"
            onClick={onConnect}
            disabled={isConnecting}
            variant="primary"
          />
        ) : (
          <NavItem
            icon={<DisconnectIcon className="w-6 h-6" />}
            label="End"
            onClick={onDisconnect}
            variant="danger"
          />
        )}

        {/* Chat */}
        <NavItem
          icon={<ChatIcon className="w-6 h-6" />}
          label="Chat"
          onClick={onOpenChat}
          disabled={!isConnected}
        />

        {/* Speak - Center prominent button */}
        <div className="relative -mt-6">
          <button
            onClick={onToggleSpeaking}
            disabled={!canSpeak}
            className={`
              w-16 h-16 rounded-full
              flex items-center justify-center
              shadow-lg transition-all duration-200
              focus:outline-none focus-visible:ring-4 focus-visible:ring-primary-500/50
              disabled:opacity-40 disabled:cursor-not-allowed
              ${isSpeaking
                ? 'bg-gradient-to-br from-error-500 to-error-600 text-white shadow-error-500/30'
                : canSpeak
                  ? 'bg-gradient-to-br from-primary-500 to-primary-600 text-white shadow-primary-500/30'
                  : 'bg-neutral-700 text-neutral-400'
              }
            `}
            aria-label={isSpeaking ? 'Stop speaking' : 'Start speaking'}
          >
            <MicIcon className="w-7 h-7" />
          </button>
          {isSpeaking && (
            <span className="absolute -top-1 -right-1 w-4 h-4 bg-success-500 rounded-full animate-pulse" />
          )}
        </div>

        {/* Transcript (placeholder) */}
        <NavItem
          icon={<TranscriptIcon className="w-6 h-6" />}
          label="Transcript"
          disabled={!isConnected}
        />

        {/* Settings */}
        <NavItem
          icon={<SettingsIcon className="w-6 h-6" />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </div>
    </nav>
  );
}

// Icons
function BoltIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}

function MicIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function ChatIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
    </svg>
  );
}

function TranscriptIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  );
}

function SettingsIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function DisconnectIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" />
    </svg>
  );
}
