import { useEffect, useState } from 'react';
import ConfirmationView, { CONFIRM_STATUS } from '../components/ConfirmationView';
import { Link, useNavigate, useParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import { ArrowLeft, Pencil, Plus, KeyRound, Trash2, Lock, Eye, EyeOff, PenLine, ShoppingCart, Undo2, Wallet, Gift } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Balance, Button, Card, Chip, Empty, ErrorBox, Field, Input, Spinner, cx } from '../components/ui';
import TxnForm from '../components/TxnForm';
import CustomerForm from '../components/CustomerForm';
import RequestForm from '../components/RequestForm';
import { canEditTxn, fmtDate, fmtDateTime, inr, TYPE_META, txnDetail, istKey } from '../utils/format';

const ROW_META = {
  sale: { label: 'Sale', icon: ShoppingCart, bg: 'bg-blue-50', fg: 'text-blue-700' },
  return: { label: 'Sale return', icon: Undo2, bg: 'bg-amber-50', fg: 'text-amber-700' },
  payment: { label: 'Payment', icon: Wallet, bg: 'bg-emerald-50', fg: 'text-emerald-700' },
  scheme: { label: 'Scheme', icon: Gift, bg: 'bg-violet-50', fg: 'text-violet-700' },
};

/** [[dateKey, entries], ...] keeping the given order */
function groupByDate(list) {
  const groups = [];
  for (const t of list) {
    const k = istKey(t.date);
    if (!groups.length || groups[groups.length - 1][0] !== k) groups.push([k, []]);
    groups[groups.length - 1][1].push(t);
  }
  return groups;
}

export default function CustomerDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [range, setRange] = useState({ from: '', to: '' });
  const ledger = useApi(`/customers/${id}/ledger`, isAdmin ? { from: range.from || undefined, to: range.to || undefined } : undefined);
  const [txnForm, setTxnForm] = useState({ open: false });
  const [editing, setEditing] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const confirm = useApi(`/confirmations/status/${id}`);
  const [viewingConf, setViewingConf] = useState(null);

  // Salesman: balance and entries stay covered until tapped, so a dealer looking at the
  // phone sees nothing by accident. Covered again on another dealer / when the app is left.
  const [reveal, setReveal] = useState({ bal: false, entries: false });
  useEffect(() => setReveal({ bal: false, entries: false }), [id]);
  useEffect(() => {
    const cover = () => document.hidden && setReveal({ bal: false, entries: false });
    document.addEventListener('visibilitychange', cover);
    return () => document.removeEventListener('visibilitychange', cover);
  }, []);

  if (ledger.error) return <ErrorBox>{ledger.error}</ErrorBox>;
  if (!ledger.data) return <Spinner />;
  const { customer: c, rows, broughtForward, currentBalance, visibility, balanceHidden } = ledger.data;
  const showBal = !balanceHidden && (isAdmin || reveal.bal);
  const showEntries = isAdmin || reveal.entries;

  const remove = async () => {
    // A dealer with money due (or advance) can't be deleted — the server blocks it too
    if (Math.abs(currentBalance || 0) >= 0.01) {
      toast.error(
        `Can't delete: ${c.shopName} ${currentBalance > 0 ? 'still owes' : 'has advance of'} ${inr(Math.abs(currentBalance))}. Settle the balance to ₹0 first.`,
        { duration: 6000 }
      );
      return;
    }
    if (!window.confirm(`Delete dealer "${c.shopName}"? Their entries stay in reports and the audit log.`)) return;
    try {
      await api.delete(`/customers/${id}`);
      toast.success('Dealer deleted');
      nav('/customers');
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <button onClick={() => nav(-1)} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-600 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Back
      </button>

      <Card className="mb-4 p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-lg font-bold">{c.shopName}</h1>
            <div className="mt-0.5 text-sm text-slate-600">{c.route || 'No route'}</div>
            {showBal && <div className="mt-0.5 text-xs text-slate-500">Opening balance {inr(c.openingBalance)}</div>}
            {isAdmin && c.hideBalance && (
              <Chip className="mt-1.5 bg-amber-50 text-amber-800 ring-amber-200">
                <EyeOff className="mr-1 h-3 w-3" /> Balance hidden from salesmen
              </Chip>
            )}
          </div>
          {balanceHidden ? (
            <div className="flex items-center gap-1.5 text-right text-xs text-slate-500">
              <EyeOff className="h-4 w-4" /> Balance hidden by admin
            </div>
          ) : showBal ? (
            <div className="text-right">
              <div className="text-xs text-slate-500">Outstanding</div>
              <Balance value={currentBalance} className="text-2xl" />
              {!isAdmin && (
                <button
                  type="button"
                  onClick={() => setReveal((r) => ({ ...r, bal: false }))}
                  className="mt-0.5 flex w-full items-center justify-end gap-1 text-xs font-bold text-slate-500"
                >
                  <EyeOff className="h-3.5 w-3.5" /> Hide
                </button>
              )}
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setReveal((r) => ({ ...r, bal: true }))}
              className="rounded-lg px-2 py-1 text-right active:bg-slate-100"
            >
              <div className="text-xs text-slate-500">Outstanding</div>
              <div className="text-2xl font-bold tracking-widest text-slate-300">₹ •••••</div>
              <div className="inline-flex items-center gap-1 text-xs font-bold text-indigo-700">
                <Eye className="h-3.5 w-3.5" /> Show
              </div>
            </button>
          )}
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button size="sm" onClick={() => setTxnForm({ open: true })}>
            <Plus className="h-4 w-4" /> New entry
          </Button>
          {!isAdmin && (
            <Button size="sm" variant="secondary" onClick={() => setRequesting(true)}>
              <KeyRound className="h-4 w-4" /> Request older data
            </Button>
          )}
          {isAdmin && (
            <>
              <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
                <Pencil className="h-4 w-4" /> Edit
              </Button>
              <Button size="sm" variant="ghost" className="text-rose-600" onClick={remove}>
                <Trash2 className="h-4 w-4" /> Delete
              </Button>
            </>
          )}
        </div>
      </Card>

      {confirm.data && (
        <ConfirmStrip
          s={confirm.data}
          isAdmin={isAdmin}
          balanceHidden={balanceHidden}
          onSign={() => nav(`/customers/${id}/confirm`)}
          onView={() => setViewingConf(confirm.data.last._id)}
          onSkip={async (skip) => {
            try {
              await api.post('/confirmations/skip', { customer: id, skip });
              toast.success(skip ? 'Skipped for this month' : 'Skip removed');
              confirm.reload();
            } catch (e) {
              toast.error(errMsg(e));
            }
          }}
        />
      )}
      <ConfirmationView id={viewingConf} onClose={() => setViewingConf(null)} onChanged={confirm.reload} />

      {visibility && (
        <div className="mb-3 flex items-start gap-2 rounded-lg bg-indigo-50 px-3 py-2 text-xs text-indigo-900 ring-1 ring-indigo-100">
          <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            Showing entries from {fmtDate(visibility.windowStart)}.
            {visibility.grants.map((g, i) => (
              <div key={i}>
                Extra access: {fmtDate(g.fromDate)} – {fmtDate(g.toDate)} (until {fmtDateTime(g.accessExpiresAt)})
              </div>
            ))}{' '}
            <Link to="/requests" className="font-semibold underline">
              Need older?
            </Link>
          </div>
        </div>
      )}

      {isAdmin && (
        <div className="mb-3 flex flex-wrap items-end gap-2">
          <Field label="From">
            <Input type="date" value={range.from} onChange={(e) => setRange({ ...range, from: e.target.value })} />
          </Field>
          <Field label="To">
            <Input type="date" value={range.to} onChange={(e) => setRange({ ...range, to: e.target.value })} />
          </Field>
          {(range.from || range.to) && (
            <Button variant="ghost" size="sm" onClick={() => setRange({ from: '', to: '' })}>
              Clear
            </Button>
          )}
        </div>
      )}

      <Card>
        {/* PC: starting balance on top (table below runs oldest → newest) */}
        {showBal && showEntries && (
          <div className={cx('items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500', rows.length ? 'hidden md:flex' : 'flex')}>
            <span>{rows.length ? 'Balance brought forward' : 'Balance'}</span>
            <Balance value={broughtForward} />
          </div>
        )}
        {!showEntries ? (
          <button
            type="button"
            onClick={() => setReveal((r) => ({ ...r, entries: true }))}
            className="flex w-full flex-col items-center gap-1 px-4 py-8 text-center active:bg-slate-50"
          >
            <EyeOff className="h-6 w-6 text-slate-300" />
            <span className="text-sm text-slate-500">Entries hidden</span>
            <span className="inline-flex items-center gap-1 text-sm font-bold text-indigo-700">
              <Eye className="h-4 w-4" /> Show entries{rows.length ? ` (${rows.length})` : ''}
            </span>
          </button>
        ) : rows.length === 0 ? (
          <Empty>No entries in this period</Empty>
        ) : (
          <>
            {!isAdmin && (
              <button
                type="button"
                onClick={() => setReveal((r) => ({ ...r, entries: false }))}
                className="flex w-full items-center justify-between border-b border-slate-100 px-4 py-2 text-xs font-bold text-slate-500 md:hidden"
              >
                <span>{rows.length} entries</span>
                <span className="flex items-center gap-1">
                  <EyeOff className="h-3.5 w-3.5" /> Hide entries
                </span>
              </button>
            )}
            {/* Phone: newest first, grouped by date, starting balance at the bottom */}
            <div className="md:hidden">
              {groupByDate([...rows].reverse()).map(([day, items]) => (
                <div key={day}>
                  <div className="bg-slate-50 px-4 py-1.5 text-xs font-bold text-slate-600">{fmtDate(day)}</div>
                  <ul className="divide-y divide-slate-100">
                    {items.map((t) => {
                      const editable = canEditTxn(user, t);
                      const m = ROW_META[t.type];
                      const plus = t.type === 'sale';
                      return (
                        <li
                          key={t._id}
                          onClick={() => editable && setTxnForm({ open: true, txn: t })}
                          className={cx('flex items-center gap-3 px-4 py-3', editable && 'cursor-pointer active:bg-slate-50')}
                        >
                          <span className={cx('flex h-9 w-9 shrink-0 items-center justify-center rounded-full', m.bg)}>
                            <m.icon className={cx('h-4 w-4', m.fg)} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="text-sm font-bold text-slate-900">
                              {m.label}
                              {t.type === 'payment' && t.paymentMode && <span className="font-semibold text-slate-500"> · {t.paymentMode === 'cash' ? 'Cash' : 'Bank'}</span>}
                            </div>
                            {t.note && <div className="truncate text-xs text-slate-500">{t.note}</div>}
                          </div>
                          <div className="shrink-0 text-right tabular">
                            <div className={cx('text-sm font-bold', plus ? 'text-slate-900' : 'text-emerald-700')}>
                              {plus ? '+' : '−'}
                              {inr(t.amount)}
                            </div>
                            {showBal && <div className="text-[11px] text-slate-500">Bal {inr(t.balance)}</div>}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
              {showBal && (
                <div className="flex items-center justify-between border-t border-slate-200 bg-slate-50 px-4 py-2.5 text-xs text-slate-600">
                  <span>Balance before {fmtDate(rows[0].date)}</span>
                  <Balance value={broughtForward} />
                </div>
              )}
            </div>

            {/* Desktop table */}
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500">
                  <tr>
                    <th className="px-4 py-2 text-left font-semibold">Date</th>
                    <th className="px-4 py-2 text-left font-semibold">Type</th>
                    <th className="px-4 py-2 text-left font-semibold">Details</th>
                    <th className="px-4 py-2 text-left font-semibold">By</th>
                    <th className="px-4 py-2 text-right font-semibold">Debit (+)</th>
                    <th className="px-4 py-2 text-right font-semibold">Credit (−)</th>
                    {showBal && <th className="px-4 py-2 text-right font-semibold">Balance</th>}
                  </tr>
                </thead>
                <tbody className="tabular">
                  {rows.map((t) => {
                    const editable = canEditTxn(user, t);
                    return (
                      <tr key={t._id} onClick={() => editable && setTxnForm({ open: true, txn: t })} className={cx('border-t border-slate-100', editable && 'cursor-pointer hover:bg-slate-50')}>
                        <td className="px-4 py-2 whitespace-nowrap">{fmtDate(t.date)}</td>
                        <td className="px-4 py-2">
                          <Chip className={TYPE_META[t.type].chip}>{TYPE_META[t.type].label}</Chip>
                        </td>
                        <td className="max-w-64 truncate px-4 py-2 text-slate-600">{txnDetail(t)}</td>
                        <td className="px-4 py-2 text-slate-600">{t.createdBy?.name}</td>
                        <td className="px-4 py-2 text-right">{t.debit ? inr(t.debit) : ''}</td>
                        <td className="px-4 py-2 text-right text-emerald-700">{t.credit ? inr(t.credit) : ''}</td>
                        {showBal && <td className="px-4 py-2 text-right font-semibold">{inr(t.balance)}</td>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </Card>

      <TxnForm open={txnForm.open} txn={txnForm.txn} customerId={id} onClose={() => setTxnForm({ open: false })} onSaved={ledger.reload} />
      {isAdmin && <CustomerForm open={editing} customer={c} onClose={() => setEditing(false)} onSaved={ledger.reload} />}
      {!isAdmin && <RequestForm open={requesting} customerId={id} onClose={() => setRequesting(false)} />}
    </div>
  );
}

/** "This month: confirmed / due / skipped" + Get confirmation button on the dealer page */
function ConfirmStrip({ s, isAdmin, balanceHidden, onSign, onView, onSkip }) {
  const meta = CONFIRM_STATUS[s.monthStatus];
  const canSign = isAdmin || !balanceHidden;
  return (
    <div className="mb-3 rounded-xl bg-white px-3 py-2.5 ring-1 ring-slate-200">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <Chip className={meta.chip}>{meta.label}</Chip>
          {s.last && (
            <button type="button" onClick={onView} className="mt-1 block truncate text-left text-xs text-slate-500 underline">
              Last: {s.last.status === 'disputed' ? 'disputed' : s.last.rejectedAt ? 'rejected by admin' : s.last.approvedAt ? 'signed & approved' : 'signed'}{' '}
              {fmtDate(s.last.createdAt)} • {inr(s.last.closingBalance)}
            </button>
          )}
          {s.lockedAt && (
            <div className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <Lock className="h-3 w-3" /> Entries before {fmtDateTime(s.lockedAt)} are locked (dealer signed)
            </div>
          )}
        </div>
        {canSign && (
          <Button size="sm" variant={s.monthStatus === 'due' || s.monthStatus === 'disputed' ? 'primary' : 'secondary'} onClick={onSign}>
            <PenLine className="h-4 w-4" /> Get confirmation
          </Button>
        )}
      </div>
      {isAdmin && (s.monthStatus === 'due' || s.monthStatus === 'skipped') && (
        <button type="button" onClick={() => onSkip(s.monthStatus === 'due')} className="mt-1.5 text-xs font-bold text-slate-500 underline">
          {s.monthStatus === 'due' ? 'Skip confirmation this month' : 'Undo skip'}
        </button>
      )}
    </div>
  );
}
