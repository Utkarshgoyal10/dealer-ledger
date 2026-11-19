import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { Eraser } from 'lucide-react';

/**
 * Finger / mouse signature box. Parent reads it with ref.current.toDataURL()
 * (PNG, transparent background) and ref.current.isEmpty().
 */
const SignaturePad = forwardRef(function SignaturePad({ onChange, height = 180 }, ref) {
  const canvas = useRef(null);
  const drawing = useRef(false);
  const last = useRef(null);
  const [empty, setEmpty] = useState(true);

  // Size the canvas to its box (sharp on phones, but capped so the image stays small)
  useEffect(() => {
    const c = canvas.current;
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const w = c.offsetWidth;
    c.width = w * ratio;
    c.height = height * ratio;
    const ctx = c.getContext('2d');
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a';
  }, [height]);

  const pos = (e) => {
    const r = canvas.current.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e) => {
    e.preventDefault();
    canvas.current.setPointerCapture?.(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.arc(last.current.x, last.current.y, 1, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
  };
  const move = (e) => {
    if (!drawing.current) return;
    e.preventDefault();
    const p = pos(e);
    const ctx = canvas.current.getContext('2d');
    ctx.beginPath();
    ctx.moveTo(last.current.x, last.current.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
    if (empty) {
      setEmpty(false);
      onChange?.(false);
    }
  };
  const up = () => {
    drawing.current = false;
  };
  const clear = () => {
    const c = canvas.current;
    c.getContext('2d').clearRect(0, 0, c.width, c.height);
    setEmpty(true);
    onChange?.(true);
  };

  useImperativeHandle(ref, () => ({ toDataURL: () => canvas.current.toDataURL('image/png'), isEmpty: () => empty, clear }), [empty]);

  return (
    <div>
      <div className="relative rounded-xl bg-white ring-2 ring-dashed ring-slate-300">
        <canvas
          ref={canvas}
          style={{ height, touchAction: 'none' }}
          className="block w-full cursor-crosshair rounded-xl"
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          onPointerCancel={up}
        />
        {empty && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-slate-400">Dealer signs here with finger</div>
        )}
        <div className="pointer-events-none absolute right-4 bottom-8 left-4 border-b border-slate-200" />
      </div>
      <div className="mt-1 flex justify-end">
        <button type="button" onClick={clear} disabled={empty} className="inline-flex items-center gap-1 text-xs font-bold text-slate-500 disabled:opacity-40">
          <Eraser className="h-3.5 w-3.5" /> Clear signature
        </button>
      </div>
    </div>
  );
});

export default SignaturePad;
