// Dummy Supabase settings for the local emulator. The API handlers read their
// config from the environment; the module hook (dev/hooks.mjs) swaps the real
// client for the emulator, so these values are never used for network calls.
process.env.NEXT_PUBLIC_SUPABASE_URL ||= 'http://127.0.0.1:8787/local-supabase';
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||= 'local-anon-key';
process.env.SUPABASE_SERVICE_ROLE_KEY ||= 'local-service-role-key';
