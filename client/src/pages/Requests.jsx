import { useState } from 'react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chip, Empty, ErrorBox, Field, Input, Modal, PageHeader, Segmented, Spinner, Textarea } from '../components/ui';
import RequestForm from '../components/RequestForm';
import { fmtDate, fmtDateTime, STATUS_CHIP } from '../utils/format';

function statusOf(r) {
  if (r.status === 'approved' && !r.isActive) return 'expired';
  return r.status;
}

export default function Requests() {
  const { user } = useAuth();
  const isAdmin = user.role === 'admin';
  const [tab, setTab] = useState(isAdmin ? 'pending' : '');
  const { data, loading, error, reload } = useApi('/access-requests', tab ? { status: tab } : undefined);
  const [creating, setCreating] = useState(false);
  const [review, setReview] = useState(null); // { req, action }

  return (
    <div>
      <PageHeader
        title={isAdmin ? 'Data access requests' : 'My data requests'}
        subtitle={isAdmin ? 'Workers asking to see data older than 30 days' : 'Ask admin to unlock entries older than 30 days for a dealer'}
        actions={
          !isAdmin && (
            <Button onClick={() => setCreating(true)}>
              <Plus className="h-4 w-4" /> New request
            </Button>
          )
        }
      />

      <div className="mb-3 max-w-md">
        <Segmented
          value={tab}
          onChange={setTab}
          options={[
            { value: 'pending', label: 'Pending' },
            { value: 'approved', label: 'Approved' },
            { value: 'rejected', label: 'Rejected' },
            { value: '', label: 'All' },
          ]}
        />
      </div>

      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty>No requests</Empty>
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((r) => {
              const st = statusOf(r);
              return (
                <li key={r._id} className="px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <Chip className={STATUS_CHIP[st]}>{st}</Chip>
                        <Link to={`/customers/${r.customer?._id}`} className="text-sm font-semibold hover:underline">
                          {r.customer?.shopName}
                        </Link>
                      </div>
                      <div className="mt-1 text-sm text-slate-700">
                        {fmtDate(r.fromDate)} → {fmtDate(r.toDate)}
                      </div>
                      <div className="mt-0.5 text-xs text-slate-500">
                        {isAdmin && <>{r.worker?.name} • </>}
                        Asked {fmtDateTime(r.createdAt)} • “{r.reason}”
                      </div>
                      {r.status !== 'pending' && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {r.status === 'approved' && r.isActive && <>Access until {fmtDateTime(r.accessExpiresAt)} • </>}
                          {r.reviewedBy?.name && <>By {r.reviewedBy.name}</>}
                          {r.adminNote && <> • “{r.adminNote}”</>}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && r.status === 'pending' && (
                        <>
                          <Button size="sm" variant="success" onClick={() => setReview({ req: r, action: 'approve' })}>
                            Approve
                          </Button>
                          <Button size="sm" variant="secondary" className="text-rose-600" onClick={() => setReview({ req: r, action: 'reject' })}>
                            Reject
                          </Button>
                        </>
                      )}
                      {isAdmin && r.isActive && (
                        <Button size="sm" variant="secondary" onClick={() => setReview({ req: r, action: 'revoke' })}>
                          Revoke
                        </Button>
                      )}
                      {!isAdmin && r.isActive && (
                        <Link to={`/customers/${r.customer?._id}`}>
                          <Button size="sm">View ledger</Button>
                        </Link>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>

      {!isAdmin && <RequestForm open={creating} onClose={() => setCreating(false)} onSaved={reload} />}
      {isAdmin && <ReviewModal review={review} onClose={() => setReview(null)} onDone={reload} />}
    </div>
  );
}

function ReviewModal({ review, onClose, onDone }) {
  const [days, setDays] = useState('3');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  if (!review) return null;
  const { req, action } = review;

  const submit = async () => {
    setSaving(true);
    setError('');
    try {
      await api.post(`/access-requests/${req._id}/${action}`, action === 'approve' ? { days: Number(days), adminNote: note } : { adminNote: note });
      toast.success(`Request ${action === 'approve' ? 'approved' : action === 'reject' ? 'rejected' : 'revoked'}`);
      setNote('');
      onDone();
      onClose();
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setSaving(false);
    }
  };

  const title = { approve: 'Approve request', reject: 'Reject request', revoke: 'Revoke access' }[action];
  return (
    <Modal
      open
      onClose={onClose}
      title={title}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant={action === 'approve' ? 'success' : 'danger'} loading={saving} onClick={submit}>
            {title.split(' ')[0]}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-semibold">
            {req.worker?.name} → {req.customer?.shopName}
          </div>
          <div className="text-slate-600">
            {fmtDate(req.fromDate)} → {fmtDate(req.toDate)}
          </div>
          <div className="mt-1 text-xs text-slate-500">“{req.reason}”</div>
        </div>
        {action === 'approve' && (
          <Field label="Allow access for (days)" hint="After this the worker can no longer see this range">
            <Input type="number" min="1" max="90" value={days} onChange={(e) => setDays(e.target.value)} />
          </Field>
        )}
        {action !== 'revoke' && (
          <Field label="Note to worker (optional)">
            <Textarea value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        )}
        <ErrorBox>{error}</ErrorBox>
      </div>
    </Modal>
  );
}
