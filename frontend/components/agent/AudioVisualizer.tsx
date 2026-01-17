'use client';

import { useMemo } from 'react';
import { useReducedMotion } from '@/hooks/useReducedMotion';

interface AudioVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  variant?: 'bars' | 'wave' | 'circle';
  size?: 'sm' | 'md' | 'lg';
  colorScheme?: 'primary' | 'gradient' | 'success';
  barCount?: number;
}

export function AudioVisualizer({
  audioLevel,
  isActive,
  variant = 'bars',
  size = 'md',
  colorScheme = 'gradient',
  barCount = 8,
}: AudioVisualizerProps) {
  const prefersReducedMotion = useReducedMotion();

  const sizeConfig = {
    sm: { height: 'h-12', barWidth: 'w-1', gap: 'gap-0.5' },
    md: { height: 'h-20', barWidth: 'w-1.5', gap: 'gap-1' },
    lg: { height: 'h-28', barWidth: 'w-2', gap: 'gap-1.5' },
  };

  const colorConfig = {
    primary: 'bg-primary-500',
    gradient: '',
    success: 'bg-success-500',
  };

  // Generate bar heights based on audio level
  const barHeights = useMemo(() => {
    if (!isActive || prefersReducedMotion) {
      return Array(barCount).fill(20);
    }

    const baseHeight = Math.max(15, audioLevel * 0.8);
    return Array(barCount).fill(0).map((_, i) => {
      // Create a wave-like pattern
      const wave = Math.sin((i / barCount) * Math.PI) * 0.3 + 0.7;
      const randomness = 0.8 + Math.random() * 0.4;
      return Math.min(100, Math.max(15, baseHeight * wave * randomness));
    });
  }, [audioLevel, isActive, barCount, prefersReducedMotion]);

  if (variant === 'circle') {
    return <CircleVisualizer audioLevel={audioLevel} isActive={isActive} size={size} />;
  }

  if (variant === 'wave') {
    return <WaveVisualizer audioLevel={audioLevel} isActive={isActive} size={size} />;
  }

  // Default: Bars
  return (
    <div
      className={`flex items-end justify-center ${sizeConfig[size].height} ${sizeConfig[size].gap}`}
      role="img"
      aria-label={`Audio level: ${Math.round(audioLevel)}%`}
    >
      {barHeights.map((height, i) => (
        <div
          key={i}
          className={`
            ${sizeConfig[size].barWidth} rounded-full
            transition-all duration-100
            ${colorScheme !== 'gradient' ? colorConfig[colorScheme] : ''}
          `}
          style={{
            height: `${height}%`,
            background: colorScheme === 'gradient'
              ? i < barCount / 2
                ? 'linear-gradient(to top, #f97316, #fb923c)'
                : 'linear-gradient(to top, #10b981, #34d399)'
              : undefined,
            opacity: isActive ? 1 : 0.3,
          }}
        />
      ))}
    </div>
  );
}

// Circle Visualizer variant
interface CircleVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  size: 'sm' | 'md' | 'lg';
}

function CircleVisualizer({ audioLevel, isActive, size }: CircleVisualizerProps) {
  const sizeConfig = {
    sm: { container: 'w-16 h-16', ring: 'w-12 h-12' },
    md: { container: 'w-24 h-24', ring: 'w-20 h-20' },
    lg: { container: 'w-32 h-32', ring: 'w-28 h-28' },
  };

  const scale = isActive ? 1 + (audioLevel / 200) : 1;

  return (
    <div
      className={`
        ${sizeConfig[size].container}
        flex items-center justify-center
        relative
      `}
      role="img"
      aria-label={`Audio level: ${Math.round(audioLevel)}%`}
    >
      {/* Outer glow */}
      <div
        className={`
          absolute inset-0 rounded-full
          bg-primary-500/20 blur-xl
          transition-transform duration-150
        `}
        style={{ transform: `scale(${scale})` }}
      />

      {/* Main ring */}
      <div
        className={`
          ${sizeConfig[size].ring}
          rounded-full
          border-4 border-primary-500
          transition-all duration-150
          ${isActive ? 'border-primary-400 shadow-lg shadow-primary-500/30' : 'border-neutral-600'}
        `}
        style={{ transform: `scale(${scale})` }}
      />

      {/* Center dot */}
      <div
        className={`
          absolute w-3 h-3 rounded-full
          ${isActive ? 'bg-primary-400' : 'bg-neutral-500'}
          transition-colors duration-150
        `}
      />
    </div>
  );
}

// Wave Visualizer variant
interface WaveVisualizerProps {
  audioLevel: number;
  isActive: boolean;
  size: 'sm' | 'md' | 'lg';
}

function WaveVisualizer({ audioLevel, isActive, size }: WaveVisualizerProps) {
  const sizeConfig = {
    sm: { width: 120, height: 40 },
    md: { width: 200, height: 60 },
    lg: { width: 280, height: 80 },
  };

  const { width, height } = sizeConfig[size];
  const amplitude = isActive ? (audioLevel / 100) * (height / 3) : height / 8;

  // Generate wave path
  const points = 50;
  const pathData = Array(points).fill(0).map((_, i) => {
    const x = (i / (points - 1)) * width;
    const phase = (i / points) * Math.PI * 4;
    const y = height / 2 + Math.sin(phase) * amplitude;
    return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
  }).join(' ');

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="overflow-visible"
      role="img"
      aria-label={`Audio level: ${Math.round(audioLevel)}%`}
    >
      <path
        d={pathData}
        fill="none"
        stroke="url(#waveGradient)"
        strokeWidth="3"
        strokeLinecap="round"
        className="transition-all duration-150"
        style={{ opacity: isActive ? 1 : 0.3 }}
      />
      <defs>
        <linearGradient id="waveGradient" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0ea5e9" />
          <stop offset="50%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#0ea5e9" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Simple inline audio level indicator (for use in cards/buttons)
interface AudioLevelIndicatorProps {
  level: number;
  showPercentage?: boolean;
}

export function AudioLevelIndicator({ level, showPercentage = false }: AudioLevelIndicatorProps) {
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1.5 bg-neutral-700 rounded-full overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-success-500 to-primary-500 rounded-full transition-all duration-100"
          style={{ width: `${Math.min(100, level)}%` }}
        />
      </div>
      {showPercentage && (
        <span className="text-xs text-neutral-400 w-8 text-right">
          {Math.round(level)}%
        </span>
      )}
    </div>
  );
}
