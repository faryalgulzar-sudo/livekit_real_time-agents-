'use client';

import { useState, useEffect, useMemo } from 'react';
import { useLiveKit } from '@/hooks/useLiveKit';
import { MainLayout } from '@/components/layout';
import { AgentAvatar, AudioVisualizer, AudioLevelIndicator } from '@/components/agent';
import { Card, CardHeader, CardTitle, CardContent, ConnectionStatus, VolumeControl, ActionButton, Heading, Text } from '@/components/ui';
import { ChatPanel, ChatMessageData } from '@/components/chat';
import { SettingsPanel } from '@/components/settings';
import { TranscriptPanel, TranscriptEntry } from '@/components/transcript';
import { SessionHistory } from '@/components/history';
import { PatientDashboard } from '@/components/dashboard';

export default function Home() {
  const {
    connectionStatus,
    isSpeaking,
    audioLevel,
    agentAudioLevel,
    chatMessages,
    sendChatMessage,
    connect,
    disconnect,
    toggleSpeaking,
    setVolume,
    error,
  } = useLiveKit();

  // UI State
  const [showChat, setShowChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showTranscript, setShowTranscript] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [showDashboard, setShowDashboard] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [volume, setVolumeState] = useState(80);
  const [agentJoined, setAgentJoined] = useState(false);
  const [isAgentTyping, setIsAgentTyping] = useState(false);

  // Transform chat messages to ChatMessageData format
  const formattedChatMessages: ChatMessageData[] = useMemo(() => {
    return chatMessages.map((msg) => ({
      id: msg.id,
      text: msg.text,
      sender: msg.sender as 'user' | 'agent',
      timestamp: msg.timestamp || new Date(),
      status: 'delivered' as const,
    }));
  }, [chatMessages]);

  // Transform chat messages to TranscriptEntry format
  const transcriptEntries: TranscriptEntry[] = useMemo(() => {
    return chatMessages.map((msg) => ({
      id: msg.id,
      speaker: msg.sender as 'user' | 'agent',
      text: msg.text,
      timestamp: msg.timestamp || new Date(),
      isFinal: true,
    }));
  }, [chatMessages]);

  // Detect agent joining
  useEffect(() => {
    if (connectionStatus === 'connected') {
      const timer = setTimeout(() => setAgentJoined(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setAgentJoined(false);
    }
  }, [connectionStatus]);

  // Simulate agent typing when receiving messages
  useEffect(() => {
    if (chatMessages.length > 0) {
      const lastMessage = chatMessages[chatMessages.length - 1];
      if (lastMessage.sender === 'agent') {
        setIsAgentTyping(false);
      }
    }
  }, [chatMessages]);

  // Handlers
  const handleConnect = async () => {
    setIsConnecting(true);
    try {
      await connect();
    } catch (err) {
      console.error('Connection failed:', err);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVolumeChange = (newVolume: number) => {
    setVolumeState(newVolume);
    setVolume(newVolume / 100);
  };

  const handleSendChat = (message: string) => {
    if (message.trim() && connectionStatus === 'connected') {
      sendChatMessage(message);
      // Simulate agent typing
      setIsAgentTyping(true);
      setTimeout(() => setIsAgentTyping(false), 3000);
    }
  };

  const handleClearChat = () => {
    // TODO: Implement clear chat functionality
    console.log('Clear chat requested');
  };

  const isConnected = connectionStatus === 'connected';

  return (
    <MainLayout
      connectionStatus={connectionStatus}
      isSpeaking={isSpeaking}
      onConnect={handleConnect}
      onDisconnect={disconnect}
      onToggleSpeaking={toggleSpeaking}
      onOpenSettings={() => setShowSettings(true)}
      onOpenChat={() => setShowChat(true)}
      isConnecting={isConnecting}
      agentJoined={agentJoined}
    >
      {/* Main Content Grid */}
      <div className="flex-1 flex flex-col lg:flex-row gap-6 p-4 lg:p-6">
        {/* Left Column - Status Cards */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Connection Status Card */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Connection</CardTitle>
                <ConnectionStatus status={connectionStatus} size="sm" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-3 mb-4">
                <div className={`
                  w-10 h-10 rounded-xl flex items-center justify-center
                  ${isConnected ? 'bg-success-500/20' : 'bg-neutral-700'}
                `}>
                  {connectionStatus === 'connecting' ? (
                    <div className="w-5 h-5 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
                  ) : isConnected ? (
                    <CheckIcon className="w-5 h-5 text-success-500" />
                  ) : (
                    <WifiIcon className="w-5 h-5 text-neutral-400" />
                  )}
                </div>
                <div>
                  <Text size="sm" color={isConnected ? 'success' : 'muted'}>
                    {connectionStatus === 'disconnected' ? 'Not Connected' :
                     connectionStatus === 'connecting' ? 'Connecting...' :
                     !agentJoined ? 'Waiting for Agent...' : 'Agent Ready'}
                  </Text>
                  {isConnected && !agentJoined && (
                    <Text size="xs" color="muted">Please wait...</Text>
                  )}
                </div>
              </div>

              {/* Connect/Speak Button */}
              <ActionButton
                variant={!isConnected ? 'primary' : isSpeaking ? 'danger' : 'success'}
                fullWidth
                onClick={!isConnected ? handleConnect : toggleSpeaking}
                disabled={isConnecting || (isConnected && !agentJoined)}
                loading={isConnecting}
              >
                {isConnecting ? 'Connecting...' :
                 !isConnected ? 'Connect' :
                 !agentJoined ? 'Waiting...' :
                 isSpeaking ? 'Stop Speaking' : 'Start Speaking'}
              </ActionButton>
            </CardContent>
          </Card>

          {/* Audio Level Card */}
          <Card>
            <CardHeader>
              <CardTitle>Audio Level</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 mb-4">
                <div className="flex-1">
                  <AudioVisualizer
                    audioLevel={audioLevel}
                    isActive={isSpeaking || audioLevel > 5}
                    variant="bars"
                    size="md"
                  />
                </div>
                <div className="text-right">
                  <Text size="lg" weight="semibold" color="default">
                    {Math.round(audioLevel)}%
                  </Text>
                  <Text size="xs" color="muted">Level</Text>
                </div>
              </div>

              {isConnected && (
                <div className="space-y-3">
                  <div>
                    <Text size="xs" color="muted" className="mb-1">Your Mic</Text>
                    <AudioLevelIndicator level={audioLevel} showPercentage />
                  </div>
                  <div>
                    <Text size="xs" color="muted" className="mb-1">Agent</Text>
                    <AudioLevelIndicator level={agentAudioLevel} showPercentage />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle>Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => setShowChat(true)}
                leftIcon={<ChatIcon className="w-4 h-4" />}
              >
                Open Chat
              </ActionButton>

              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => setShowTranscript(true)}
                leftIcon={<TranscriptIcon className="w-4 h-4" />}
              >
                View Transcript
              </ActionButton>

              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => setShowDashboard(true)}
                leftIcon={<DashboardIcon className="w-4 h-4" />}
              >
                Patient Dashboard
              </ActionButton>

              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => setShowHistory(true)}
                leftIcon={<HistoryIcon className="w-4 h-4" />}
              >
                Session History
              </ActionButton>

              <ActionButton
                variant="secondary"
                fullWidth
                onClick={() => setShowSettings(true)}
                leftIcon={<SettingsIcon className="w-4 h-4" />}
              >
                Settings
              </ActionButton>

              {isConnected && (
                <ActionButton
                  variant="danger"
                  fullWidth
                  onClick={disconnect}
                  leftIcon={<DisconnectIcon className="w-4 h-4" />}
                >
                  Disconnect
                </ActionButton>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Center - Agent Avatar */}
        <div className="flex-1 flex items-center justify-center relative min-h-[400px] lg:min-h-0">
          <AgentAvatar
            connectionStatus={connectionStatus}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            agentAudioLevel={agentAudioLevel}
            agentJoined={agentJoined}
            size="md"
          />

          {/* Volume Control - Bottom */}
          {isConnected && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2">
              <VolumeControl
                value={volume}
                onChange={handleVolumeChange}
                size="md"
              />
            </div>
          )}

          {/* Connection Badge - Top Right */}
          <div className="absolute top-4 right-4">
            <ConnectionStatus status={connectionStatus} />
          </div>
        </div>
      </div>

      {/* Chat Panel - Redesigned */}
      <ChatPanel
        isOpen={showChat}
        onClose={() => setShowChat(false)}
        messages={formattedChatMessages}
        onSendMessage={handleSendChat}
        isConnected={isConnected}
        isAgentTyping={isAgentTyping}
        onClearChat={handleClearChat}
      />

      {/* Settings Panel */}
      <SettingsPanel
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
      />

      {/* Transcript Panel */}
      <TranscriptPanel
        isOpen={showTranscript}
        onClose={() => setShowTranscript(false)}
        entries={transcriptEntries}
        isRecording={isSpeaking}
      />

      {/* Session History */}
      <SessionHistory
        isOpen={showHistory}
        onClose={() => setShowHistory(false)}
      />

      {/* Patient Dashboard */}
      <PatientDashboard
        isOpen={showDashboard}
        onClose={() => setShowDashboard(false)}
      />

      {/* Error Toast */}
      {error && (
        <div className="fixed bottom-24 lg:bottom-8 left-1/2 -translate-x-1/2 z-50 animate-slideUp">
          <div className="bg-error-500/20 border border-error-500/50 px-6 py-3 rounded-xl backdrop-blur-sm">
            <Text size="sm" color="error">{error}</Text>
          </div>
        </div>
      )}
    </MainLayout>
  );
}

// Icons
function CheckIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}

function WifiIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.111 16.404a5.5 5.5 0 017.778 0M12 20h.01m-7.08-7.071c3.904-3.905 10.236-3.905 14.141 0M1.394 9.393c5.857-5.857 15.355-5.857 21.213 0" />
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

function DashboardIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

function HistoryIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
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
