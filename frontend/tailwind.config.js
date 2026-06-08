/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
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
      }
    }
  },
  plugins: []
};
