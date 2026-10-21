import * as React from "react";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

/*
 * Admin UI kit — light, calm, and consistent with the public site:
 * warm-white page, white cards, black type, terracotta reserved for the
 * primary action and the current location. Every admin screen builds
 * from these few pieces instead of restyling inputs and cards locally.
 */

export function AdminPage({
  title,
  description,
  actions,
  children,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 md:px-8 md:py-10", className)}>
      {/* Actions wrap below the title when there are too many to fit beside it. */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between md:mb-8 print:hidden">
        <div className="min-w-0 sm:min-w-[18rem] sm:flex-1">
          <h1 className="text-[26px] font-bold leading-tight tracking-[-0.03em] text-black-iron md:text-[30px]">
            {title}
          </h1>
          {description && <p className="mt-1.5 max-w-2xl text-[14px] text-dark-grey">{description}</p>}
        </div>
        {actions && <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>}
      </header>
      <div className="space-y-6">{children}</div>
    </div>
  );
}

export function Card({
  title,
  description,
  actions,
  children,
  className,
  bodyClassName,
  id,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  /** Anchor to link to (e.g. "#details" from a list's Edit button). */
  id?: string;
}) {
  return (
    <section
      id={id}
      className={cn(
        "rounded-[16px] border border-black-iron/[0.07] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]",
        className,
      )}
    >
      {(title || actions) && (
        <header className="flex items-start justify-between gap-4 border-b border-black-iron/[0.06] px-5 py-4 md:px-6">
          <div className="min-w-0">
            {title && <h2 className="text-[16px] font-semibold tracking-[-0.01em] text-black-iron">{title}</h2>}
            {description && <p className="mt-0.5 text-[13px] text-dark-grey">{description}</p>}
          </div>
          {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cn("p-5 md:p-6", bodyClassName)}>{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  required,
  children,
  className,
  htmlFor,
}: {
  label: string;
  hint?: React.ReactNode;
  required?: boolean;
  children: React.ReactNode;
  className?: string;
  htmlFor?: string;
}) {
  // Tie the label (and hint) to the control, so tapping the label focuses
  // it and screen readers announce its name. Done automatically for the
  // field's first input, select or textarea (e.g. one followed by its datalist).
  const autoId = React.useId();
  const hintId = hint ? `${autoId}-hint` : undefined;
  const kids = React.Children.toArray(children);
  const at = kids.findIndex((c) => React.isValidElement(c) && CONTROLS.has(c.type));
  const target = at >= 0 ? (kids[at] as React.ReactElement<{ id?: string; "aria-describedby"?: string }>) : null;
  const id = target ? (target.props.id ?? htmlFor ?? autoId) : htmlFor;
  const control = target
    ? kids.map((c, i) =>
        i === at
          ? React.cloneElement(target, { id, "aria-describedby": cn(target.props["aria-describedby"], hintId) || undefined })
          : c,
      )
    : children;
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={id} className="block text-[13px] font-medium text-black-iron">
        {label}
        {required && <span className="ms-0.5 text-terracotta-ink">*</span>}
      </label>
      {control}
      {hint && <p id={hintId} className="text-[12px] text-dark-grey">{hint}</p>}
    </div>
  );
}

/** Text inputs, selects and textareas share one look. */
export const controlClass =
  "w-full rounded-[10px] border border-black-iron/[0.12] bg-white px-3.5 text-[14px] text-black-iron placeholder:text-black-iron/35 transition-colors focus:border-terracotta/60 focus:outline-none focus:ring-2 focus:ring-terracotta/15 disabled:opacity-50";

export const TextInput = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(controlClass, "h-11", className)} {...props} />,
);
TextInput.displayName = "TextInput";

export const TextArea = React.forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  ({ className, rows = 3, ...props }, ref) => (
    <textarea ref={ref} rows={rows} className={cn(controlClass, "resize-y py-2.5 leading-relaxed", className)} {...props} />
  ),
);
TextArea.displayName = "TextArea";

export const Select = React.forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, ...props }, ref) => <select ref={ref} className={cn(controlClass, "h-11 pe-8", className)} {...props} />,
);
Select.displayName = "Select";

const CONTROLS = new Set<unknown>([TextInput, TextArea, Select, "input", "select", "textarea"]);

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("px-6 py-14 text-center", className)}>
      <p className="text-[16px] font-semibold text-black-iron">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-sm text-[13px] text-dark-grey">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

export function StatusPill({
  tone = "neutral",
  children,
  className,
}: {
  tone?: "neutral" | "good" | "warn" | "bad" | "accent";
  children: React.ReactNode;
  className?: string;
}) {
  const tones = {
    neutral: "bg-black-iron/[0.05] text-dark-grey",
    good: "bg-olive-leaf/[0.12] text-olive-leaf",
    warn: "bg-saffron-orange/[0.16] text-cinnamon-bark",
    bad: "bg-pomegranate-red/[0.09] text-pomegranate-red",
    accent: "bg-terracotta/[0.1] text-terracotta-ink",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-1 text-[11.5px] font-medium",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** A labelled on/off setting — the whole row is the click target. */
export function SwitchRow({
  label,
  description,
  checked,
  onCheckedChange,
  disabled,
  className,
}: {
  label: string;
  description?: React.ReactNode;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "flex cursor-pointer items-center justify-between gap-4 rounded-[12px] border border-black-iron/[0.08] px-4 py-3 transition-colors hover:border-black-iron/20",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-black-iron">{label}</span>
        {description && <span className="mt-0.5 block text-[12.5px] text-dark-grey">{description}</span>}
      </span>
      <Switch checked={checked} onCheckedChange={onCheckedChange} disabled={disabled} />
    </label>
  );
}

/** Compact pill for secondary row actions (Edit, Delete, Undo…) — small, but still a button. */
export const chipButtonClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-black-iron/[0.05] px-3 text-[13px] font-medium text-black-iron/80 transition-colors hover:bg-black-iron/[0.09] hover:text-black-iron active:bg-black-iron/[0.12] disabled:opacity-50";
export const chipDangerClass =
  "inline-flex min-h-9 items-center gap-1.5 rounded-full bg-pomegranate-red/[0.08] px-3 text-[13px] font-medium text-pomegranate-red transition-colors hover:bg-pomegranate-red/[0.14] disabled:opacity-50";

/** Round icon button for row actions (reorder, delete…). Always pass a label. */
export function IconButton({
  label,
  onClick,
  disabled,
  danger,
  size = "md",
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
  size?: "sm" | "md";
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className={cn(
        // A soft fill at rest, so it reads as a button before any hover.
        "grid shrink-0 place-items-center rounded-full bg-black-iron/[0.04] text-dark-grey transition-colors active:bg-black-iron/[0.12] disabled:bg-transparent disabled:opacity-30",
        size === "sm" ? "h-9 w-9" : "h-10 w-10",
        danger ? "hover:bg-pomegranate-red/[0.1] hover:text-pomegranate-red" : "hover:bg-black-iron/[0.08] hover:text-black-iron",
      )}
    >
      {children}
    </button>
  );
}
