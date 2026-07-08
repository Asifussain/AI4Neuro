import React from 'react';

interface IconProps {
  className?: string;
  size?: number;
}

export const UploadIcon: React.FC<IconProps> = ({ className = '', size = 24 }) => {
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
        d="M7 18C4.23858 18 2 15.7614 2 13C2 10.5135 3.79151 8.4612 6.13568 8.07823C6.04769 7.72813 6 7.36187 6 6.98485C6 4.23305 8.23858 2 11 2C13.4193 2 15.4373 3.71825 15.9002 6.00084C18.1431 6.09151 20 7.88606 20 10.1818C20 12.3856 18.2987 14.1818 16 14.1818"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 22L12 12M12 12L15 15M12 12L9 15"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};
