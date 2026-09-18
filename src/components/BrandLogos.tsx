type LogoProps = { className?: string; title?: string };

export function BucuriaLogo({ className = '', title = 'Bucuria' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 640 260" role="img" aria-label={title}>
      <defs>
        <linearGradient id="bucuria-red" x1="0" x2="1">
          <stop offset="0" stopColor="#ef2a2f" />
          <stop offset=".52" stopColor="#d71920" />
          <stop offset="1" stopColor="#b90f16" />
        </linearGradient>
        <filter id="bucuria-shadow" x="-20%" y="-30%" width="140%" height="160%">
          <feDropShadow dx="0" dy="10" stdDeviation="12" floodColor="#8e0d12" floodOpacity=".18" />
        </filter>
      </defs>
      <rect width="640" height="260" rx="32" fill="#fff" />
      <ellipse cx="320" cy="112" rx="275" ry="82" fill="url(#bucuria-red)" filter="url(#bucuria-shadow)" />
      <ellipse cx="320" cy="112" rx="268" ry="75" fill="none" stroke="#ff6b70" strokeWidth="2" opacity=".75" />
      <text
        x="320"
        y="137"
        textAnchor="middle"
        fill="#fff"
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="92"
        fontStyle="italic"
        fontWeight="700"
        letterSpacing="-5"
      >
        BUCURIA
      </text>
      <text
        x="320"
        y="226"
        textAnchor="middle"
        fill="#df1f27"
        fontFamily="'Brush Script MT', 'Segoe Script', cursive"
        fontSize="34"
        fontStyle="italic"
      >
        Fondată în 1946
      </text>
    </svg>
  );
}

export function NutsLogo({ className = '', title = 'Nuci și Fructe Uscate' }: LogoProps) {
  return (
    <svg className={className} viewBox="0 0 800 800" role="img" aria-label={title}>
      <defs>
        <radialGradient id="nuts-bg" cx="50%" cy="42%" r="70%">
          <stop offset="0" stopColor="#fff7dc" />
          <stop offset="1" stopColor="#f1cf8b" />
        </radialGradient>
        <filter id="nuts-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feDropShadow dx="0" dy="14" stdDeviation="18" floodColor="#6b431c" floodOpacity=".22" />
        </filter>
      </defs>
      <rect width="800" height="800" rx="64" fill="url(#nuts-bg)" />
      <g opacity=".95" fontSize="72" textAnchor="middle">
        <text x="132" y="170">🌰</text><text x="250" y="118">🥜</text><text x="548" y="112">🌰</text><text x="674" y="176">🍑</text>
        <text x="102" y="380">🥜</text><text x="696" y="382">🥜</text><text x="122" y="642">🍇</text><text x="672" y="648">🌰</text>
      </g>
      <circle cx="400" cy="400" r="292" fill="#fff3d1" stroke="#8d672f" strokeWidth="8" filter="url(#nuts-shadow)" />
      <circle cx="400" cy="400" r="270" fill="none" stroke="#b08a4c" strokeWidth="3" />
      <text x="400" y="278" textAnchor="middle" fontFamily="Georgia,serif" fontSize="82" fill="#4f2d16" fontWeight="700">NUCI</text>
      <line x1="246" y1="323" x2="554" y2="323" stroke="#7f642e" strokeWidth="4" />
      <text x="400" y="360" textAnchor="middle" fontFamily="Georgia,serif" fontSize="34" fill="#6a4b24" fontWeight="700">ȘI</text>
      <text x="400" y="432" textAnchor="middle" fontFamily="Georgia,serif" fontSize="48" fill="#315b32" fontWeight="700">FRUCTE USCATE</text>
      <g fill="#315b32" fontFamily="Arial,sans-serif" textAnchor="middle">
        <text x="400" y="505" fontSize="26">Naturale • Sănătate • Calitate</text>
        <text x="400" y="566" fontSize="28" fontWeight="700">Tel: 068 308 308</text>
      </g>
      <text x="400" y="655" textAnchor="middle" fontFamily="Georgia,serif" fontSize="24" fill="#755c35">de la colegi, pentru colegi</text>
    </svg>
  );
}
