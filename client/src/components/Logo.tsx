interface LogoProps {
  size?: number;
  className?: string;
}

// Custom inline SVG: a hanger with a thread that loops into the wordmark "M"
// motif. Geometric, monochrome, scales 24px → 200px.
export function Logo({ size = 28, className = "" }: LogoProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Closet logo"
      className={className}
    >
      <circle
        cx="16"
        cy="6.5"
        r="2"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <path
        d="M16 8.5 L16 11.2"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M5 22 L16 11.2 L27 22"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <rect
        x="4"
        y="22"
        width="24"
        height="3"
        rx="1"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}
