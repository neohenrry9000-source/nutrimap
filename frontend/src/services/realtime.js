// Cliente PÚBLICO de Supabase (solo anon key) para el feed realtime.
// La anon key es segura en frontend: RLS solo permite leer tablas
// públicas (eventos_feed, mapa, metas...). La service key JAMÁS va aquí.
//
// Configuración opcional en frontend/.env:
//   VITE_SUPABASE_URL=https://xxxx.supabase.co
//   VITE_SUPABASE_ANON_KEY=eyJ...
// Sin configurar, el feed funciona igual por polling a /api/feed.
import { createClient } from "@supabase/supabase-js";

let client = null;
let intentado = false;

export function getSupabasePublic() {
  if (intentado) return client;
  intentado = true;
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (url && key) {
    client = createClient(url, key, {
      auth: { persistSession: false },
    });
  }
  return client;
}
