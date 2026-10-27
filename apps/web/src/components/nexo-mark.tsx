export function NexoMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="-2 -4 28 28" aria-hidden>
      <path
        d="M21.763 0.245l-3.374 1.687c-0.623 0.308-0.973 0.903-0.973 1.631v6.293L6.223 0.427C5.6-0.042 4.851-0.126 4.193 0.182L1.008 1.813C0.357 2.135 0 2.737 0 3.486v15.218c0 1.477 1.526 2.289 2.716 1.785l3.073-1.617c0.693-0.322 1.057-0.952 1.057-1.722v-7.7l11.732 10.591c0.602 0.546 1.421 0.679 2.086 0.364l2.786-1.505c0.602-0.315 0.938-0.931 0.938-1.68V1.932c0-1.463-1.505-2.275-2.625-1.687z"
        fill="#037AF6"
      />
    </svg>
  );
}

export function Brand({ className = "text-ink" }: { className?: string }) {
  return (
    <div className="flex items-center gap-2.5">
      <NexoMark />
      <span className={`text-base font-bold tracking-[-0.2px] ${className}`}>Nexo Assist</span>
    </div>
  );
}
