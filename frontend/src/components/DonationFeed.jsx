// Feed de actividad en (casi) tiempo real.
//  * Con VITE_SUPABASE_URL/ANON_KEY: suscripción Realtime a eventos_feed.
//  * Sin configurar: polling a /api/feed cada 45 s.
// UX: toast discreto abajo-izquierda cuando llega un evento nuevo +
// botón flotante que abre un cajón con la actividad reciente.
import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "../services/api.js";
import { getSupabasePublic } from "../services/realtime.js";

const ICON = { donacion: "💚", organizacion: "🏠", retiro: "🏦", meta: "🎯" };

function timeAgo(iso) {
  if (!iso) return "";
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "hace instantes";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return `hace ${Math.floor(s / 86400)} d`;
}

export default function DonationFeed() {
  const [events, setEvents] = useState([]);
  const [toast, setToast] = useState(null);
  const [open, setOpen] = useState(false);
  const [live, setLive] = useState(false);
  const seen = useRef(new Set());
  const toastTimer = useRef(null);

  const ingest = useCallback((rows, { announce } = {}) => {
    const nuevos = rows.filter((r) => !seen.current.has(r.id));
    if (!nuevos.length) return;
    nuevos.forEach((r) => seen.current.add(r.id));
    setEvents((prev) =>
      [...nuevos, ...prev]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 30)
    );
    if (announce) {
      setToast(nuevos[0]);
      clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 6000);
    }
  }, []);

  useEffect(() => {
    let cancel = false;
    let pollId = null;
    let channel = null;

    api.feed().then((r) => !cancel && ingest(r.data || [])).catch(() => {});

    const sb = getSupabasePublic();
    if (sb) {
      channel = sb
        .channel("eventos_feed")
        .on("postgres_changes",
          { event: "INSERT", schema: "public", table: "eventos_feed" },
          (payload) => ingest([payload.new], { announce: true }))
        .subscribe((status) => setLive(status === "SUBSCRIBED"));
    }
    // Polling de respaldo (también corre con realtime, por si el socket cae)
    pollId = setInterval(() => {
      api.feed().then((r) => !cancel && ingest(r.data || [], { announce: !sb })).catch(() => {});
    }, 45000);

    return () => {
      cancel = true;
      clearInterval(pollId);
      clearTimeout(toastTimer.current);
      if (channel) getSupabasePublic()?.removeChannel(channel);
    };
  }, [ingest]);

  return (
    <>
      {/* Toast de evento nuevo */}
      {toast && !open && (
        <button
          onClick={() => { setOpen(true); setToast(null); }}
          className="fixed bottom-5 left-5 z-[1800] flex max-w-[320px] animate-feed-in items-start gap-2 rounded-2xl border border-emerald-200 bg-white/95 p-3 text-left shadow-xl backdrop-blur hover:bg-emerald-50 dark:border-emerald-800 dark:bg-slate-800/95 dark:hover:bg-slate-700"
        >
          <span className="text-xl">{ICON[toast.tipo] || "📣"}</span>
          <span>
            <span className="block text-sm font-bold text-slate-800 dark:text-slate-100">{toast.titulo}</span>
            {toast.mensaje && <span className="block text-xs text-slate-500 dark:text-slate-400">{toast.mensaje}</span>}
          </span>
        </button>
      )}

      {/* Botón flotante de actividad */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-label="Actividad reciente"
        className="nm-press fixed bottom-5 right-5 z-[1800] flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white shadow-xl transition hover:bg-slate-700 hover:shadow-2xl dark:bg-emerald-600 dark:hover:bg-emerald-500"
      >
        <span className="relative flex h-2 w-2">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${live ? "bg-emerald-400" : "bg-slate-400"}`} />
        </span>
        Actividad
      </button>

      {/* Cajón de actividad */}
      {open && (
        <div className="fixed bottom-20 right-5 z-[1800] flex max-h-[60vh] w-[340px] animate-feed-in flex-col overflow-hidden rounded-2xl border bg-white shadow-2xl dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b px-4 py-2.5 dark:border-slate-700">
            <h3 className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
              Actividad solidaria {live && <span className="ml-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:bg-emerald-900 dark:text-emerald-300">EN VIVO</span>}
            </h3>
            <button onClick={() => setOpen(false)} className="text-slate-400 hover:text-slate-700 dark:hover:text-slate-200">×</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {events.length ? events.map((e) => (
              <div key={e.id} className="flex items-start gap-2 rounded-xl px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-700/50">
                <span className="mt-0.5 text-lg">{ICON[e.tipo] || "📣"}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-snug text-slate-800 dark:text-slate-100">{e.titulo}</p>
                  {e.mensaje && <p className="truncate text-xs text-slate-500 dark:text-slate-400">{e.mensaje}</p>}
                  <p className="text-[11px] text-slate-400">{timeAgo(e.created_at)}</p>
                </div>
              </div>
            )) : (
              <p className="p-4 text-center text-sm text-slate-400">
                Aún no hay actividad. Cuando alguien done o se inscriba una organización, aparecerá aquí al instante.
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
}
