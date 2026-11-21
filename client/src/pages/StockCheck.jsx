import { useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Minus, Plus, Search, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Balance, Button, Card, Empty, ErrorBox, Field, Spinner, Textarea, cx } from '../components/ui';
import { inr } from '../utils/format';

/** Salesman counts itel phones at the shop → stock value vs outstanding */
export default function StockCheck() {
  const { id } = useParams();
  const nav = useNavigate();
  const dealer = useApi(`/customers/${id}`);
  const products = useApi('/products');
  const [qty, setQty] = useState({});
  const [q, setQ] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState(null);

  const list = useMemo(() => {
    const w = q.trim().toLowerCase();
    return (products.data || []).filter((p) => !w || p.name.toLowerCase().includes(w));
  }, [products.data, q]);
  const priceOf = useMemo(() => new Map((products.data || []).map((p) => [p._id, p.price])), [products.data]);
  const totalQty = Object.values(qty).reduce((s, n) => s + (n || 0), 0);
  const stockValue = Object.entries(qty).reduce((s, [pid, n]) => s + (priceOf.get(pid) || 0) * (n || 0), 0);

  if (dealer.error || products.error) return <ErrorBox>{dealer.error || products.error}</ErrorBox>;
  if (!dealer.data || !products.data) return <Spinner />;
  const d = dealer.data;
  if (d.balanceHidden) return <ErrorBox>This dealer's stock check is handled by admin.</ErrorBox>;
  const outstanding = d.balance ?? 0;
  const gap = outstanding - stockValue;

  const setN = (pid, n) => setQty((m) => ({ ...m, [pid]: Math.max(0, Math.min(10000, Number.isFinite(n) ? n : 0)) }));

  const save = async () => {
    setSaving(true);
    try {
      const r = await api.post('/stock-checks', {
        customer: id,
        items: Object.entries(qty).filter(([, n]) => n > 0).map(([product, n]) => ({ product, qty: n })),
        note,
      });
      setResult(r.data);
      toast.success('Stock check saved');
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  // ---------- after saving: clear result for the salesman ----------
  if (result) {
    const short = result.gap > 0;
    return (
      <div className="mx-auto max-w-lg">
        <Card className={cx('p-5 text-center', short ? 'bg-rose-50 ring-rose-200' : 'bg-emerald-50 ring-emerald-200')}>
          {short ? <AlertTriangle className="mx-auto h-10 w-10 text-rose-600" /> : <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />}
          <div className="mt-2 text-sm font-bold text-slate-700">{d.shopName}</div>
          <div className={cx('mt-1 text-2xl font-bold', short ? 'text-rose-700' : 'text-emerald-700')}>
            {short ? `Short by ${inr(result.gap)}` : 'Stock covers outstanding'}
          </div>
          {short && <div className="mt-1 text-sm text-rose-900">Collect at least {inr(result.gap)} from the dealer.</div>}
          <div className="mt-4 grid grid-cols-2 gap-2 text-left text-sm">
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Stock ({result.totalQty} phones)</div>
              <div className="font-bold tabular">{inr(result.stockValue)}</div>
            </div>
            <div className="rounded-lg bg-white p-2.5 ring-1 ring-slate-200">
              <div className="text-xs text-slate-500">Outstanding</div>
              <div className="font-bold tabular">{inr(result.outstanding)}</div>
            </div>
          </div>
        </Card>
        <Button className="mt-3 w-full py-3" onClick={() => nav(`/customers/${id}`, { replace: true })}>
          Back to dealer
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg pb-40">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>
      <h1 className="text-lg font-bold">Stock check</h1>
      <div className="mb-3 text-sm text-slate-500">
        {d.shopName} • count itel phones on the shelf
      </div>

      <div className="relative mb-2">
        <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search model…"
          className="block w-full rounded-lg bg-white py-2.5 pr-3 pl-9 text-sm ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
        />
      </div>

      <Card>
        {products.data.length === 0 ? (
          <Empty>No models yet. Ask admin to add models and prices.</Empty>
        ) : list.length === 0 ? (
          <Empty>No model matches "{q}"</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {list.map((p) => {
              const n = qty[p._id] || 0;
              return (
                <li key={p._id} className={cx('flex items-center gap-2 px-3 py-2.5', n > 0 && 'bg-indigo-50/50')}>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{p.name}</div>
                    <div className="text-xs text-slate-500 tabular">
                      {inr(p.price)}
                      {n > 0 && <span className="font-semibold text-slate-700"> × {n} = {inr(p.price * n)}</span>}
                    </div>
                  </div>
                  <button type="button" onClick={() => setN(p._id, n - 1)} disabled={!n} className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700 disabled:opacity-30" aria-label="Less">
                    <Minus className="h-4 w-4" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="0"
                    value={n || ''}
                    placeholder="0"
                    onChange={(e) => setN(p._id, parseInt(e.target.value, 10))}
                    className="w-12 rounded-lg py-1.5 text-center text-sm font-bold ring-1 ring-slate-300 focus:ring-2 focus:ring-indigo-500 focus:outline-none"
                  />
                  <button type="button" onClick={() => setN(p._id, n + 1)} className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-600 text-white" aria-label="More">
                    <Plus className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      <Field label="Note (optional)" className="mt-3">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. 2 phones in repair" />
      </Field>

      {/* Live result bar above the bottom menu */}
      <div className="fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+56px)] z-30 border-t border-slate-200 bg-white px-4 py-2.5 shadow-lg md:bottom-0">
        <div className="mx-auto max-w-lg">
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Stock ({totalQty} phones)</span>
            <span className="font-bold tabular">{inr(stockValue)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-600">Outstanding</span>
            <Balance value={outstanding} />
          </div>
          <div className={cx('mt-1 flex items-center justify-between text-sm font-bold', gap > 0 ? 'text-rose-700' : 'text-emerald-700')}>
            <span>{gap > 0 ? 'Short — collect' : 'Covered'}</span>
            <span className="tabular">{gap > 0 ? inr(gap) : '✓'}</span>
          </div>
          <Button className="mt-2 w-full" loading={saving} onClick={save}>
            Save stock check
          </Button>
        </div>
      </div>
    </div>
  );
}
