import { useState } from 'react';
import { ShoppingCart, Undo2, Wallet, Gift } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import TxnForm from '../components/TxnForm';
import InstallApp from '../components/InstallApp';
import { fmtDate } from '../utils/format';

const ACTIONS = [
  { type: 'sale', label: 'Sale', icon: ShoppingCart, cls: 'bg-indigo-600 text-white hover:bg-indigo-700' },
  { type: 'payment', label: 'Payment', icon: Wallet, cls: 'bg-emerald-600 text-white hover:bg-emerald-700' },
  { type: 'return', label: 'Sale return', icon: Undo2, cls: 'bg-white text-amber-700 ring-1 ring-amber-200 hover:bg-amber-50' },
  { type: 'scheme', label: 'Scheme', icon: Gift, cls: 'bg-white text-violet-700 ring-1 ring-violet-200 hover:bg-violet-50' },
];

/** Worker home: just the four entry buttons. Today's totals & entries are on the "Today" tab. */
export default function WorkerHome() {
  const { user } = useAuth();
  const [form, setForm] = useState({ open: false });

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-xl font-bold">Hi, {user.name.split(' ')[0]}</h1>
        <p className="text-sm text-slate-500">{fmtDate(new Date())}</p>
      </div>

      <InstallApp />

      <div className="grid grid-cols-2 gap-3">
        {ACTIONS.map((a) => (
          <button
            key={a.type}
            onClick={() => setForm({ open: true, type: a.type })}
            className={`flex aspect-[4/3] flex-col items-center justify-center gap-2 rounded-2xl text-base font-bold shadow-sm transition-colors ${a.cls}`}
          >
            <a.icon className="h-8 w-8" />
            {a.label}
          </button>
        ))}
      </div>

      <TxnForm open={form.open} defaultType={form.type} onClose={() => setForm({ open: false })} />
    </div>
  );
}
