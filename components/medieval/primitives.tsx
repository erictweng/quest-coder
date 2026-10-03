import type { ReactNode } from "react";
import { PixelSprite, type SpriteName } from "./sprites";

type PanelTone = "stone" | "raised" | "oak" | "parchment";

export function Panel({ tone = "stone", title, children, className = "", as: Tag = "section", labelledBy }: { tone?: PanelTone; title?: string; children: ReactNode; className?: string; as?: "section" | "div" | "article"; labelledBy?: string }) {
  const toneClass = tone === "raised" ? "mq-panel--stone mq-panel--raised" : `mq-panel--${tone}`;
  return (
    <Tag className={`mq-panel mq-notch ${toneClass} ${className}`} aria-labelledby={labelledBy}>
      {title ? <h3 className="mb-3 text-lg">{title}</h3> : null}
      {children}
    </Tag>
  );
}

/** Wood frame holding a parchment page: the standard reading surface. */
export function FramedParchment({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={`mq-panel mq-panel--oak mq-frame mq-notch ${className}`}>
      <div className="mq-panel mq-panel--parchment mq-notch">{children}</div>
    </div>
  );
}

export function PixelButton({ variant = "secondary", icon, children, shortcut, ...props }: { variant?: "primary" | "secondary" | "wood"; icon?: SpriteName; shortcut?: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={`mq-btn mq-btn--${variant} mq-notch`} {...props}>
      {icon ? <PixelSprite name={icon} scale={3} /> : null}
      <span>{children}</span>
      {shortcut ? <kbd className="mq-kbd">{shortcut}</kbd> : null}
    </button>
  );
}

/** Progress bar whose value is always written as text, so it never relies on colour alone. */
export function StatBar({ label, value, max, color, unit = "" }: { label: string; value: number; max: number; color: string; unit?: string }) {
  const percent = Math.max(0, Math.min(100, Math.round((value / max) * 100)));
  return (
    <div>
      <div className="mb-1 flex justify-between text-[15px]"><span>{label}</span><span>{value} / {max}{unit ? ` ${unit}` : ""}</span></div>
      <div className="mq-bar" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={`${value} of ${max}${unit ? ` ${unit}` : ""}`}>
        <div className="mq-bar__fill" style={{ width: `${percent}%`, ["--mq-bar" as string]: color }} />
      </div>
    </div>
  );
}

export type QuestState = "cleared" | "available" | "locked";

/** Status with an icon and a word: readable without colour. */
export function QuestStatus({ state, tone = "parchment" }: { state: QuestState; tone?: "parchment" | "stone" }) {
  const onParchment = tone === "parchment";
  const config = {
    cleared: { icon: "check" as const, text: "Cleared", color: onParchment ? "var(--mq-inkEmerald)" : "var(--mq-emerald)" },
    available: { icon: "scroll" as const, text: "Available", color: onParchment ? "var(--mq-inkSapphire)" : "var(--mq-sapphire)" },
    locked: { icon: "lock" as const, text: "Locked", color: onParchment ? "var(--mq-inkMuted)" : "var(--mq-textMuted)" }
  }[state];
  return <span className="mq-status" style={{ color: config.color }}><PixelSprite name={config.icon} scale={2} />{config.text}</span>;
}
