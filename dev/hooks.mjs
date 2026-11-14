// Module resolve hook: swap @supabase/supabase-js for the local emulator.
// Usage: node --import ./dev/register.mjs dev/server.mjs
export async function resolve(specifier, context, nextResolve) {
  if (specifier === '@supabase/supabase-js') {
    return { url: new URL('./supabase-local.mjs', import.meta.url).href, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
