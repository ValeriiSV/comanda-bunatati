type LogoProps = { className?: string; title?: string };

const LOGO_VERSION = '20260920-2';

export function BucuriaLogo({ className = '', title = 'Bucuria' }: LogoProps) {
  return (
    <img
      className={`${className} object-contain`}
      src={`/bucuria-logo.png?v=${LOGO_VERSION}`}
      alt={title}
      draggable={false}
      decoding="async"
    />
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
