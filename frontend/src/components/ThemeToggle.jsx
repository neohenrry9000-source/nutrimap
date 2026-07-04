import { useTheme } from "../hooks/useTheme.js";

export default function ThemeToggle({ className = "" }) {
  const { theme, toggle } = useTheme();
  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "Cambiar a tema claro" : "Cambiar a tema oscuro"}
      title={theme === "dark" ? "Tema claro" : "Tema oscuro"}
      className={`nm-press rounded-xl border border-slate-200 px-2.5 py-1.5 text-sm transition hover:bg-slate-100 dark:border-slate-600 dark:hover:bg-slate-700 ${className}`}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
