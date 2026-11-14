/** A flame drawn twice: the 1-g teardrop and the 0-g sphere it becomes. */
export default function Logo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <circle cx="12" cy="13" r="8.5" fill="none" stroke="var(--ug)" strokeWidth="1.3" />
      <path d="M12 3.2c2.8 3.6 4.4 6.3 4.4 9 0 2.7-2 4.6-4.4 4.6S7.6 14.9 7.6 12.2c0-2.7 1.6-5.4 4.4-9z" fill="var(--flame)" />
      <path d="M12 9.5c1.1 1.5 1.7 2.6 1.7 3.6 0 1-.8 1.8-1.7 1.8s-1.7-.8-1.7-1.8c0-1 .6-2.1 1.7-3.6z" fill="var(--ember)" />
    </svg>
  );
}
