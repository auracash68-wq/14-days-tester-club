import React from 'react';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export default function Logo({ className = '', size = 'md' }: LogoProps) {
  const sizeClasses = {
    sm: 'h-8 w-8',
    md: 'h-10 w-10',
    lg: 'h-16 w-16'
  };

  return (
    <div className={`relative flex items-center justify-center ${sizeClasses[size]} ${className}`} id="brand_premium_logo">
      {/* Decorative Outer Glow Effect */}
      <div className="absolute inset-0 bg-gradient-to-tr from-[#2563EB]/40 to-[#10B981]/40 rounded-xl blur-md opacity-70 animate-pulse" />
      
      {/* Premium SVG Logo */}
      <svg
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full relative z-10 filter drop-shadow-[0_4px_6px_rgba(37,99,235,0.25)]"
      >
        <defs>
          <linearGradient id="logo-blue-emerald" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#2563EB" />
            <stop offset="50%" stopColor="#3B82F6" />
            <stop offset="100%" stopColor="#10B981" />
          </linearGradient>
          <linearGradient id="shield-gradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1E293B" />
            <stop offset="100%" stopColor="#0F172A" />
          </linearGradient>
          <filter id="logo-glow-filter" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feComposite in="SourceGraphic" in2="blur" operator="over" />
          </filter>
        </defs>

        {/* Outer Tech Hexagonal/Shield Frame */}
        <path
          d="M50 5 L88 25 L88 75 L50 95 L12 75 L12 25 Z"
          fill="url(#shield-gradient)"
          stroke="url(#logo-blue-emerald)"
          strokeWidth="4.5"
          strokeLinejoin="round"
        />

        {/* Inner Glowing Segmented Tech Mesh */}
        <path
          d="M50 12 L82 30 L82 70 L50 88 L18 70 L18 30 Z"
          stroke="#1E293B"
          strokeWidth="1.5"
          opacity="0.5"
        />

        {/* Styled Numeral '1' */}
        <path
          d="M33 32 L44 24 V68"
          stroke="white"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Styled Numeral '4' Intertwined with a Quality Testing Checkmark */}
        {/* Left angle of 4 */}
        <path
          d="M54 24 L54 52 H74"
          stroke="url(#logo-blue-emerald)"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {/* Vertical stem of 4 which sweeps down into an emerald-green premium checkmark */}
        <path
          d="M71 34 V60 L58 68"
          stroke="#10B981"
          strokeWidth="8"
          strokeLinecap="round"
          strokeLinejoin="round"
          filter="url(#logo-glow-filter)"
        />
      </svg>
    </div>
  );
}
