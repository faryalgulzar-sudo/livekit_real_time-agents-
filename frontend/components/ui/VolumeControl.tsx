'use client';

import { ChangeEvent, forwardRef, HTMLAttributes, useState } from 'react';

interface VolumeControlProps extends Omit<HTMLAttributes<HTMLDivElement>, 'onChange'> {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  showValue?: boolean;
  showIcon?: boolean;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
}

const sizeConfig = {
  sm: {
    icon: 'w-4 h-4',
    slider: 'h-1',
    value: 'text-xs w-8',
    gap: 'gap-2',
  },
  md: {
    icon: 'w-5 h-5',
    slider: 'h-1.5',
    value: 'text-sm w-10',
    gap: 'gap-3',
  },
  lg: {
    icon: 'w-6 h-6',
    slider: 'h-2',
    value: 'text-base w-12',
    gap: 'gap-4',
  },
};

export const VolumeControl = forwardRef<HTMLDivElement, VolumeControlProps>(
  ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    showValue = true,
    showIcon = true,
    disabled = false,
    size = 'md',
    className = '',
    ...props
  }, ref) => {
    const [isFocused, setIsFocused] = useState(false);
    const sizeStyles = sizeConfig[size];

    const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
      onChange(parseInt(e.target.value, 10));
    };

    const percentage = ((value - min) / (max - min)) * 100;
    const isMuted = value === 0;

    return (
      <div
        ref={ref}
        className={`
          flex items-center ${sizeStyles.gap}
          bg-neutral-800/80 backdrop-blur-sm
          px-3 py-2 rounded-xl
          border border-neutral-700/50
          transition-colors duration-200
          ${isFocused ? 'border-primary-500/50' : ''}
          ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
          ${className}
        `}
        {...props}
      >
        {showIcon && (
          <button
            type="button"
            onClick={() => onChange(isMuted ? 50 : 0)}
            disabled={disabled}
            className="text-neutral-400 hover:text-neutral-200 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500 rounded"
            aria-label={isMuted ? 'Unmute' : 'Mute'}
          >
            {isMuted ? (
              <VolumeOffIcon className={sizeStyles.icon} />
            ) : value < 50 ? (
              <VolumeLowIcon className={sizeStyles.icon} />
            ) : (
              <VolumeHighIcon className={sizeStyles.icon} />
            )}
          </button>
        )}

        <div className="flex-1 relative">
          <input
            type="range"
            min={min}
            max={max}
            step={step}
            value={value}
            onChange={handleChange}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            disabled={disabled}
            className={`
              w-full ${sizeStyles.slider}
              bg-neutral-600 rounded-lg
              appearance-none cursor-pointer
              focus:outline-none
              disabled:cursor-not-allowed
              [&::-webkit-slider-thumb]:appearance-none
              [&::-webkit-slider-thumb]:w-3
              [&::-webkit-slider-thumb]:h-3
              [&::-webkit-slider-thumb]:rounded-full
              [&::-webkit-slider-thumb]:bg-primary-400
              [&::-webkit-slider-thumb]:shadow-sm
              [&::-webkit-slider-thumb]:transition-transform
              [&::-webkit-slider-thumb]:hover:scale-110
              [&::-moz-range-thumb]:w-3
              [&::-moz-range-thumb]:h-3
              [&::-moz-range-thumb]:rounded-full
              [&::-moz-range-thumb]:bg-primary-400
              [&::-moz-range-thumb]:border-0
            `}
            style={{
              background: `linear-gradient(to right, rgb(56 189 248) 0%, rgb(56 189 248) ${percentage}%, rgb(71 85 105) ${percentage}%, rgb(71 85 105) 100%)`,
            }}
            aria-label="Volume"
            aria-valuemin={min}
            aria-valuemax={max}
            aria-valuenow={value}
          />
        </div>

        {showValue && (
          <span className={`${sizeStyles.value} text-right font-medium text-primary-400`}>
            {value}%
          </span>
        )}
      </div>
    );
  }
);

VolumeControl.displayName = 'VolumeControl';

// Volume Icons
function VolumeHighIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function VolumeLowIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15.536 8.464a5 5 0 010 7.072M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
    </svg>
  );
}

function VolumeOffIcon({ className = '' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
      />
    </svg>
  );
}
