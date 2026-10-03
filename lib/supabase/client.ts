import { createBrowserClient } from "@supabase/ssr";
import { publicSupabaseEnvironment } from "./config";

export function createSupabaseBrowserClient() {
  const environment = publicSupabaseEnvironment();
  if (!environment) throw new Error("Supabase is not configured");
  return createBrowserClient(environment.url, environment.publishableKey);
}
