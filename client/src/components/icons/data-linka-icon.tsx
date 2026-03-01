export function DataLinkaIcon({ className }: { className?: string }) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path d="M6 14C6 12.8954 6.89543 12 8 12H24C25.1046 12 26 12.8954 26 14V20C26 21.1046 25.1046 22 24 22H8C6.89543 22 6 21.1046 6 20V14Z" stroke="currentColor" strokeWidth="2"/>
      <line x1="9" y1="15" x2="23" y2="15" stroke="currentColor" strokeWidth="2"/>
      <path d="M10 22V28H22V22" stroke="currentColor" strokeWidth="2"/>
      <line x1="13" y1="25" x2="19" y2="25" stroke="currentColor" strokeWidth="1.5"/>
      <circle cx="23" cy="10" r="4" stroke="currentColor" strokeWidth="2"/>
      <line x1="26" y1="13" x2="29" y2="16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}
