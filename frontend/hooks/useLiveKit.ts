import { useState, useEffect, useCallback, useRef } from 'react';
import * as LiveKit from 'livekit-client';
import { CONFIG, TokenResponse, TranscriptMessage } from '@/lib/config';

export type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';

export interface ChatMessage {
  id: string;
  text: string;
  sender: 'user' | 'agent' | 'system';
  timestamp: Date;
}

interface UseLiveKitReturn {
  // Connection state
  connectionStatus: ConnectionStatus;
  userId: string;
  room: LiveKit.Room | null;

  // Speaking state
  isSpeaking: boolean;
  audioLevel: number;

  // Transcripts
  transcripts: TranscriptMessage[];

  // Chat messages
  chatMessages: ChatMessage[];
  sendChatMessage: (message: string) => Promise<void>;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  toggleSpeaking: () => Promise<void>;
  setVolume: (volume: number) => void;

  // Error handling
  error: string | null;
}

export function useLiveKit(): UseLiveKitReturn {
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>('disconnected');
  const [userId, setUserId] = useState('');
  const [room, setRoom] = useState<LiveKit.Room | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0.8);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Generate userId on client side only (prevents hydration mismatch)
  useEffect(() => {
    if (typeof window !== 'undefined' && !userId) {
      setUserId('user_' + Math.random().toString(36).substring(7));
    }
  }, []); // Empty dependency array - run only once on mount

  // Add transcript helper
  const addTranscript = useCallback((speaker: string, text: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setTranscripts((prev) => [...prev, { speaker, text, timestamp }]);
  }, []);

  // Generate token from API
  const generateToken = async (participantName: string): Promise<TokenResponse> => {
    try {
      const response = await fetch(`${CONFIG.API_URL}/api/generate-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          room_name: CONFIG.DEFAULT_ROOM,
          participant_name: participantName,
          metadata: JSON.stringify({ device: 'web', timestamp: Date.now() }),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (err) {
      throw new Error('Failed to generate access token. Make sure FastAPI is running.');
    }
  };

  // Monitor audio level
  const monitorAudioLevel = useCallback((track: LiveKit.LocalAudioTrack | LiveKit.RemoteAudioTrack) => {
    if (typeof window === 'undefined') return;

    try {
      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const mediaStreamSource = audioContext.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack])
      );

      mediaStreamSource.connect(analyser);
      analyser.fftSize = 256;

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const percentage = Math.min(100, (average / 128) * 100);

        setAudioLevel(percentage);
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
    } catch (err) {
      console.error('Failed to monitor audio level:', err);
    }
  }, []);

  // Stop audio monitoring
  const stopAudioMonitoring = useCallback(() => {
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    setAudioLevel(0);
  }, []);

  // Setup room event listeners
  const setupRoomEvents = useCallback((room: LiveKit.Room) => {
    // Participant connected
    room.on(LiveKit.RoomEvent.ParticipantConnected, (participant) => {
      console.log('Participant connected:', participant.identity);
      const isAgent = participant.identity.startsWith('agent-');
      if (isAgent) {
        addTranscript('System', `✅ Agent joined: ${participant.identity}`);
      } else {
        addTranscript('System', `${participant.identity} joined the room`);
      }
    });

    // Participant disconnected
    room.on(LiveKit.RoomEvent.ParticipantDisconnected, (participant) => {
      console.log('Participant disconnected:', participant.identity);
      addTranscript('System', `${participant.identity} left the room`);
    });

    // Track subscribed
    room.on(LiveKit.RoomEvent.TrackSubscribed, (track, publication, participant) => {
      console.log('Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === LiveKit.Track.Kind.Audio) {
        const audioElement = track.attach();
        audioElement.volume = currentVolume;
        document.body.appendChild(audioElement);

        if (track instanceof LiveKit.RemoteAudioTrack) {
          monitorAudioLevel(track);
        }
      }
    });

    // Track unsubscribed
    room.on(LiveKit.RoomEvent.TrackUnsubscribed, (track) => {
      console.log('Track unsubscribed:', track.kind);
      track.detach().forEach((element) => element.remove());
    });

    // Data received (for transcripts and chat messages)
    room.on(LiveKit.RoomEvent.DataReceived, (payload, participant) => {
      try {
        const message = new TextDecoder().decode(payload);

        // Try to parse as JSON first (for structured messages like transcripts)
        try {
          const data = JSON.parse(message);
          if (data.type === 'transcript') {
            addTranscript(participant?.identity || 'Agent', data.text);
          }
        } catch {
          // Not JSON - treat as plain text chat message from agent
          console.log('💬 [CHAT] Received message from agent:', message);

          const chatMsg: ChatMessage = {
            id: Date.now().toString() + Math.random(),
            text: message,
            sender: 'agent',
            timestamp: new Date(),
          };

          setChatMessages((prev) => [...prev, chatMsg]);
        }
      } catch (err) {
        console.error('Failed to process data:', err);
      }
    });

    // Connection quality changed
    room.on(LiveKit.RoomEvent.ConnectionQualityChanged, (quality, participant) => {
      console.log('Connection quality:', quality, participant?.identity);
    });

    // Disconnected
    room.on(LiveKit.RoomEvent.Disconnected, (reason) => {
      console.log('Disconnected:', reason);
      setConnectionStatus('disconnected');
      setIsSpeaking(false);
      stopAudioMonitoring();
      addTranscript('System', 'Disconnected from room');
    });
  }, [addTranscript, currentVolume, monitorAudioLevel, stopAudioMonitoring]);

  // Connect to room
  const connect = useCallback(async () => {
    try {
      // Ensure userId is set before connecting - if not, initialize it now
      let currentUserId = userId;
      if (!currentUserId) {
        currentUserId = 'user_' + Math.random().toString(36).substring(7);
        setUserId(currentUserId);
      }

      setConnectionStatus('connecting');
      setError(null);

      console.log('Connecting to LiveKit...', { userId: currentUserId });

      // Generate token
      const tokenData = await generateToken(currentUserId);
      console.log('Token received');

      // Create room
      const newRoom = new LiveKit.Room({
        adaptiveStream: true,
        dynacast: true,
        audioCaptureDefaults: {
          autoGainControl: true,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      // Setup event listeners
      setupRoomEvents(newRoom);

      // Connect to room
      await newRoom.connect(tokenData.url || CONFIG.LIVEKIT_URL, tokenData.token);

      console.log('Connected successfully');
      setRoom(newRoom);
      setConnectionStatus('connected');
      addTranscript('System', `Connected to your private room: ${tokenData.room_name}`);

      // Check for existing participants (like the agent)
      console.log('Checking for existing participants in room...');
      const existingParticipants = Array.from(newRoom.remoteParticipants.values());
      console.log(`Found ${existingParticipants.length} existing participants:`, existingParticipants.map(p => p.identity));

      existingParticipants.forEach((participant) => {
        const isAgent = participant.identity.startsWith('agent-');
        console.log(`Participant: ${participant.identity}, isAgent: ${isAgent}`);
        if (isAgent) {
          addTranscript('System', `✅ Agent is ready: ${participant.identity}`);
        } else {
          addTranscript('System', `${participant.identity} is already in the room`);
        }
      });
    } catch (err) {
      console.error('Connection failed:', err);
      setError(err instanceof Error ? err.message : 'Connection failed');
      setConnectionStatus('disconnected');
      throw err;
    }
  }, [addTranscript, setupRoomEvents]);

  // Disconnect from room
  const disconnect = useCallback(async () => {
    console.log('Disconnecting...');

    if (room) {
      await room.disconnect();
      setRoom(null);
    }

    setConnectionStatus('disconnected');
    setIsSpeaking(false);
    stopAudioMonitoring();
    addTranscript('System', 'Disconnected from room');
  }, [room, addTranscript, stopAudioMonitoring]);

  // Toggle speaking (microphone)
  const toggleSpeaking = useCallback(async () => {
    if (!room) return;

    try {
      if (!isSpeaking) {
        console.log('Starting microphone...');
        await room.localParticipant.setMicrophoneEnabled(true);

        const micTrack = room.localParticipant.getTrackPublication(LiveKit.Track.Source.Microphone);
        if (micTrack?.track instanceof LiveKit.LocalAudioTrack) {
          monitorAudioLevel(micTrack.track);
        }

        setIsSpeaking(true);
        addTranscript('You', 'Started speaking');
      } else {
        console.log('Stopping microphone...');
        await room.localParticipant.setMicrophoneEnabled(false);

        stopAudioMonitoring();
        setIsSpeaking(false);
        addTranscript('You', 'Stopped speaking');
      }
    } catch (err) {
      console.error('Failed to toggle microphone:', err);
      setError(err instanceof Error ? err.message : 'Failed to toggle microphone');
    }
  }, [room, isSpeaking, addTranscript, monitorAudioLevel, stopAudioMonitoring]);

  // Set volume for remote audio tracks
  const setVolume = useCallback((volume: number) => {
    setCurrentVolume(volume);
    if (room) {
      room.remoteParticipants.forEach((participant) => {
        participant.audioTrackPublications.forEach((publication) => {
          if (publication.track && publication.track instanceof LiveKit.RemoteAudioTrack) {
            publication.track.setVolume(volume);
          }
        });
      });
    }
  }, [room]);

  // Send chat message via data channel
  const sendChatMessage = useCallback(async (message: string) => {
    if (!room || !message.trim()) {
      console.warn('Cannot send message: room not connected or empty message');
      return;
    }

    try {
      console.log('💬 [CHAT] Sending message:', message);

      // Add user message to chat immediately
      const userMsg: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        text: message,
        sender: 'user',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, userMsg]);

      // Send message to room via data channel
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      await room.localParticipant.publishData(data, { reliable: true });

      console.log('✅ [CHAT] Message sent successfully');
    } catch (err) {
      console.error('Failed to send chat message:', err);
      setError(err instanceof Error ? err.message : 'Failed to send message');

      // Add error message to chat
      const errorMsg: ChatMessage = {
        id: Date.now().toString() + Math.random(),
        text: 'Failed to send message. Please try again.',
        sender: 'system',
        timestamp: new Date(),
      };
      setChatMessages((prev) => [...prev, errorMsg]);
    }
  }, [room]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAudioMonitoring();
      if (room) {
        room.disconnect();
      }
    };
  }, [room, stopAudioMonitoring]);

  return {
    connectionStatus,
    userId,
    room,
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
  };
}
