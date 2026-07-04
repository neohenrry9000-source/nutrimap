/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        riesgo: {
          muy_alto: "#c0392b",
          alto:     "#e67e22",
          medio:    "#f1c40f",
          bajo:     "#2ecc71",
          sin:      "#bdc3c7"
        }
      },
      // Curva estilo ease-out-expo: entra rápido, aterriza suave.
      transitionTimingFunction: {
        "out-expo": "cubic-bezier(0.16, 1, 0.3, 1)",
      },
      keyframes: {
        "feed-in": {
          "0%":   { opacity: "0", transform: "translateY(12px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        shimmer: {
          "0%":   { backgroundPosition: "-400px 0" },
          "100%": { backgroundPosition: "400px 0" },
        },
        "fade-up": {
          "0%":   { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "overlay-in": {
          "0%":   { opacity: "0" },
          "100%": { opacity: "1" },
        },
        "scale-in": {
          "0%":   { opacity: "0", transform: "scale(.96) translateY(8px)" },
          "100%": { opacity: "1", transform: "scale(1) translateY(0)" },
        },
        "slide-left": {
          "0%":   { opacity: "0", transform: "translateX(28px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%":      { transform: "translateY(-6px)" },
        },
        pop: {
          "0%":   { opacity: "0", transform: "scale(.7)" },
          "60%":  { transform: "scale(1.05)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
      animation: {
        "feed-in":    "feed-in .35s cubic-bezier(0.16,1,0.3,1)",
        shimmer:      "shimmer 1.4s linear infinite",
        "fade-up":    "fade-up .45s cubic-bezier(0.16,1,0.3,1) both",
        "overlay-in": "overlay-in .2s ease-out both",
        "scale-in":   "scale-in .28s cubic-bezier(0.16,1,0.3,1) both",
        "slide-left": "slide-left .32s cubic-bezier(0.16,1,0.3,1) both",
        float:        "float 4.5s ease-in-out infinite",
        pop:          "pop .45s cubic-bezier(0.16,1,0.3,1) both",
      },
    }
  },
  plugins: []
};
