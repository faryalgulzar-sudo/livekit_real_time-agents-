'use client';

import { useState, useEffect, useRef } from 'react';

interface LatencyMetrics {
  stt: number | null;
  llm: number | null;
  tts: number | null;
  total: number | null;
}

interface VoicePanelProps {
  connectionStatus: 'disconnected' | 'connecting' | 'connected';
  userId: string;
  isSpeaking: boolean;
  audioLevel: number;
  latencyMetrics: LatencyMetrics;
  onConnect: () => Promise<void>;
  onDisconnect: () => Promise<void>;
  onToggleSpeaking: () => Promise<void>;
  onVolumeChange: (volume: number) => void;
}

export default function VoicePanel({
  connectionStatus,
  userId,
  isSpeaking,
  audioLevel,
  latencyMetrics,
  onConnect,
  onDisconnect,
  onToggleSpeaking,
  onVolumeChange,
}: VoicePanelProps) {
  const [volume, setVolume] = useState(80);
  const [micPermission, setMicPermission] = useState<boolean | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check microphone permissions on mount (client-side only)
  useEffect(() => {
    if (typeof window !== 'undefined' && navigator.mediaDevices) {
      checkMicrophonePermission();
    }
  }, []);

  const checkMicrophonePermission = async () => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) {
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((track) => track.stop());
      setMicPermission(true);
    } catch (error) {
      console.error('Microphone permission denied:', error);
      setMicPermission(false);
    }
  };

  const requestMicrophonePermission = async () => {
    await checkMicrophonePermission();
  };

  const handleConnect = async () => {
    if (!micPermission) {
      alert(
        '⚠️ Microphone Access Required\n\nPlease allow microphone access to use voice communication.\n\nClick "Allow Microphone Access" button below to grant permission.'
      );
      return;
    }

    setIsConnecting(true);
    try {
      await onConnect();
    } catch (error) {
      console.error('Connection error:', error);
    } finally {
      setIsConnecting(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newVolume = parseInt(e.target.value);
    setVolume(newVolume);
    onVolumeChange(newVolume / 100);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadedFile(file);
    setIsUploading(true);

    // TODO: Implement actual file upload to backend
    // For now, just simulate upload
    try {
      console.log('Uploading file:', file.name);
      // Simulate upload delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      alert(`File "${file.name}" uploaded successfully!`);
    } catch (error) {
      console.error('Upload error:', error);
      alert('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="bg-slate-800 rounded-2xl p-6 shadow-2xl border border-slate-700">
      <h2 className="text-2xl font-bold mb-5 text-slate-100 flex items-center gap-2">
        <span>🎤</span>
        <span>Voice Communication</span>
      </h2>

      {/* Voice Visualizer */}
      <div
        className={`bg-gradient-to-br from-slate-900 to-slate-950 rounded-xl p-10 text-center border-2 border-slate-700 min-h-[150px] flex items-center justify-center mb-5 ${
          isSpeaking ? 'border-indigo-500' : ''
        }`}
      >
        <div className="flex gap-2 items-center justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className={`w-1.5 bg-indigo-500 rounded-full transition-all duration-200 ${
                isSpeaking ? 'animate-wave' : 'opacity-30'
              }`}
              style={{
                height: isSpeaking ? '60px' : '40px',
                animationDelay: `${i * 0.1}s`,
              }}
            />
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex gap-4 flex-wrap mb-5">
        <button
          onClick={handleConnect}
          disabled={!userId || connectionStatus !== 'disconnected' || isConnecting}
          className="flex-1 min-w-[150px] px-6 py-3.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-indigo-500/40 hover:-translate-y-0.5"
        >
          <span className="text-xl">🔌</span>
          <span>{!userId ? 'Initializing...' : isConnecting ? 'Connecting...' : 'Connect'}</span>
        </button>

        <button
          onClick={onToggleSpeaking}
          disabled={connectionStatus !== 'connected'}
          className={`flex-1 min-w-[150px] px-6 py-3.5 ${
            isSpeaking
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-green-600 hover:bg-green-700'
          } disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:-translate-y-0.5`}
        >
          <span className="text-xl">{isSpeaking ? '🔇' : '🎤'}</span>
          <span>{isSpeaking ? 'Stop Speaking' : 'Start Speaking'}</span>
        </button>

        <button
          onClick={onDisconnect}
          disabled={connectionStatus === 'disconnected'}
          className="flex-1 min-w-[150px] px-6 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-lg flex items-center justify-center gap-2 transition-all duration-300 shadow-lg hover:shadow-red-500/40 hover:-translate-y-0.5"
        >
          <span className="text-xl">⏹️</span>
          <span>Disconnect</span>
        </button>
      </div>

      {/* Upload Report/X-ray Button */}
      {connectionStatus === 'connected' && (
        <div className="mb-5">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*,.pdf,.jpg,.jpeg,.png,.dicom"
            className="hidden"
          />
          <button
            onClick={handleUploadClick}
            disabled={isUploading}
            className="w-full px-6 py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold rounded-xl flex items-center justify-center gap-3 transition-all duration-300 shadow-lg hover:shadow-purple-500/40 hover:-translate-y-0.5 border border-purple-400/30"
          >
            <span className="text-2xl">{isUploading ? '⏳' : '📄'}</span>
            <div className="flex flex-col items-start">
              <span className="text-lg">{isUploading ? 'Uploading...' : 'Upload Report / X-ray'}</span>
              <span className="text-xs text-purple-200 opacity-80">PDF, Images, DICOM supported</span>
            </div>
          </button>
          {uploadedFile && !isUploading && (
            <div className="mt-2 p-2 bg-green-900/30 border border-green-500/30 rounded-lg text-green-400 text-sm flex items-center gap-2">
              <span>✅</span>
              <span>Uploaded: {uploadedFile.name}</span>
            </div>
          )}
        </div>
      )}

      {/* Volume Control */}
      <div className="flex items-center gap-4 p-4 bg-slate-900 rounded-lg mb-5">
        <label className="font-semibold min-w-[70px] text-slate-200">Volume:</label>
        <input
          type="range"
          min="0"
          max="100"
          value={volume}
          onChange={handleVolumeChange}
          className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-indigo-600"
        />
        <span className="min-w-[45px] text-right font-semibold text-indigo-400">
          {volume}%
        </span>
      </div>

      {/* Audio Info */}
      <div className="flex flex-col gap-3 p-4 bg-slate-900 rounded-lg mb-5">
        <div className="flex items-center gap-3">
          <span className="font-semibold min-w-[100px] text-slate-200">Microphone:</span>
          <span
            className={`${
              micPermission === true
                ? 'text-green-500'
                : micPermission === false
                ? 'text-red-500'
                : 'text-slate-400'
            }`}
          >
            {micPermission === true
              ? '✅ Ready'
              : micPermission === false
              ? '❌ Permission denied'
              : '⏳ Checking...'}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="font-semibold min-w-[100px] text-slate-200">Audio Level:</span>
          <div className="flex-1 h-2 bg-slate-700 rounded overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-green-500 to-indigo-500 transition-all duration-100 rounded"
              style={{ width: `${audioLevel}%` }}
            />
          </div>
          <span className="text-xs text-slate-400 min-w-[35px] text-right">
            {audioLevel.toFixed(0)}%
          </span>
        </div>
      </div>

      {/* Latency Metrics */}
      {connectionStatus === 'connected' && latencyMetrics.total !== null && (
        <div className="p-4 bg-gradient-to-br from-slate-900 to-slate-800 rounded-lg border border-slate-700">
          <h3 className="text-sm font-bold text-slate-200 mb-3 flex items-center gap-2">
            <span>⏱️</span>
            <span>Response Latency</span>
          </h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">STT (Speech-to-Text)</span>
              <span className="text-lg font-bold text-green-400">
                {latencyMetrics.stt !== null ? `${latencyMetrics.stt.toFixed(0)}ms` : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">LLM (AI Processing)</span>
              <span className="text-lg font-bold text-blue-400">
                {latencyMetrics.llm !== null ? `${latencyMetrics.llm.toFixed(0)}ms` : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">TTS (Text-to-Speech)</span>
              <span className="text-lg font-bold text-purple-400">
                {latencyMetrics.tts !== null ? `${latencyMetrics.tts.toFixed(0)}ms` : '-'}
              </span>
            </div>
            <div className="flex flex-col">
              <span className="text-xs text-slate-400">Total Response</span>
              <span className="text-lg font-bold text-indigo-400">
                {latencyMetrics.total !== null ? `${latencyMetrics.total.toFixed(0)}ms` : '-'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Microphone Permission Warning */}
      {micPermission === false && (
        <div className="mt-5 p-6 bg-gradient-to-br from-red-900/20 to-yellow-900/20 border-2 border-red-500/30 rounded-xl flex items-center gap-5 animate-slideIn">
          <div className="text-5xl animate-bounce">🎤</div>
          <div className="flex-1">
            <h3 className="text-yellow-400 text-xl font-bold mb-2">
              Microphone Access Required
            </h3>
            <p className="text-slate-300 mb-4 leading-relaxed">
              Voice communication requires microphone access. Click below to grant permission.
            </p>
            <button
              onClick={requestMicrophonePermission}
              className="px-7 py-3.5 bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-slate-900 font-bold rounded-lg inline-flex items-center gap-2.5 transition-all duration-300 shadow-lg shadow-yellow-500/40 hover:-translate-y-1"
            >
              <span className="text-xl">🔓</span>
              <span>Allow Microphone Access</span>
            </button>
          </div>
        </div>
      )}

      <style jsx>{`
        @keyframes wave {
          0%,
          100% {
            height: 20px;
          }
          50% {
            height: 60px;
          }
        }
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(-20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        .animate-wave {
          animation: wave 1.2s ease-in-out infinite;
        }
        .animate-slideIn {
          animation: slideIn 0.5s ease-out;
        }
      `}</style>
    </div>
  );
}
