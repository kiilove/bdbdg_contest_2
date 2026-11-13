import React from "react";

/**
 * Unslop Signature Detail: Monospace Bib Tag
 * Derived from athlete trunk numbers (#104) and stage numbers (#12).
 * Uses JetBrains Mono, tabular figures, 4px radius, and a quiet hairline border.
 */
export const BibTag = ({
  number,
  prefix = "",
  variant = "default", // "default" | "dark" | "active"
  size = "md", // "sm" | "md" | "lg"
  className = "",
}) => {
  const sizeStyles = {
    sm: "min-w-[28px] h-5 px-1.5 text-[11px] leading-4",
    md: "min-w-[36px] h-6 px-2 text-xs leading-4",
    lg: "min-w-[48px] h-8 px-2.5 text-sm leading-5",
  };

  const variantStyles = {
    default:
      "bg-[#f4f4f5] text-[#171717] border border-[#171717]/15",
    dark:
      "bg-[#232325] text-[#ededed] border border-[#ededed]/15",
    active:
      "bg-[#2563eb] text-white border border-[#2563eb]",
  };

  return (
    <span
      className={`inline-flex items-center justify-center rounded-[4px] font-mono font-medium tabular-nums select-none ${
        sizeStyles[size] || sizeStyles.md
      } ${variantStyles[variant] || variantStyles.default} ${className}`}
    >
      {prefix}
      {number ?? "-"}
    </span>
  );
};

/**
 * Quiet Live Status Dot (only pulses when genuinely live)
 */
export const StatusDot = ({ status = "idle", live = false }) => {
  const colors = {
    live: "bg-[#16a34a]",
    active: "bg-[#2563eb]",
    warning: "bg-[#b45309]",
    danger: "bg-[#dc2626]",
    idle: "bg-[#737373]",
  };
  const dotColor = colors[status] || colors.idle;

  return (
    <span className="relative inline-flex h-2 w-2 shrink-0 items-center justify-center">
      {live && (
        <span
          className={`absolute inline-flex h-full w-full rounded-full opacity-40 animate-ping ${dotColor}`}
        />
      )}
      <span className={`relative inline-flex h-2 w-2 rounded-full ${dotColor}`} />
    </span>
  );
};

export default BibTag;
