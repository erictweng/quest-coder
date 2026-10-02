export type SupabaseEnvironment = {
  url: string;
  publishableKey: string;
  serviceRoleKey: string;
};
type SupabaseEnv = Record<string, string | undefined>;

export function readSupabaseEnvironment(env: SupabaseEnv = process.env): SupabaseEnvironment | null {
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
  const configured = [url, publishableKey, serviceRoleKey].filter(Boolean).length;
  if (configured === 0) return null;
  if (!url || !publishableKey || !serviceRoleKey) {
    throw new Error("Supabase configuration is incomplete; all three Quest Coder Supabase variables are required");
  }
  return { url, publishableKey, serviceRoleKey };
}

export function publicSupabaseEnvironment(env: SupabaseEnv = process.env) {
  const full = readSupabaseEnvironment(env);
  return full ? { url: full.url, publishableKey: full.publishableKey } : null;
}
