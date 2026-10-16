export default function Logo({ className = '' }: { className?: string }) {
  return (
    <span
      className={`font-extrabold tracking-[-0.04em] text-neutral-900 select-none inline-block leading-none -translate-y-[3px] ${className}`}
      style={{
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
      }}
    >
      neus
    </span>
  );
}
