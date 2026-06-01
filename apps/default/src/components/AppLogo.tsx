import { cn } from '../lib/utils';

interface AppLogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const CONFIG = {
  sm: { outer: 32, icon: 16, radius: 8 },
  md: { outer: 56, icon: 28, radius: 14 },
  lg: { outer: 80, icon: 40, radius: 20 },
};

export function AppLogo({ size = 'md', className = '' }: AppLogoProps) {
  const { outer, icon, radius } = CONFIG[size];
  const offset = (outer - icon) / 2;

  return (
    <div
      className={cn("flex-shrink-0 flex items-center justify-center relative", className)}
      style={{ 
        width: outer, 
        height: outer,
        borderRadius: radius,
        boxShadow: '0 4px 14px -2px rgba(10, 132, 255, 0.25), 0 2px 4px -2px rgba(10, 132, 255, 0.15)'
      }}
    >
      <svg
        width={outer}
        height={outer}
        viewBox={`0 0 ${outer} ${outer}`}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <linearGradient id="logoGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#64d2ff" />
            <stop offset="100%" stopColor="#0a84ff" />
          </linearGradient>
        </defs>

        <rect
          width={outer}
          height={outer}
          rx={radius}
          fill="url(#logoGrad)"
        />
        
        {/* Book with checkmark icon */}
        <svg
          x={offset}
          y={offset}
          width={icon}
          height={icon}
          viewBox="0 0 24 24"
          fill="none"
          stroke="white"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
          <polyline points="9 10 11 12 15 8" />
        </svg>
      </svg>
    </div>
  );
}
