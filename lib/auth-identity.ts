export type QuestCoderSession = {
  userId: string;
  progressKey: string;
  rateLimitKey: string;
  displayName: string;
  email?: string;
  provider: "supabase" | "local";
};

export type SupabaseUserShape = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown>;
};

export function sessionFromSupabaseUser(user: SupabaseUserShape): QuestCoderSession {
  const metadata = user.user_metadata ?? {};
  const metadataName = [metadata.display_name, metadata.full_name, metadata.name].find((value): value is string => typeof value === "string" && value.trim().length > 0);
  const displayName = metadataName?.trim().slice(0, 80) || user.email?.split("@")[0] || "Coder";
  return {
    userId: user.id,
    progressKey: user.id,
    rateLimitKey: `supabase:${user.id}`,
    displayName,
    email: user.email,
    provider: "supabase"
  };
}
