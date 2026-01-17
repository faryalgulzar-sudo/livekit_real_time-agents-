'use client';

import { ReactNode, HTMLAttributes, forwardRef } from 'react';
import { StatusDot } from '../ui/ConnectionStatus';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface SidebarProps extends HTMLAttributes<HTMLElement> {
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
  variant?: 'default' | 'success' | 'danger' | 'warning';
}

const NavItem = forwardRef<HTMLButtonElement, NavItemProps>(
  ({ icon, label, onClick, active = false, disabled = false, variant = 'default' }, ref) => {
    const variantStyles = {
      default: 'bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300',
      success: 'bg-success-500/20 hover:bg-success-500/30 text-success-400 ring-1 ring-success-500/30',
      danger: 'bg-error-500/20 hover:bg-error-500/30 text-error-400 ring-1 ring-error-500/30',
      warning: 'bg-warning-500/20 hover:bg-warning-500/30 text-warning-400 ring-1 ring-warning-500/30',
    };

    const activeStyles = active
      ? 'ring-2 ring-primary-500 bg-primary-500/20 text-primary-300'
      : '';

    return (
      <div className="flex flex-col items-center gap-1">
        <button
          ref={ref}
          onClick={onClick}
          disabled={disabled}
          className={`
            w-12 h-12 rounded-xl
            flex items-center justify-center
            transition-all duration-200
            focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900
            disabled:opacity-40 disabled:cursor-not-allowed
            ${disabled ? '' : variantStyles[variant]}
            ${activeStyles}
          `}
          aria-label={label}
        >
          {icon}
        </button>
        <span className="text-[10px] text-neutral-500 text-center leading-tight">
          {label}
        </span>
      </div>
    );
  }
);

NavItem.displayName = 'NavItem';

export function Sidebar({
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
}: SidebarProps) {
  const isConnected = connectionStatus === 'connected';
  const canSpeak = isConnected && agentJoined;

  return (
    <aside
      className={`
        hidden lg:flex flex-col
        w-20 bg-neutral-800/50 backdrop-blur-sm
        border-r border-neutral-700/50
        py-6 px-2
        ${className}
      `}
      aria-label="Main navigation"
      {...props}
    >
      {/* User Profile */}
      <div className="flex flex-col items-center mb-6">
        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary-500 to-primary-600 flex items-center justify-center shadow-lg">
          <UserIcon className="w-6 h-6 text-white" />
        </div>
        <span className="text-xs text-neutral-400 mt-2">Patient</span>
        <StatusDot status={connectionStatus} size="sm" className="mt-1" />
      </div>

      {/* Navigation Items */}
      <nav className="flex-1 flex flex-col items-center gap-4">
        {/* Connect/Live */}
        <NavItem
          icon={<BoltIcon className="w-6 h-6" />}
          label={isConnected ? 'Live' : 'Connect'}
          onClick={isConnected ? undefined : onConnect}
          active={isConnected}
          disabled={isConnecting || isConnected}
          variant={isConnected ? 'success' : 'default'}
        />

        {/* Speak Toggle */}
        <NavItem
          icon={<MicIcon className="w-6 h-6" />}
          label={isSpeaking ? 'Speaking' : 'Speak'}
          onClick={onToggleSpeaking}
          disabled={!canSpeak}
          active={isSpeaking}
          variant={isSpeaking ? 'success' : 'default'}
        />

        {/* Chat */}
        <NavItem
          icon={<ChatIcon className="w-6 h-6" />}
          label="Chat"
          onClick={onOpenChat}
          disabled={!isConnected}
        />

        {/* Settings */}
        <NavItem
          icon={<SettingsIcon className="w-6 h-6" />}
          label="Settings"
          onClick={onOpenSettings}
        />
      </nav>

      {/* Bottom Actions */}
      <div className="flex flex-col items-center gap-4 pt-4 border-t border-neutral-700/50">
        {/* Disconnect */}
        <NavItem
          icon={<DisconnectIcon className="w-6 h-6" />}
          label="End"
          onClick={onDisconnect}
          disabled={!isConnected}
          variant={isConnected ? 'danger' : 'default'}
        />
      </div>
    </aside>
  );
}

// Icons
function UserIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  );
}

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
