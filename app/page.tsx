import samplePack from "../content/packs/timequake-search-rotated-array.json";

export default function Home() {
  const pack = samplePack;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100">
      <section className="mx-auto flex min-h-screen w-full max-w-5xl flex-col justify-center gap-8 px-6 py-16">
        <div className="space-y-4">
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Quest Coder MVP Skeleton</p>
          <h1 className="text-5xl font-black tracking-tight sm:text-7xl">Turn algorithm practice into boss fights.</h1>
          <p className="max-w-2xl text-lg leading-8 text-slate-300">
            This Sprint 0 shell locks the product direction: original quest packs, a server-side Python runner,
            timeline-based replays, and a first Timequake pack feeding the engine spike.
          </p>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card label="First Pack" value={pack.title} detail={pack.metadata.shortDescription} />
          <Card label="Runtime" value={pack.runtime.language.toUpperCase()} detail="Browser submits code; server runner executes it." />
          <Card label="Review" value="1 · 3 · 7 · 14 · 30" detail="Simple spaced intervals for the personal MVP." />
        </div>

        <div className="rounded-3xl border border-cyan-400/30 bg-cyan-400/10 p-6 shadow-2xl shadow-cyan-950/50">
          <h2 className="text-2xl font-bold">Sprint 1 target</h2>
          <p className="mt-2 text-slate-300">
            Build the local CPython runner spike, classify compile/crash/fail/pass outcomes, enforce read budgets,
            and emit the timeline contract consumed by the replay theater.
          </p>
        </div>
      </section>
    </main>
  );
}

function Card({ label, value, detail }: { label: string; value: string; detail: string }) {
  return (
    <article className="rounded-2xl border border-white/10 bg-white/5 p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-400">{label}</p>
      <h2 className="mt-3 text-xl font-bold text-white">{value}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-300">{detail}</p>
    </article>
  );
}
