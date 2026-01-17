'use client';

import { useEffect, useState, useMemo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected';
type AgentState = 'idle' | 'listening' | 'speaking' | 'thinking';

interface AgentAvatarProps {
  connectionStatus: ConnectionStatus;
  isSpeaking: boolean;
  audioLevel: number;
  agentAudioLevel: number;
  agentJoined: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: {
    container: 'w-48 h-48',
    head: 'w-40 h-40',
    face: 'inset-6 top-10 bottom-12',
    antenna: '-top-10',
    antennaHeight: 'h-8',
    ear: 'w-10 h-16',
    eyeGap: 'gap-10',
    eyeWidth: 35,
    mouthBars: 5,
  },
  md: {
    container: 'w-72 h-72',
    head: 'w-64 h-64',
    face: 'inset-8 top-12 bottom-16',
    antenna: '-top-14',
    antennaHeight: 'h-10',
    ear: 'w-14 h-20',
    eyeGap: 'gap-14',
    eyeWidth: 45,
    mouthBars: 7,
  },
  lg: {
    container: 'w-96 h-96',
    head: 'w-80 h-80',
    face: 'inset-10 top-14 bottom-20',
    antenna: '-top-16',
    antennaHeight: 'h-12',
    ear: 'w-16 h-24',
    eyeGap: 'gap-16',
    eyeWidth: 55,
    mouthBars: 9,
  },
};

export function AgentAvatar({
  connectionStatus,
  isSpeaking,
  audioLevel,
  agentAudioLevel,
  agentJoined,
  size = 'md',
}: AgentAvatarProps) {
  const prefersReducedMotion = useReducedMotion();
  const [isBlinking, setIsBlinking] = useState(false);
  const config = sizeConfig[size];

  // Determine agent state
  const agentState: AgentState = useMemo(() => {
    if (connectionStatus !== 'connected') return 'idle';
    if (agentAudioLevel > 5) return 'speaking';
    if (isSpeaking || audioLevel > 5) return 'listening';
    return 'idle';
  }, [connectionStatus, isSpeaking, audioLevel, agentAudioLevel]);

  // Eye blinking effect
  useEffect(() => {
    if (prefersReducedMotion) return;

    const scheduleNextBlink = () => {
      const delay = 2000 + Math.random() * 4000; // 2-6 seconds
      return setTimeout(() => {
        setIsBlinking(true);
        setTimeout(() => setIsBlinking(false), 150);
        scheduleNextBlink();
      }, delay);
    };

    const timeoutId = scheduleNextBlink();
    return () => clearTimeout(timeoutId);
  }, [prefersReducedMotion]);

  // Generate mouth bar heights
  const mouthBars = useMemo(() => {
    if (agentState !== 'speaking' && agentState !== 'listening') {
      return Array(config.mouthBars).fill(4);
    }

    const level = agentState === 'speaking' ? agentAudioLevel : audioLevel;
    return Array(config.mouthBars).fill(0).map((_, i) => {
      const center = config.mouthBars / 2;
      const distFromCenter = Math.abs(i - center);
      const scale = 1 - (distFromCenter / center) * 0.3;
      return Math.max(4, (level * 0.35) * scale + Math.random() * 8);
    });
  }, [agentState, audioLevel, agentAudioLevel, config.mouthBars]);

  const isActive = connectionStatus === 'connected' && agentJoined;
  const glowIntensity = agentState === 'speaking' ? 0.4 : agentState === 'listening' ? 0.25 : 0.1;

  return (
    <div className={`relative ${config.container}`}>
      {/* Background glow */}
      <div
        className={`
          absolute inset-0 rounded-full blur-3xl
          transition-all duration-500
          ${prefersReducedMotion ? '' : agentState !== 'idle' ? 'animate-pulse' : ''}
        `}
        style={{
          background: `radial-gradient(circle, rgba(99, 102, 241, ${glowIntensity}) 0%, transparent 70%)`,
          transform: `scale(${1 + (agentState !== 'idle' ? 0.1 : 0)})`,
        }}
      />

      {/* Ripple effects when active */}
      {isActive && agentState !== 'idle' && !prefersReducedMotion && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-primary-500/20 animate-ping" style={{ animationDuration: '2s' }} />
          <div className="absolute inset-0 scale-110 rounded-full border border-primary-500/10 animate-ping" style={{ animationDuration: '2.5s', animationDelay: '0.5s' }} />
        </>
      )}

      {/* Main avatar container with floating animation */}
      <div className={`relative ${prefersReducedMotion ? '' : 'animate-float'}`}>
        <div className={prefersReducedMotion ? '' : 'animate-breathe'}>
          {/* Antennas */}
          <div className={`absolute ${config.antenna} left-8 flex flex-col items-center`}>
            <div
              className={`
                w-3 h-3 rounded-full transition-all duration-300
                ${isActive ? 'bg-primary-300 shadow-lg shadow-primary-400/60' : 'bg-primary-600'}
                ${isActive && !prefersReducedMotion ? 'animate-pulse' : ''}
              `}
            />
            <div className={`w-1.5 ${config.antennaHeight} bg-primary-600 rounded-full`} />
          </div>
          <div className={`absolute ${config.antenna} right-8 flex flex-col items-center`}>
            <div
              className={`
                w-3 h-3 rounded-full transition-all duration-300
                ${isActive ? 'bg-primary-300 shadow-lg shadow-primary-400/60' : 'bg-primary-600'}
                ${isActive && !prefersReducedMotion ? 'animate-pulse' : ''}
              `}
              style={{ animationDelay: '0.5s' }}
            />
            <div className={`w-1.5 ${config.antennaHeight} bg-primary-600 rounded-full`} />
          </div>

          {/* Head */}
          <div
            className={`
              ${config.head} bg-primary-500 rounded-full relative
              shadow-2xl transition-shadow duration-300
              ${agentState !== 'idle' ? 'shadow-primary-500/40' : 'shadow-primary-500/20'}
            `}
          >
            {/* Ears/Headphones */}
            <div
              className={`
                absolute -left-6 top-1/2 -translate-y-1/2
                ${config.ear} bg-primary-500 rounded-2xl
                flex items-center justify-center
                transition-transform duration-100
              `}
              style={{
                transform: `translateY(-50%) scale(${1 + (agentState !== 'idle' ? audioLevel * 0.001 : 0)})`,
              }}
            >
              <div className={`w-2/3 h-2/3 bg-primary-600 rounded-xl`} />
            </div>
            <div
              className={`
                absolute -right-6 top-1/2 -translate-y-1/2
                ${config.ear} bg-primary-500 rounded-2xl
                flex items-center justify-center
                transition-transform duration-100
              `}
              style={{
                transform: `translateY(-50%) scale(${1 + (agentState !== 'idle' ? audioLevel * 0.001 : 0)})`,
              }}
            >
              <div className={`w-2/3 h-2/3 bg-primary-600 rounded-xl`} />
            </div>

            {/* Face */}
            <div className={`absolute ${config.face} bg-white rounded-[2rem] flex flex-col items-center justify-center`}>
              {/* Eyes */}
              <div className={`flex ${config.eyeGap} mb-3`}>
                <Eye isBlinking={isBlinking} isSpeaking={agentState === 'speaking'} width={config.eyeWidth} />
                <Eye isBlinking={isBlinking} isSpeaking={agentState === 'speaking'} width={config.eyeWidth} />
              </div>

              {/* Mouth */}
              <div className="mt-2">
                {agentState === 'speaking' || agentState === 'listening' ? (
                  <div className="flex items-end justify-center gap-0.5 h-6">
                    {mouthBars.map((height, i) => (
                      <div
                        key={i}
                        className="w-1.5 bg-primary-500 rounded-full transition-all duration-75"
                        style={{ height: `${height}px` }}
                      />
                    ))}
                  </div>
                ) : (
                  <svg width="50" height="24" viewBox="0 0 50 24">
                    <path
                      d="M8 6 Q25 22 42 6"
                      fill="none"
                      stroke="#6366f1"
                      strokeWidth="5"
                      strokeLinecap="round"
                    />
                  </svg>
                )}
              </div>
            </div>

            {/* Chin pointer */}
            <div className="absolute -bottom-3 left-6 w-6 h-6 bg-primary-500 rotate-45" />
          </div>
        </div>
      </div>

      {/* Status text */}
      <div className="text-center mt-6">
        <p
          className={`
            text-lg font-medium transition-colors duration-300
            ${agentState === 'speaking' ? 'text-primary-400' :
              agentState === 'listening' ? 'text-success-400' :
              'text-neutral-400'}
          `}
        >
          {connectionStatus === 'disconnected' ? 'Ready to Connect' :
           connectionStatus === 'connecting' ? 'Connecting...' :
           !agentJoined ? 'Waiting for Agent...' :
           agentState === 'speaking' ? 'Speaking...' :
           agentState === 'listening' ? 'Listening...' :
           'Standing By'}
        </p>

        {/* Tagline */}
        <div className="mt-4 max-w-xs mx-auto">
          <div className="bg-neutral-800/50 backdrop-blur-sm rounded-xl px-4 py-2 border border-neutral-700/50">
            <p className="text-primary-400/80 italic text-sm">
              "Built to listen. Designed to help."
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// Eye component
interface EyeProps {
  isBlinking: boolean;
  isSpeaking: boolean;
  width: number;
}

function Eye({ isBlinking, isSpeaking, width }: EyeProps) {
  const height = width * 0.6;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className="overflow-visible">
      {isBlinking ? (
        <path
          d={`M4 ${height / 2} L${width - 4} ${height / 2}`}
          fill="none"
          stroke="#4f46e5"
          strokeWidth="5"
          strokeLinecap="round"
        />
      ) : (
        <>
          <path
            d={`M4 ${height - 4} Q${width / 2} 0 ${width - 4} ${height - 4}`}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="6"
            strokeLinecap="round"
            className="transition-opacity duration-200"
            style={{ opacity: isSpeaking ? 1 : 0.9 }}
          />
          {isSpeaking && (
            <circle
              cx={width / 2}
              cy={height / 2.5}
              r="3"
              fill="#4f46e5"
            />
          )}
        </>
      )}
    </svg>
  );
}

// Add CSS animations
const styles = `
  @keyframes float {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-8px); }
  }

  @keyframes breathe {
    0%, 100% { transform: scale(1); }
    50% { transform: scale(1.02); }
  }

  .animate-float {
    animation: float 4s ease-in-out infinite;
  }

  .animate-breathe {
    animation: breathe 3s ease-in-out infinite;
  }

  @media (prefers-reduced-motion: reduce) {
    .animate-float,
    .animate-breathe {
      animation: none;
    }
  }
`;

// Inject styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = styles;
  document.head.appendChild(styleSheet);
}
