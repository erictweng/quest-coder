import { NextResponse } from "next/server";
import { loadQuestPack } from "../../../../lib/quests";

export async function GET(_request: Request, context: { params: Promise<{ slug: string }> }) {
  try {
    const { slug } = await context.params;
    return NextResponse.json(loadQuestPack(slug));
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "pack load failed" }, { status: 404 });
  }
}
