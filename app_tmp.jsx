import { createHotContext as __vite__createHotContext } from "/@vite/client";import.meta.hot = __vite__createHotContext("/src/App.jsx");import __vite__cjsImport0_react_jsxDevRuntime from "/node_modules/.vite/deps/react_jsx-dev-runtime.js?v=16a6e19b"; const jsxDEV = __vite__cjsImport0_react_jsxDevRuntime["jsxDEV"];
import * as RefreshRuntime from "/@react-refresh";
const inWebWorker = typeof WorkerGlobalScope !== "undefined" && self instanceof WorkerGlobalScope;
let prevRefreshReg;
let prevRefreshSig;
if (import.meta.hot && !inWebWorker) {
  if (!window.$RefreshReg$) {
    throw new Error(
      "@vitejs/plugin-react can't detect preamble. Something is wrong."
    );
  }
  prevRefreshReg = window.$RefreshReg$;
  prevRefreshSig = window.$RefreshSig$;
  window.$RefreshReg$ = RefreshRuntime.getRefreshReg("C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx");
  window.$RefreshSig$ = RefreshRuntime.createSignatureFunctionForTransform;
}
var _s = $RefreshSig$();
import { Routes, Route, Navigate } from "/node_modules/.vite/deps/react-router-dom.js?v=16a6e19b";
import Login from "/src/pages/Login.jsx?t=1783132903870";
import Dashboard from "/src/pages/Dashboard.jsx?t=1783132903870";
import { useAuth } from "/src/hooks/useAuth.js?t=1783132903870";
export default function App() {
  _s();
  const { isAuth, rol } = useAuth();
  return /* @__PURE__ */ jsxDEV(Routes, { children: [
    /* @__PURE__ */ jsxDEV(Route, { path: "/login", element: isAuth ? /* @__PURE__ */ jsxDEV(Navigate, { to: "/" }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 29,
      columnNumber: 46
    }, this) : /* @__PURE__ */ jsxDEV(Login, {}, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 29,
      columnNumber: 68
    }, this) }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 29,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Route, { path: "/", element: isAuth ? /* @__PURE__ */ jsxDEV(Dashboard, {}, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 30,
      columnNumber: 41
    }, this) : /* @__PURE__ */ jsxDEV(Navigate, { to: "/login" }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 30,
      columnNumber: 57
    }, this) }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 30,
      columnNumber: 7
    }, this),
    /* @__PURE__ */ jsxDEV(Route, { path: "*", element: /* @__PURE__ */ jsxDEV(Navigate, { to: "/" }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 31,
      columnNumber: 32
    }, this) }, void 0, false, {
      fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
      lineNumber: 31,
      columnNumber: 7
    }, this)
  ] }, void 0, true, {
    fileName: "C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx",
    lineNumber: 28,
    columnNumber: 5
  }, this);
}
_s(App, "isbdGw3hbrbjCp1ElRGDLMbIVPQ=", false, function() {
  return [useAuth];
});
_c = App;
var _c;
$RefreshReg$(_c, "App");
if (import.meta.hot && !inWebWorker) {
  window.$RefreshReg$ = prevRefreshReg;
  window.$RefreshSig$ = prevRefreshSig;
}
if (import.meta.hot && !inWebWorker) {
  RefreshRuntime.__hmr_import(import.meta.url).then((currentExports) => {
    RefreshRuntime.registerExportsForReactRefresh("C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx", currentExports);
    import.meta.hot.accept((nextExports) => {
      if (!nextExports) return;
      const invalidateMessage = RefreshRuntime.validateRefreshBoundaryAndEnqueueUpdate("C:/Users/Henrry/OneDrive/Documents/GitHub/nutrimap/frontend/src/App.jsx", currentExports, nextExports);
      if (invalidateMessage) import.meta.hot.invalidate(invalidateMessage);
    });
  });
}

//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJtYXBwaW5ncyI6IkFBUzZDOzs7Ozs7Ozs7Ozs7Ozs7OztBQVQ3QyxTQUFTQSxRQUFRQyxPQUFPQyxnQkFBZ0I7QUFDeEMsT0FBT0MsV0FBVztBQUNsQixPQUFPQyxlQUFlO0FBQ3RCLFNBQVNDLGVBQWU7QUFFeEIsd0JBQXdCQyxNQUFNO0FBQUFDLEtBQUE7QUFDNUIsUUFBTSxFQUFFQyxRQUFRQyxJQUFJLElBQUlKLFFBQVE7QUFDaEMsU0FDRSx1QkFBQyxVQUNDO0FBQUEsMkJBQUMsU0FBTSxNQUFLLFVBQVMsU0FBU0csU0FBUyx1QkFBQyxZQUFTLElBQUcsT0FBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQWdCLElBQU0sdUJBQUMsV0FBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQU0sS0FBbkU7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUF1RTtBQUFBLElBQ3ZFLHVCQUFDLFNBQU0sTUFBSyxLQUFJLFNBQVNBLFNBQVMsdUJBQUMsZUFBRDtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQVUsSUFBTSx1QkFBQyxZQUFTLElBQUcsWUFBYjtBQUFBO0FBQUE7QUFBQTtBQUFBLFdBQXFCLEtBQXZFO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBMkU7QUFBQSxJQUMzRSx1QkFBQyxTQUFNLE1BQUssS0FBSSxTQUFTLHVCQUFDLFlBQVMsSUFBRyxPQUFiO0FBQUE7QUFBQTtBQUFBO0FBQUEsV0FBZ0IsS0FBekM7QUFBQTtBQUFBO0FBQUE7QUFBQSxXQUE2QztBQUFBLE9BSC9DO0FBQUE7QUFBQTtBQUFBO0FBQUEsU0FJQTtBQUVKO0FBQUNELEdBVHVCRCxLQUFHO0FBQUEsVUFDREQsT0FBTztBQUFBO0FBQUEsS0FEVEM7QUFBRyxJQUFBSTtBQUFBLGFBQUFBLElBQUEiLCJuYW1lcyI6WyJSb3V0ZXMiLCJSb3V0ZSIsIk5hdmlnYXRlIiwiTG9naW4iLCJEYXNoYm9hcmQiLCJ1c2VBdXRoIiwiQXBwIiwiX3MiLCJpc0F1dGgiLCJyb2wiLCJfYyJdLCJpZ25vcmVMaXN0IjpbXSwic291cmNlcyI6WyJBcHAuanN4Il0sInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IFJvdXRlcywgUm91dGUsIE5hdmlnYXRlIH0gZnJvbSBcInJlYWN0LXJvdXRlci1kb21cIjtcclxuaW1wb3J0IExvZ2luIGZyb20gXCIuL3BhZ2VzL0xvZ2luLmpzeFwiO1xyXG5pbXBvcnQgRGFzaGJvYXJkIGZyb20gXCIuL3BhZ2VzL0Rhc2hib2FyZC5qc3hcIjtcclxuaW1wb3J0IHsgdXNlQXV0aCB9IGZyb20gXCIuL2hvb2tzL3VzZUF1dGguanNcIjtcclxuXHJcbmV4cG9ydCBkZWZhdWx0IGZ1bmN0aW9uIEFwcCgpIHtcclxuICBjb25zdCB7IGlzQXV0aCwgcm9sIH0gPSB1c2VBdXRoKCk7XHJcbiAgcmV0dXJuIChcclxuICAgIDxSb3V0ZXM+XHJcbiAgICAgIDxSb3V0ZSBwYXRoPVwiL2xvZ2luXCIgZWxlbWVudD17aXNBdXRoID8gPE5hdmlnYXRlIHRvPVwiL1wiIC8+IDogPExvZ2luIC8+fSAvPlxyXG4gICAgICA8Um91dGUgcGF0aD1cIi9cIiBlbGVtZW50PXtpc0F1dGggPyA8RGFzaGJvYXJkIC8+IDogPE5hdmlnYXRlIHRvPVwiL2xvZ2luXCIgLz59IC8+XHJcbiAgICAgIDxSb3V0ZSBwYXRoPVwiKlwiIGVsZW1lbnQ9ezxOYXZpZ2F0ZSB0bz1cIi9cIiAvPn0gLz5cclxuICAgIDwvUm91dGVzPlxyXG4gICk7XHJcbn1cclxuIl0sImZpbGUiOiJDOi9Vc2Vycy9IZW5ycnkvT25lRHJpdmUvRG9jdW1lbnRzL0dpdEh1Yi9udXRyaW1hcC9mcm9udGVuZC9zcmMvQXBwLmpzeCJ9