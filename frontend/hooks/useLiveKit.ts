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
  agentAudioLevel: number; // Agent's audio level for lip sync

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
  const [agentAudioLevel, setAgentAudioLevel] = useState(0);
  const [transcripts, setTranscripts] = useState<TranscriptMessage[]>([]);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [currentVolume, setCurrentVolume] = useState(0.8);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const currentAudioTrackRef = useRef<LiveKit.LocalAudioTrack | null>(null);
  const roomRef = useRef<LiveKit.Room | null>(null);
  const pendingRemoteTrackRef = useRef<LiveKit.RemoteAudioTrack | null>(null); // Store agent track for later monitoring

  // Agent audio monitoring refs
  const agentAudioContextRef = useRef<AudioContext | null>(null);
  const agentAnalyserRef = useRef<AnalyserNode | null>(null);
  const agentAnimationFrameRef = useRef<number | null>(null);

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
  const monitorAudioLevel = useCallback(async (track: LiveKit.LocalAudioTrack | LiveKit.RemoteAudioTrack) => {
    if (typeof window === 'undefined') return;

    try {
      console.log('🎵 Starting audio level monitoring for track:', track.sid);

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      // ✅ CRITICAL FIX: AWAIT AudioContext resume (browser autoplay policy)
      if (audioContext.state === 'suspended') {
        console.warn('⚠️ AudioContext is suspended, resuming...');
        await audioContext.resume();
        console.log('✅ AudioContext resumed successfully');
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.8; // Smooth out the audio level changes

      const mediaStreamSource = audioContext.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack])
      );

      mediaStreamSource.connect(analyser);
      console.log('✅ Audio analyser connected to track');

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

        // Log only when significant audio detected (for debugging)
        if (percentage > 5) {
          console.log('🔊 Audio level:', percentage.toFixed(1) + '%');
        }

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };

      updateLevel();
      console.log('✅ Audio level monitoring started');
    } catch (err) {
      console.error('❌ Failed to monitor audio level:', err);
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

  // Monitor AGENT audio level (for lip sync)
  const monitorAgentAudioLevel = useCallback(async (track: LiveKit.RemoteAudioTrack) => {
    if (typeof window === 'undefined') return;

    try {
      console.log('🤖 Starting AGENT audio level monitoring for lip sync:', track.sid);

      const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
      const audioContext = new AudioContext();

      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }

      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.7;

      const mediaStreamSource = audioContext.createMediaStreamSource(
        new MediaStream([track.mediaStreamTrack])
      );

      mediaStreamSource.connect(analyser);
      console.log('✅ Agent audio analyser connected');

      agentAudioContextRef.current = audioContext;
      agentAnalyserRef.current = analyser;

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);

      const updateAgentLevel = () => {
        if (!agentAnalyserRef.current) return;

        analyser.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / bufferLength;
        const percentage = Math.min(100, (average / 128) * 100);

        setAgentAudioLevel(percentage);

        agentAnimationFrameRef.current = requestAnimationFrame(updateAgentLevel);
      };

      updateAgentLevel();
      console.log('✅ Agent lip sync monitoring started');
    } catch (err) {
      console.error('❌ Failed to monitor agent audio level:', err);
    }
  }, []);

  // Stop agent audio monitoring
  const stopAgentAudioMonitoring = useCallback(() => {
    if (agentAnimationFrameRef.current) {
      cancelAnimationFrame(agentAnimationFrameRef.current);
      agentAnimationFrameRef.current = null;
    }
    if (agentAudioContextRef.current) {
      agentAudioContextRef.current.close();
      agentAudioContextRef.current = null;
    }
    agentAnalyserRef.current = null;
    setAgentAudioLevel(0);
  }, []);

  // 🎧 DEVICE CHANGE HANDLER - Recreate audio track when Bluetooth/headset is connected
  const handleDeviceChange = useCallback(async () => {
    console.log('🔄 Audio device change detected!');

    // Only handle if we're connected and speaking
    if (!roomRef.current || connectionStatus !== 'connected' || !isSpeaking) {
      console.log('⏭️ Skipping device change handling - not in active call');
      return;
    }

    try {
      // List available devices
      const devices = await navigator.mediaDevices.enumerateDevices();
      const audioInputs = devices.filter(d => d.kind === 'audioinput');
      console.log('📱 Available audio inputs:', audioInputs.map(d => d.label || d.deviceId));

      // Stop current audio monitoring
      stopAudioMonitoring();

      // Unpublish old track if exists
      if (currentAudioTrackRef.current) {
        console.log('🛑 Unpublishing old audio track...');
        await roomRef.current.localParticipant.unpublishTrack(currentAudioTrackRef.current);
        currentAudioTrackRef.current.stop();
        currentAudioTrackRef.current = null;
      }

      // Small delay to let the new device initialize
      await new Promise(resolve => setTimeout(resolve, 500));

      // Create new track with default (new) device
      console.log('🎤 Creating new audio track with updated device...');
      const newTrack = await LiveKit.createLocalAudioTrack({
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      });

      // Publish new track
      await roomRef.current.localParticipant.publishTrack(newTrack, {
        source: LiveKit.Track.Source.Microphone,
        name: 'microphone',
      });

      currentAudioTrackRef.current = newTrack;
      console.log('✅ New audio track published with updated device');

      // Start monitoring new track
      await monitorAudioLevel(newTrack);

      // Get the new device name
      const newDevices = await navigator.mediaDevices.enumerateDevices();
      const activeInput = newDevices.find(d => d.kind === 'audioinput' && d.deviceId === 'default');
      const deviceName = activeInput?.label || 'New audio device';

      addTranscript('System', `🎧 Switched to: ${deviceName}`);
    } catch (err) {
      console.error('❌ Failed to switch audio device:', err);
      setError('Failed to switch audio device. Please try reconnecting.');
    }
  }, [connectionStatus, isSpeaking, stopAudioMonitoring, monitorAudioLevel, addTranscript]);

  // 🎧 Setup device change listener
  useEffect(() => {
    if (typeof window === 'undefined' || !navigator.mediaDevices) return;

    console.log('🎧 Setting up audio device change listener...');
    navigator.mediaDevices.addEventListener('devicechange', handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener('devicechange', handleDeviceChange);
    };
  }, [handleDeviceChange]);

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
      console.log('🎧 Track subscribed:', track.kind, 'from', participant.identity);

      if (track.kind === LiveKit.Track.Kind.Audio) {
        console.log('🔊 Processing audio track from', participant.identity);

        const audioElement = track.attach() as HTMLAudioElement;
        audioElement.volume = currentVolume;
        audioElement.autoplay = true;
        (audioElement as any).playsInline = true; // Safari compatibility

        // ✅ CRITICAL: Add ID for debugging
        audioElement.id = `audio-${participant.identity}`;

        // Explicitly play the audio
        audioElement.play().then(() => {
          console.log('✅ Audio playback started successfully for', participant.identity);
          console.log('   - Volume:', currentVolume);
          console.log('   - Element ID:', audioElement.id);

          // ✅ Store remote track for monitoring later (when user clicks Start Speaking)
          // AudioContext needs user gesture to resume, so we defer monitoring
          if (track instanceof LiveKit.RemoteAudioTrack) {
            console.log('🎵 Storing remote track for deferred monitoring (waiting for user gesture)');
            pendingRemoteTrackRef.current = track;

            // ✅ If from agent, also start agent audio monitoring for lip sync
            if (participant.identity.startsWith('agent-')) {
              console.log('🤖 Agent track detected, will monitor for lip sync after user gesture');
            }
          }
        }).catch((error) => {
          console.error('❌ Audio playback failed:', error);
          console.warn('⚠️ This might be due to browser autoplay policy. User interaction may be required.');

          // ✅ Still store the track for later monitoring
          if (track instanceof LiveKit.RemoteAudioTrack) {
            console.log('⚠️ Storing remote track despite playback failure');
            pendingRemoteTrackRef.current = track;
          }
        });

        document.body.appendChild(audioElement);
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
      roomRef.current = newRoom; // Store in ref for device change handler
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

      // Mic stays OFF - user will click "Start Speaking" when ready
      addTranscript('System', '🎤 Click "Start Speaking" to enable microphone');
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

    // Clear refs
    roomRef.current = null;
    currentAudioTrackRef.current = null;
    pendingRemoteTrackRef.current = null;

    setConnectionStatus('disconnected');
    setIsSpeaking(false);
    stopAudioMonitoring();
    stopAgentAudioMonitoring(); // ✅ Also stop agent lip sync monitoring
    addTranscript('System', 'Disconnected from room');
  }, [room, addTranscript, stopAudioMonitoring, stopAgentAudioMonitoring]);

  // Toggle speaking (microphone)
  const toggleSpeaking = useCallback(async () => {
    if (!room) return;

    try {
      if (!isSpeaking) {
        console.log('Starting microphone...');

        // Create microphone track manually with explicit source
        const localTrack = await LiveKit.createLocalAudioTrack({
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        });

        // Publish track with EXPLICIT SOURCE set to Microphone
        await room.localParticipant.publishTrack(localTrack, {
          source: LiveKit.Track.Source.Microphone,
          name: 'microphone',
        });

        currentAudioTrackRef.current = localTrack; // Store in ref for device change handler
        console.log('Microphone track published with source: Microphone');

        // ✅ FIX: Now we have user gesture, so start monitoring for BOTH tracks
        // First, monitor our local mic
        await monitorAudioLevel(localTrack);

        // ✅ Also start monitoring pending remote track (agent) if exists
        // This is the first user gesture, so AudioContext can now resume
        if (pendingRemoteTrackRef.current) {
          console.log('🎵 Now monitoring pending agent track (user gesture received)');
          await monitorAudioLevel(pendingRemoteTrackRef.current);

          // ✅ Start agent lip sync monitoring separately
          console.log('🤖 Starting agent lip sync monitoring...');
          await monitorAgentAudioLevel(pendingRemoteTrackRef.current);

          pendingRemoteTrackRef.current = null; // Clear after monitoring started
        }

        setIsSpeaking(true);
        addTranscript('You', 'Started speaking');
      } else {
        console.log('Stopping microphone...');
        await room.localParticipant.setMicrophoneEnabled(false);

        currentAudioTrackRef.current = null; // Clear ref
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
    agentAudioLevel,
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
