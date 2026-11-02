import { useState } from 'react';
import toast from 'react-hot-toast';
import { Plus } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useApi } from '../hooks/useApi';
import { api, errMsg } from '../api';
import { Button, Card, Chip, Empty, ErrorBox, Field, Input, Modal, PageHeader, Segmented, Spinner } from '../components/ui';
import { fmtDateTime, ROLE_LABEL } from '../utils/format';

export default function Workers() {
  const { user: me } = useAuth();
  const { data, loading, error, reload } = useApi('/users');
  const [modal, setModal] = useState(null); // {mode: 'create'|'edit'|'password', user}

  const toggle = async (u) => {
    const verb = u.active ? 'Deactivate' : 'Activate';
    if (!window.confirm(`${verb} ${u.name}?${u.active ? ' They will be logged out immediately.' : ''}`)) return;
    try {
      await api.patch(`/users/${u._id}`, { active: !u.active });
      toast.success(`${u.name} ${u.active ? 'deactivated' : 'activated'}`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <div>
      <PageHeader
        title="Users"
        subtitle="Salesmen need admin approval every day to log in. Admin stays logged in for 7 days."
        actions={
          <Button onClick={() => setModal({ mode: 'create' })}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />
      <ErrorBox>{error}</ErrorBox>
      <Card>
        {loading && !data ? (
          <Spinner />
        ) : !data?.length ? (
          <Empty />
        ) : (
          <ul className="divide-y divide-slate-100">
            {data.map((u) => (
              <li key={u._id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold">{u.name}</span>
                    <Chip className={u.role === 'admin' ? 'bg-indigo-50 text-indigo-700 ring-indigo-200' : undefined}>{ROLE_LABEL[u.role] || u.role}</Chip>
                    {!u.active && <Chip className="bg-rose-50 text-rose-700 ring-rose-200">inactive</Chip>}
                  </div>
                  <div className="mt-0.5 text-xs text-slate-500">
                    @{u.username}
                    {' '}• last login {fmtDateTime(u.lastLoginAt)}
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'edit', user: u })}>
                    Edit
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => setModal({ mode: 'password', user: u })}>
                    Reset password
                  </Button>
                  {u._id !== me._id && (
                    <Button size="sm" variant={u.active ? 'ghost' : 'success'} className={u.active ? 'text-rose-600' : ''} onClick={() => toggle(u)}>
                      {u.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
      {modal && <UserModal {...modal} onClose={() => setModal(null)} onDone={reload} />}
    </div>
  );
}

function UserModal({ mode, user, onClose, onDone }) {
  const [f, setF] = useState({ name: user?.name || '', username: user?.username || '', password: '', role: user?.role || 'worker' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k) => (e) => setF((s) => ({ ...s, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      if (mode === 'create') await api.post('/users', f);
      else if (mode === 'edit') await api.patch(`/users/${user._id}`, { name: f.name });
      else await api.post(`/users/${user._id}/reset-password`, { password: f.password });
      toast.success(mode === 'create' ? 'User created' : mode === 'edit' ? 'Saved' : 'Password reset. Share it with the user.');
      onDone();
      onClose();
    } catch (err) {
      setError(errMsg(err));
    } finally {
      setSaving(false);
    }
  };

  const title = { create: 'Add user', edit: `Edit ${user?.name}`, password: `Reset password — ${user?.name}` }[mode];
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
          <Button type="submit" form="user-form" loading={saving}>
            Save
          </Button>
        </>
      }
    >
      <form id="user-form" onSubmit={submit} className="space-y-3">
        {mode !== 'password' && (
          <>
            <Field label="Name">
              <Input value={f.name} onChange={set('name')} required autoFocus />
            </Field>
            {mode === 'create' && (
              <Field label="Username (used to log in)" hint="Letters, numbers, dot, dash or underscore">
                <Input value={f.username} onChange={set('username')} autoCapitalize="none" minLength={3} required />
              </Field>
            )}
            {mode === 'create' && (
              <Field as="div" label="Role" hint={f.role === 'admin' ? 'Admin has full access to everything.' : 'Salesman needs your approval to log in each day.'}>
                <Segmented
                  value={f.role}
                  onChange={(v) => setF((s) => ({ ...s, role: v }))}
                  options={[
                    { value: 'worker', label: 'Salesman' },
                    { value: 'admin', label: 'Admin' },
                  ]}
                />
              </Field>
            )}
          </>
        )}
        {mode !== 'edit' && (
          <Field label={mode === 'create' ? 'Password' : 'New password'} hint="At least 6 characters. Resetting logs the user out of all devices.">
            <Input type="text" value={f.password} onChange={set('password')} minLength={6} required autoComplete="off" />
          </Field>
        )}
        <ErrorBox>{error}</ErrorBox>
      </form>
    </Modal>
  );
}
