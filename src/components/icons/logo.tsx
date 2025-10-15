import type { SVGProps } from 'react';

export function Logo(props: SVGProps<SVGSVGElement>) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M4 15s1-1 4-1 5 2 8 0 3-1 3-1V5s-1 1-4 1-5-2-8 0-3 1-3 1z"></path>
      <line x1="4" y1="22" x2="4" y2="15"></line>
    </svg>
  );
}
