import { NextResponse } from "next/server";
import { listPackSlugs } from "../../../lib/quests";

export async function GET() {
  return NextResponse.json({ packs: listPackSlugs() });
}
