"use client";

/**
 * Logo KACHI TCG — chỉ vector (không PNG, không caro).
 * Icon: stack thẻ + mũi tên neon cyan; chữ trắng. Glow áp qua CSS ở wrapper (.kachi-brand-neon).
 */
export function KachiBrandLogo({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 132 46"
      className={`h-10 w-auto max-w-[min(200px,58vw)] sm:h-11 overflow-visible ${className}`}
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
      focusable="false"
    >
      {/* Stack thẻ + mũi tên */}
      <g transform="translate(66, 15)">
        <rect
          x="-15"
          y="2"
          width="30"
          height="16"
          rx="2"
          fill="none"
          stroke="#00EAFF"
          strokeWidth="1.15"
          opacity={0.42}
          transform="rotate(-10)"
        />
        <rect
          x="-15"
          y="-1"
          width="30"
          height="16"
          rx="2"
          fill="none"
          stroke="#00EAFF"
          strokeWidth="1.15"
          opacity={0.68}
          transform="rotate(-4)"
        />
        <rect
          x="-15"
          y="-5"
          width="30"
          height="16"
          rx="2"
          fill="rgba(0, 234, 255, 0.08)"
          stroke="#00EAFF"
          strokeWidth="1.2"
        />
        <path
          d="M -5 2 L 0 -4 L 5 2"
          fill="none"
          stroke="#00EAFF"
          strokeWidth="1.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </g>

      <text
        x="66"
        y="40"
        textAnchor="middle"
        fill="#FFFFFF"
        fontSize="11"
        fontWeight="700"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
        letterSpacing="0.2em"
      >
        KACHI TCG
      </text>
    </svg>
  );
}
