import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const BrainIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M12 3C10.5 3 9.5 3.5 9 4.5C8.5 4 7.5 3.5 6.5 3.5C5 3.5 4 4.5 4 6C4 6.5 4.2 7 4.5 7.5C3.5 8 3 9 3 10C3 11 3.5 12 4.5 12.5C4.2 13 4 13.5 4 14C4 15.5 5 16.5 6.5 16.5C6.8 16.5 7.1 16.4 7.4 16.3C7.5 17.5 8 19 9 20C9.8 20.7 10.8 21 12 21C13.2 21 14.2 20.7 15 20C16 19 16.5 17.5 16.6 16.3C16.9 16.4 17.2 16.5 17.5 16.5C19 16.5 20 15.5 20 14C20 13.5 19.8 13 19.5 12.5C20.5 12 21 11 21 10C21 9 20.5 8 19.5 7.5C19.8 7 20 6.5 20 6C20 4.5 19 3.5 17.5 3.5C16.5 3.5 15.5 4 15 4.5C14.5 3.5 13.5 3 12 3Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10C12 10 10.5 11 10 12C9.5 13 9.5 14.5 10.5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 10C12 10 13.5 11 14 12C14.5 13 14.5 14.5 13.5 15.5"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
