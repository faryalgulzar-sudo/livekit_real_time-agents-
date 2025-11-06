export const CONFIG = {
  API_URL:
    typeof window !== 'undefined' && window.location.hostname.includes('drap.ai')
      ? '' // Use same-origin proxy
      : 'http://localhost:8000',
  // For local development, use ws://localhost:7880
  // For production, use wss://livekit.drap.ai
  LIVEKIT_URL:
    typeof window !== 'undefined' && window.location.hostname.includes('drap.ai')
      ? 'wss://livekit.drap.ai'
      : 'ws://localhost:7880',
  DEFAULT_ROOM: 'voice-room',
};

export interface TokenResponse {
  token: string;
  url: string;
  room_name: string;
  participant_name: string;
}

export interface TranscriptMessage {
  speaker: string;
  text: string;
  timestamp: string;
}
