type LogoProps = { className?: string; title?: string };

const LOGO_VERSION = '20260920-3';

export function BucuriaLogo({ className = '', title = 'Bucuria' }: LogoProps) {
  return (
    <svg
      className={className}
      viewBox="0 0 420 180"
      role="img"
      aria-label={title}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="bucuria-red" x1="0" x2="1">
          <stop offset="0" stopColor="#d81720" />
          <stop offset=".52" stopColor="#ef1f2c" />
          <stop offset="1" stopColor="#c90d18" />
        </linearGradient>
        <filter id="bucuria-shadow" x="-20%" y="-30%" width="140%" height="170%">
          <feDropShadow dx="0" dy="8" stdDeviation="8" floodColor="#761015" floodOpacity=".18" />
        </filter>
      </defs>
      <ellipse cx="210" cy="78" rx="178" ry="58" fill="url(#bucuria-red)" filter="url(#bucuria-shadow)" />
      <ellipse cx="210" cy="74" rx="170" ry="49" fill="none" stroke="rgba(255,255,255,.24)" strokeWidth="2" />
      <text
        x="210"
        y="94"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="57"
        fontStyle="italic"
        fontWeight="700"
        letterSpacing="1.5"
      >
        BUCURIA
      </text>
      <text
        x="210"
        y="154"
        textAnchor="middle"
        fill="#c9131d"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="19"
        fontStyle="italic"
        fontWeight="700"
      >
        fondată în 1946
      </text>
    </svg>
  );
}

export function NutsLogo({ className = '', title = 'Nuci și Fructe Uscate' }: LogoProps) {
  return (
    <img
      className={`${className} object-contain`}
      src={`/nuci-fructe-logo.svg?v=${LOGO_VERSION}`}
      alt={title}
      draggable={false}
      decoding="async"
    />
  );
}
