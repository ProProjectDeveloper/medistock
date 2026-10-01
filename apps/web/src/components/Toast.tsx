import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; message: string }
interface ToastApi { show(t: { kind: Kind; message: string }): void }

const Ctx = createContext<ToastApi>({ show: () => {} });

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const show = useCallback((t: { kind: Kind; message: string }) => {
    const id = ++seq.current;
    setItems((xs) => [...xs.slice(-2), { id, ...t }]);
    setTimeout(() => dismiss(id), t.kind === 'error' ? 6000 : 4000);
  }, [dismiss]);
  const api = useMemo(() => ({ show }), [show]);
  const icon = { success: <CheckCircle2 size={18} className="text-ok" />, error: <XCircle size={18} className="text-expired" />, info: <Info size={18} className="text-info" /> };
  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="fixed bottom-4 right-4 z-[60] flex w-[min(380px,calc(100vw-32px))] flex-col gap-2" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="animate-rise flex items-start gap-3 rounded-md border border-line bg-surface p-3 pr-2 shadow-overlay">
            <span className="mt-0.5 shrink-0">{icon[t.kind]}</span>
            <p className="flex-1 text-sm text-ink">{t.message}</p>
            <button className="rounded-sm p-1 text-ink-3 hover:bg-surface-2 hover:text-ink" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={16} />
            </button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export const useToast = () => useContext(Ctx);
