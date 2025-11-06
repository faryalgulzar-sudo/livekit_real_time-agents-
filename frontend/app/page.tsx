'use client';

import { useLiveKit } from '@/hooks/useLiveKit';
import VoicePanel from '@/components/VoicePanel';
import ChatPanel from '@/components/ChatPanel';
import TranscriptPanel from '@/components/TranscriptPanel';

export default function Home() {
  const {
    connectionStatus,
    userId,
    isSpeaking,
    audioLevel,
    transcripts,
    chatMessages,
    sendChatMessage,
    connect,
    disconnect,
    toggleSpeaking,
    setVolume,
    error,
  } = useLiveKit();

  return (
    <div className="min-h-screen p-5">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <header className="text-center mb-8 p-8 bg-slate-800 rounded-2xl shadow-2xl">
          <h1 className="text-5xl font-bold mb-2.5 bg-gradient-to-r from-indigo-500 to-purple-600 bg-clip-text text-transparent">
            😊 Agent 007
          </h1>
          <p className="text-slate-400 text-lg">
            Connect and communicate with your AI assistant
          </p>
        </header>

        {/* Status Bar */}
        <div className="flex justify-between items-center p-4 px-6 bg-slate-800 rounded-xl mb-6 shadow-2xl">
          <div className="flex items-center gap-2.5">
            <span
              className={`w-3 h-3 rounded-full animate-pulse ${
                connectionStatus === 'connected'
                  ? 'bg-green-500'
                  : connectionStatus === 'connecting'
                  ? 'bg-yellow-400'
                  : 'bg-slate-600'
              }`}
            />
            <span className="font-semibold text-slate-100">
              {connectionStatus === 'connected'
                ? 'Connected'
                : connectionStatus === 'connecting'
                ? 'Connecting...'
                : 'Disconnected'}
            </span>
          </div>
          <div className="text-slate-400 text-sm">
            <span>User ID: {userId}</span>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/20 border-2 border-red-500/50 rounded-xl text-red-300">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Voice Control Panel */}
          <VoicePanel
            connectionStatus={connectionStatus}
            userId={userId}
            isSpeaking={isSpeaking}
            audioLevel={audioLevel}
            onConnect={connect}
            onDisconnect={disconnect}
            onToggleSpeaking={toggleSpeaking}
            onVolumeChange={setVolume}
          />

          {/* Chat Panel */}
          <ChatPanel
            messages={chatMessages}
            onSendMessage={sendChatMessage}
            isConnected={connectionStatus === 'connected'}
          />
        </div>

        {/* Transcript Panel */}
        <TranscriptPanel transcripts={transcripts} />

        {/* Footer */}
        <footer className="text-center p-5 text-slate-400 mt-8">
          <p>Powered by LiveKit • Real-time Voice AI</p>
        </footer>
      </div>
    </div>
  );
}
