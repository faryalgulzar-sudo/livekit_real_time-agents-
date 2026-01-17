'use client';

import { ReactNode, useState } from 'react';
import { Sidebar } from './Sidebar';
import { BottomNav } from './BottomNav';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

interface MainLayoutProps {
  children: ReactNode;
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

export function MainLayout({
  children,
  connectionStatus,
  isSpeaking,
  onConnect,
  onDisconnect,
  onToggleSpeaking,
  onOpenSettings,
  onOpenChat,
  isConnecting = false,
  agentJoined = false,
}: MainLayoutProps) {
  return (
    <div className="min-h-screen bg-neutral-900 text-neutral-100 flex">
      {/* Desktop Sidebar */}
      <Sidebar
        connectionStatus={connectionStatus}
        isSpeaking={isSpeaking}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleSpeaking={onToggleSpeaking}
        onOpenSettings={onOpenSettings}
        onOpenChat={onOpenChat}
        isConnecting={isConnecting}
        agentJoined={agentJoined}
      />

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-h-screen pb-20 lg:pb-0">
        {children}
      </main>

      {/* Mobile Bottom Navigation */}
      <BottomNav
        connectionStatus={connectionStatus}
        isSpeaking={isSpeaking}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        onToggleSpeaking={onToggleSpeaking}
        onOpenSettings={onOpenSettings}
        onOpenChat={onOpenChat}
        isConnecting={isConnecting}
        agentJoined={agentJoined}
      />
    </div>
  );
}
