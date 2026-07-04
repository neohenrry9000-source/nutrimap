// Selector de foto de perfil: comprime en el navegador a 256px (canvas)
// y la envía en base64 al backend, que valida y sube a Supabase Storage.
import { useRef, useState } from "react";
import Avatar from "./Avatar.jsx";

const LADO = 256;

function comprimir(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const escala = Math.min(1, LADO / Math.max(img.width, img.height));
      const w = Math.round(img.width * escala);
      const h = Math.round(img.height * escala);
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      canvas.getContext("2d").drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL("image/jpeg", 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

export default function AvatarUploader({ src, nombre, onUpload, size = "xl" }) {
  const inputRef = useRef(null);
  const [preview, setPreview] = useState(null);
  const [state, setState] = useState({ subiendo: false, err: "" });

  const elegir = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!/^image\/(png|jpe?g|webp)$/.test(file.type)) {
      setState({ subiendo: false, err: "Usa una imagen PNG, JPG o WebP." });
      return;
    }
    setState({ subiendo: true, err: "" });
    try {
      const dataUrl = await comprimir(file);
      setPreview(dataUrl);
      await onUpload({ imagen_base64: dataUrl, mime: "image/jpeg" });
      setState({ subiendo: false, err: "" });
    } catch (err) {
      setPreview(null);
      setState({ subiendo: false, err: err.detail || err.message || "Error al subir" });
    }
  };

  return (
    <div className="flex flex-col items-center gap-1.5">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={state.subiendo}
        className="group relative rounded-full"
        title="Cambiar foto de perfil"
      >
        <Avatar src={preview || src} nombre={nombre} size={size} />
        <span className="absolute inset-0 grid place-items-center rounded-full bg-black/45 text-[11px] font-bold text-white opacity-0 transition group-hover:opacity-100">
          {state.subiendo ? "Subiendo…" : "📷 Cambiar"}
        </span>
      </button>
      <input ref={inputRef} type="file" accept="image/png,image/jpeg,image/webp"
             onChange={elegir} className="hidden" />
      {state.err && <p className="max-w-[180px] text-center text-xs text-red-600">{state.err}</p>}
    </div>
  );
}
