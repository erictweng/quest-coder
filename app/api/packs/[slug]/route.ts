import { NextResponse } from "next/server";
import publicPack from "../../../../content/public/forest-of-patience-climbing-stairs.json";
import { ACTIVE_PACK_SLUG } from "../../../../lib/run-contract";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  if (slug !== ACTIVE_PACK_SLUG) return NextResponse.json({ error: "pack not found" }, { status: 404 });
  return NextResponse.json(publicPack, { headers: { "cache-control": "public, max-age=300" } });
}
