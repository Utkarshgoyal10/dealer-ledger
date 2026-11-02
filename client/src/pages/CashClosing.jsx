import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { AlertTriangle } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chip, Chips, Empty, ErrorBox, Field, Input, Modal, PageHeader, Segmented, Spinner, Stat, Textarea, cx } from '../components/ui';
import { canEditTxn, daysAgoKey, fmtDate, fmtDateTime, inr, STATUS_CHIP, todayKey } from '../utils/format';
import TxnForm from '../components/TxnForm';
import TxnList from '../components/TxnList';

export default function CashClosing() {
  const { user } = useAuth();
  return user.role === 'admin' ? <AdminClosings /> : <WorkerToday />;
}

/** Worker "Today" tab: today's totals, my recent entries (editable same day) and cash closing */
function WorkerToday() {
  const { user } = useAuth();
  const summary = useApi('/transactions/today-summary');
  const entries = useApi('/transactions', { mine: 'true', from: daysAgoKey(1), to: todayKey(), limit: 100 });
  const [form, setForm] = useState({ open: false });
  const [version, setVersion] = useState(0);
  const s = summary.data;

  const reload = () => {
    summary.reload();
    entries.reload();
    setVersion((v) => v + 1); // refresh cash closing numbers too
  };

  return (
    <div className="max-w-2xl">
      <PageHeader title="Today" subtitle={fmtDate(new Date())} />

      <h2 className="mb-2 text-sm font-bold text-slate-700">What I entered today</h2>
      {s ? (
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
          <Stat label="Sales" value={inr(s.sale)} tone="blue" />
          <Stat label="Returns" value={inr(s.return)} tone="amber" />
          <Stat label="Cash collected" value={inr(s.cash)} tone="green" />
          <Stat label="Bank collected" value={inr(s.bank)} tone="green" />
          <Stat label="Scheme" value={inr(s.scheme)} tone="violet" />
          <Stat label="Entries" value={s.entries} />
        </div>
      ) : (
        <Spinner />
      )}

      <h2 className="mb-2 text-sm font-bold text-slate-700">My entries (today &amp; yesterday)</h2>
      <p className="mb-2 text-xs text-slate-500">Tap an entry made today to correct or delete it.</p>
      <Card className="mb-6">
        {entries.loading && !entries.data ? (
          <Spinner />
        ) : entries.data?.items.length ? (
          <TxnList items={entries.data.items} canEdit={(t) => canEditTxn(user, t)} onSelect={(t) => setForm({ open: true, txn: t })} />
        ) : (
          <Empty>No entries yet</Empty>
        )}
      </Card>

      <WorkerClosing embedded version={version} />

      <TxnForm open={form.open} txn={form.txn} onClose={() => setForm({ open: false })} onSaved={reload} />
    </div>
  );
}

function Diff({ value }) {
  const v = Number(value || 0);
  if (Math.abs(v) < 0.01) return <span className="font-semibold text-emerald-700">Matches</span>;
  return <span className="font-semibold text-rose-700">{v > 0 ? `${inr(v)} extra` : `${inr(-v)} short`}</span>;
}

function WorkerClosing({ embedded, version = 0 }) {
  const today = useApi('/cash-closings/today', { v: version });
  const history = useApi('/cash-closings', { v: version });
  const [declared, setDeclared] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const t = today.data;
  useEffect(() => {
    if (t) {
      setDeclared(t.closing ? String(t.closing.declaredCash) : String(t.systemCash));
      setNote(t.closing?.note || '');
    }
  }, [t]);

  if (today.error) return <ErrorBox>{today.error}</ErrorBox>;
  if (!t) return <Spinner />;
  const verified = t.closing?.status === 'verified';
  const stale = t.closing && t.closing.status !== 'verified' && t.closing.systemCash !== t.systemCash;

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/cash-closings', { declaredCash: Number(declared || 0), note });
      toast.success('Cash closing submitted');
      today.reload();
      history.reload();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl">
      {embedded ? (
        <h2 className="mb-2 text-sm font-bold text-slate-700">Daily cash closing</h2>
      ) : (
        <PageHeader title="Daily cash closing" subtitle={`Today, ${fmtDate(new Date())}`} />
      )}

      <div className="mb-3 grid grid-cols-2 gap-2">
        <Stat label={`Cash in app (${t.cashCount} entries)`} value={inr(t.systemCash)} tone="green" />
        <Stat label={`Bank (${t.bankCount}) — not part of cash`} value={inr(t.bankTotal)} />
      </div>

      {t.closing && (
        <Card className="mb-3 p-3 text-sm">
          <div className="flex items-center justify-between">
            <span>Status</span>
            <Chip className={STATUS_CHIP[t.closing.status]}>{t.closing.status}</Chip>
          </div>
          <div className="mt-1 text-xs text-slate-500">
            Submitted {fmtDateTime(t.closing.updatedAt)} • declared {inr(t.closing.declaredCash)}
            {t.closing.reviewedBy && <> • reviewed by {t.closing.reviewedBy.name}</>}
            {t.closing.adminNote && <> • “{t.closing.adminNote}”</>}
          </div>
        </Card>
      )}

      {t.closing?.needsResubmit ? (
        <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <div>
            <b>Submit cash again.</b> Admin had verified today's closing, but you added a payment after that. Check the cash below and submit again.
          </div>
        </div>
      ) : (
        stale && (
          <div className="mb-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-900 ring-1 ring-amber-200">
            <AlertTriangle className="h-4 w-4 shrink-0" /> You added or changed cash entries after submitting. Please submit again.
          </div>
        )
      )}

      {!verified ? (
        <Card className="mb-6 p-4">
          <form onSubmit={submit} className="space-y-3">
            <Field label="Cash you are handing over (₹)">
              <Input type="number" inputMode="decimal" min="0" step="0.01" value={declared} onChange={(e) => setDeclared(e.target.value)} required />
            </Field>
            <div className="text-sm">
              Difference: <Diff value={Number(declared || 0) - t.systemCash} />
            </div>
            <Field label="Note (optional)">
              <Textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder="Explain any difference" />
            </Field>
            <ErrorBox>{error}</ErrorBox>
            <Button type="submit" loading={saving}>
              {t.closing ? 'Submit again' : 'Submit closing'}
            </Button>
          </form>
        </Card>
      ) : (
        <p className="mb-6 text-sm text-emerald-700">Today's closing is verified ✅. Your old entries are locked. You can still add new entries — if you add a payment, the closing re-opens and you'll need to submit cash again.</p>
      )}

      <h2 className="mb-2 text-sm font-bold text-slate-700">Previous closings</h2>
      <Card>
        {history.data?.length ? (
          <ul className="divide-y divide-slate-100">
            {history.data.map((c) => (
              <li key={c._id} className="flex items-center justify-between gap-2 px-4 py-2.5 text-sm">
                <div>
                  <div>{fmtDate(c.date)}</div>
                  <div className="text-xs text-slate-500">
                    Declared {inr(c.declaredCash)} • App {inr(c.systemCash)}
                  </div>
                </div>
                <Chip className={STATUS_CHIP[c.status]}>{c.status}</Chip>
              </li>
            ))}
          </ul>
        ) : (
          <Empty>No closings yet</Empty>
        )}
      </Card>
    </div>
  );
}

function AdminClosings() {
  const [status, setStatus] = useState('submitted');
  const [worker, setWorker] = useState('');
  const { data, loading, error, reload } = useApi('/cash-closings', { status: status || undefined, worker: worker || undefined });
  const workers = useApi('/users', { role: 'worker' });
  const [review, setReview] = useState(null);

  return (
    <div>
      <PageHeader title="Cash closings" subtitle="Verify the cash each worker hands over against what they entered" />
      <div className="mb-3 flex flex-wrap gap-2">
        <div className="w-full max-w-sm">
          <Segmented
            value={status}
            onChange={setStatus}
            options={[
              { value: 'submitted', label: 'To verify' },
              { value: 'verified', label: 'Verified' },
              { value: 'disputed', label: 'Disputed' },
              { value: '', label: 'All' },
            ]}
          />
        </div>
        <div className="w-full">
          <Chips value={worker} onChange={setWorker} scroll options={[{ value: '', label: 'All workers' }, ...(workers.data || []).map((w) => ({ value: w._id, label: w.name }))]} />
        </div>
      </div>

      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty>Nothing here</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((c) => (
              <li key={c._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{c.worker?.name}</span>
                    <span className="text-slate-500">{fmtDate(c.date)}</span>
                    <Chip className={STATUS_CHIP[c.status]}>{c.status}</Chip>
                    {c.reopenCount > 0 && <Chip className="bg-amber-50 text-amber-800 ring-amber-300">Re-opened{c.reopenCount > 1 ? ` ×${c.reopenCount}` : ''}</Chip>}
                  </div>
                  {c.needsResubmit && (
                    <div className="mt-1 text-xs font-semibold text-amber-700">
                      ⏳ Worker added a payment after you verified ({fmtDateTime(c.reopenedAt)}). Waiting for them to submit cash again.
                    </div>
                  )}
                  <div className="mt-1 text-xs text-slate-600 tabular">
                    Declared <b>{inr(c.declaredCash)}</b> • App {inr(c.systemCash)} • <Diff value={c.difference} /> • Bank {c.bankCount} ({inr(c.bankTotal)})
                  </div>
                  {c.changedSinceSubmit && (
                    <div className="mt-1 text-xs font-semibold text-amber-700">⚠ Entries changed after submit — app cash is now {inr(c.currentSystemCash)}</div>
                  )}
                  {(c.note || c.adminNote) && (
                    <div className="mt-0.5 text-xs text-slate-500">
                      {c.note && <>Worker: “{c.note}” </>}
                      {c.adminNote && <>Admin: “{c.adminNote}”</>}
                    </div>
                  )}
                </div>
                {c.status !== 'verified' && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="success" onClick={() => setReview({ c, status: 'verified' })}>
                      Verify
                    </Button>
                    {c.status !== 'disputed' && (
                      <Button size="sm" variant="secondary" className="text-rose-600" onClick={() => setReview({ c, status: 'disputed' })}>
                        Dispute
                      </Button>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
      <ReviewClosing review={review} onClose={() => setReview(null)} onDone={reload} />
    </div>
  );
}

function ReviewClosing({ review, onClose, onDone }) {
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!review) return null;
  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/cash-closings/${review.c._id}/review`, { status: review.status, adminNote: note });
      toast.success(review.status === 'verified' ? 'Verified' : 'Marked disputed');
      setNote('');
      onDone();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      title={review.status === 'verified' ? 'Verify cash closing' : 'Dispute cash closing'}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={review.status === 'verified' ? 'success' : 'danger'} loading={saving} onClick={submit}>
            {review.status === 'verified' ? 'Verify' : 'Dispute'}
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <p>
          {review.c.worker?.name} • {fmtDate(review.c.date)} • declared <b>{inr(review.c.declaredCash)}</b>, app shows {inr(review.c.systemCash)}.
        </p>
        {review.status === 'verified' && <p className={cx('text-xs text-slate-500')}>After verifying, the worker can no longer edit that day's entries.</p>}
        <Field label="Note (optional)">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
