import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { publicSupabaseEnvironment } from "./config";

export async function createSupabaseServerClient() {
  const environment = publicSupabaseEnvironment();
  if (!environment) throw new Error("Supabase is not configured");
  const cookieStore = await cookies();
  return createServerClient(environment.url, environment.publishableKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (cookiesToSet) => {
        try {
          for (const { name, value, options } of cookiesToSet) cookieStore.set(name, value, options);
        } catch {
          // Server Components cannot write cookies. Route handlers and proxy.ts
          // perform the refresh writes; authorization still calls getUser().
        }
      }
    }
  });
}
