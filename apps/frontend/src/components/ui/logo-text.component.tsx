import React from 'react';

export const LogoTextComponent = () => {
  return (
    <svg
      width="132"
      height="33"
      viewBox="0 0 132 33"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient
          id="vantlyLogoTextGrad"
          x1="0"
          y1="0"
          x2="33"
          y2="33"
          gradientUnits="userSpaceOnUse"
        >
          <stop offset="0" stopColor="#4F46E5" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <rect
        width="33"
        height="33"
        rx="8"
        fill="url(#vantlyLogoTextGrad)"
      />
      <path
        d="M16.5 9.5L24.5 24.5"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M16.5 9.5L8.5 24.5"
        stroke="#FFFFFF"
        strokeWidth="3.1"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="16.5" cy="9.5" r="2.6" fill="#FFFFFF" />
      <text
        x="43"
        y="24.5"
        fontFamily="'Inter', 'Segoe UI', 'Helvetica Neue', Arial, sans-serif"
        fontSize="21"
        fontWeight="800"
        letterSpacing="-0.4"
        fill="currentColor"
      >
        Vantly
      </text>
    </svg>
  );
};
