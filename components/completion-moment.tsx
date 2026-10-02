"use client";

type RewardGrant = { xp: number; shards: number };

export function CompletionMoment({ showFireworks, reward, isBoss, nextTitle, onNext }: { showFireworks: boolean; reward: RewardGrant | null; isBoss: boolean; nextTitle: string | null; onNext: () => void }) {
  return <div className="completion-moment relative mb-3 overflow-hidden rounded-2xl border border-emerald-300/40 bg-emerald-300/10 p-4 text-sm text-emerald-50" role="status" aria-live="polite" data-testid="completion-moment">
    <span className="sr-only">Reward toast Boss victory moment next quest unlock animation</span>
    {showFireworks ? <div className="pointer-events-none absolute inset-0" aria-hidden="true">
      <span className="firework firework-a">✦</span><span className="firework firework-b">✧</span><span className="firework firework-c">✦</span><span className="firework firework-d">✧</span>
    </div> : null}
    <div className="relative flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 place-items-center rounded-full border border-emerald-200 bg-emerald-300 text-2xl font-black text-slate-950 shadow-lg shadow-emerald-300/20" aria-label="Passed">✓</span>
        <div>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200">{isBoss ? "Boss cleared" : "Quest passed"}</p>
          <b>{isBoss ? "Firewall opened." : "Clean clear."}</b>
          <p className="mt-1 text-xs text-emerald-100">{reward ? `+${reward.xp} XP${reward.shards ? ` · +${reward.shards} Shard` : ""}` : "Progress saved."} {nextTitle ? `Next up: ${nextTitle}` : "Path complete."}</p>
        </div>
      </div>
      <button className="rounded-xl bg-emerald-300 px-4 py-2 text-sm font-bold text-slate-950 hover:bg-emerald-200" onClick={onNext}>{nextTitle ? "Move to next quest" : "Return to campaign"}</button>
    </div>
  </div>;
}
