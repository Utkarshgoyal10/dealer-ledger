import { useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, CheckCircle2, XCircle, ShoppingCart, Undo2, Wallet, Gift } from 'lucide-react';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Balance, Button, Card, ErrorBox, Field, Input, Spinner, Textarea, cx } from '../components/ui';
import SignaturePad from '../components/SignaturePad';
import { fmtDate, inr } from '../utils/format';

const META = {
  sale: { label: 'Sale', icon: ShoppingCart, bg: 'bg-blue-50', fg: 'text-blue-700' },
  return: { label: 'Sale return', icon: Undo2, bg: 'bg-amber-50', fg: 'text-amber-700' },
  payment: { label: 'Payment', icon: Wallet, bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  scheme: { label: 'Scheme', icon: Gift, bg: 'bg-violet-50', fg: 'text-violet-700' },
};

/** Screen shown to the dealer: statement since last confirmation → sign, or say what's wrong */
export default function ConfirmBalance() {
  const { id } = useParams();
  const nav = useNavigate();
  const st = useApi(`/confirmations/statement/${id}`);
  const pad = useRef(null);
  const [signed, setSigned] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState('check'); // check | dispute
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);

  if (st.error) return <ErrorBox>{st.error}</ErrorBox>;
  if (!st.data) return <Spinner />;
  const s = st.data;

  const save = async (status) => {
    setSaving(true);
    try {
      await api.post('/confirmations', {
        customer: id,
        status,
        signature: status === 'confirmed' ? pad.current.toDataURL() : undefined,
        signerName: name,
        note: status === 'disputed' ? note : '',
        expectedBalance: s.closingBalance,
      });
      toast.success(status === 'confirmed' ? 'Balance confirmed and signed ✓' : 'Dispute sent to admin');
      nav(`/customers/${id}`, { replace: true });
    } catch (e) {
      toast.error(errMsg(e));
      if (/balance changed/i.test(errMsg(e))) st.reload();
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-lg pb-6">
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="mb-3 p-4 text-center">
        <div className="text-xs font-bold tracking-wide text-slate-500 uppercase">Balance confirmation</div>
        <h1 className="mt-1 text-lg font-bold">{s.customer.shopName}</h1>
        <div className="text-sm text-slate-500">{s.customer.route}</div>
        <div className="mt-3 text-xs text-slate-500">Your balance today, {fmtDate(new Date())}</div>
        <Balance value={s.closingBalance} className="text-3xl" />
        <div className="mt-0.5 text-xs text-slate-500">{s.closingBalance > 0 ? 'to be paid' : s.closingBalance < 0 ? 'advance with us' : 'nothing due'}</div>
      </Card>

      <Card className="mb-3">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-sm">
          <span className="text-slate-600">Balance on {fmtDate(s.periodFrom)}</span>
          <Balance value={s.openingBalance} />
        </div>
        {s.entries.length === 0 ? (
          <div className="px-4 py-4 text-center text-sm text-slate-500">No entries since {fmtDate(s.periodFrom)}</div>
        ) : (
          <ul className="divide-y divide-slate-100">
            {s.entries.map((t, i) => {
              const m = META[t.type];
              const plus = t.type === 'sale';
              return (
                <li key={i} className="flex items-center gap-3 px-4 py-2.5">
                  <span className={cx('flex h-8 w-8 shrink-0 items-center justify-center rounded-full', m.bg)}>
                    <m.icon className={cx('h-4 w-4', m.fg)} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-bold">
                      {m.label}
                      {t.paymentMode && <span className="font-semibold text-slate-500"> · {t.paymentMode === 'cash' ? 'Cash' : 'Bank'}</span>}
                    </div>
                    <div className="text-xs text-slate-500">{fmtDate(t.date)}</div>
                  </div>
                  <div className="text-right tabular">
                    <div className={cx('text-sm font-bold', plus ? 'text-slate-900' : 'text-emerald-700')}>
                      {plus ? '+' : '−'}
                      {inr(t.amount)}
                    </div>
                    <div className="text-[11px] text-slate-500">Bal {inr(t.balance)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold">
          <span>Balance today</span>
          <Balance value={s.closingBalance} />
        </div>
      </Card>

      {mode === 'check' ? (
        <Card className="space-y-3 p-4">
          <p className="text-sm text-slate-700">
            I agree my balance on <b>{fmtDate(new Date())}</b> is <b>{inr(s.closingBalance)}</b>.
          </p>
          <SignaturePad ref={pad} onChange={(isEmpty) => setSigned(!isEmpty)} />
          <Field label="Name of person signing (optional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Rahul (owner)" />
          </Field>
          <Button className="w-full py-3" disabled={!signed} loading={saving} onClick={() => save('confirmed')}>
            <CheckCircle2 className="h-5 w-5" /> Balance is correct — save
          </Button>
          <Button className="w-full" variant="secondary" onClick={() => setMode('dispute')}>
            <XCircle className="h-5 w-5 text-rose-600" /> Balance is not correct
          </Button>
        </Card>
      ) : (
        <Card className="space-y-3 p-4">
          <Field label="What is wrong? (dealer says)">
            <Textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. ₹5,000 cash paid on 10 Nov is missing" autoFocus />
          </Field>
          <Field label="Dealer's name (optional)">
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Button className="w-full py-3" variant="danger" disabled={note.trim().length < 3} loading={saving} onClick={() => save('disputed')}>
            Send to admin
          </Button>
          <Button className="w-full" variant="ghost" onClick={() => setMode('check')}>
            Back to signing
          </Button>
        </Card>
      )}
    </div>
  );
}
