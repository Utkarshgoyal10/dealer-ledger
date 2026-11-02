import mongoose from 'mongoose';
import { Transaction } from '../models/Transaction.js';
import { Customer } from '../models/Customer.js';
import { User } from '../models/User.js';
import { AccessRequest } from '../models/AccessRequest.js';
import { CashClosing } from '../models/CashClosing.js';
import { LoginRequest } from '../models/LoginRequest.js';
import { addDays, istDateKey, istDayEnd, istDayStart, parseDateKey } from '../utils/dates.js';
import { computeBalances, round2 } from './ledger.js';

const TZ = 'Asia/Kolkata';
const oid = (id) => new mongoose.Types.ObjectId(String(id));

function blank() {
  return { sale: 0, return: 0, scheme: 0, cash: 0, bank: 0, count: 0 };
}

/** Totals grouped by any key (sales, returns, schemes, cash and bank payments). */
async function pivot(match, keyExpr) {
  const rows = await Transaction.aggregate([
    { $match: { deleted: false, ...match } },
    {
      $group: {
        _id: { k: keyExpr, type: '$type', mode: '$paymentMode' },
        amount: { $sum: '$amount' },
        count: { $sum: 1 },
      },
    },
  ]);
  const map = new Map();
  for (const r of rows) {
    const key = String(r._id.k);
    const o = map.get(key) || blank();
    o.count += r.count;
    if (r._id.type === 'payment') {
      if (r._id.mode === 'cash') o.cash += r.amount;
      else o.bank += r.amount;
    } else o[r._id.type] += r.amount;
    map.set(key, o);
  }
  for (const o of map.values()) {
    for (const k of Object.keys(o)) o[k] = round2(o[k]);
    o.netSale = round2(o.sale - o.return);
    o.collection = round2(o.cash + o.bank);
  }
  return map;
}

function sumRows(rows, keys) {
  const t = {};
  for (const k of keys) t[k] = round2(rows.reduce((s, r) => s + (Number(r[k]) || 0), 0));
  return t;
}

export function parseRange(q) {
  const today = istDayStart();
  const from = q.from ? parseDateKey(q.from) : parseDateKey(istDateKey(today).slice(0, 8) + '01');
  const to = istDayEnd(q.to ? parseDateKey(q.to) : today);
  return { from, to, label: `${istDateKey(from)} to ${istDateKey(to)}` };
}

const money = (key, label) => ({ key, label, type: 'money' });

// ---------------------------------------------------------------------------

export async function summaryReport(q) {
  const { from, to, label } = parseRange(q);
  const group = q.group === 'month' ? 'month' : 'day';
  const match = { date: { $gte: from, $lte: to } };
  if (q.worker) match.worker = oid(q.worker);
  const map = await pivot(match, { $dateToString: { format: group === 'month' ? '%Y-%m' : '%Y-%m-%d', date: '$date', timezone: TZ } });
  const rows = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([period, o]) => ({ period, ...o }));
  const cols = [
    { key: 'period', label: group === 'month' ? 'Month' : 'Date', type: 'text' },
    money('sale', 'Sales'),
    money('return', 'Returns'),
    money('netSale', 'Net sales'),
    money('scheme', 'Scheme'),
    money('cash', 'Cash'),
    money('bank', 'Bank'),
    money('collection', 'Total collected'),
  ];
  return {
    title: `Sales summary (${group === 'month' ? 'monthly' : 'daily'})`,
    subtitle: label,
    columns: cols,
    rows,
    totals: { period: 'Total', ...sumRows(rows, cols.slice(1).map((c) => c.key)) },
  };
}

export async function workersReport(q) {
  const { from, to, label } = parseRange(q);
  const map = await pivot({ date: { $gte: from, $lte: to } }, '$worker');
  const workers = await User.find({ role: 'worker' }).lean();
  const rows = workers.map((w) => ({
    worker: w.name + (w.active ? '' : ' (inactive)'),
    entries: map.get(String(w._id))?.count || 0,
    ...blank(),
    ...(map.get(String(w._id)) || { netSale: 0, collection: 0 }),
  }));
  const byAdmin = map.get('null');
  if (byAdmin) rows.push({ worker: 'Entered by admin', entries: byAdmin.count, ...byAdmin });
  rows.sort((a, b) => b.netSale - a.netSale);
  const cols = [
    { key: 'worker', label: 'Salesman', type: 'text' },
    { key: 'entries', label: 'Entries', type: 'number' },
    money('sale', 'Sales'),
    money('return', 'Returns'),
    money('netSale', 'Net sales'),
    money('scheme', 'Scheme'),
    money('cash', 'Cash'),
    money('bank', 'Bank'),
    money('collection', 'Total collected'),
  ];
  return {
    title: 'Salesman-wise performance',
    subtitle: label,
    columns: cols,
    rows,
    totals: { worker: 'Total', ...sumRows(rows, cols.slice(1).map((c) => c.key)) },
  };
}

/** Each dealer's outstanding balance as of a date (opening balance + sales − returns − payments − schemes) */
export async function outstandingReport(q) {
  const asOf = istDayEnd(q.asOf ? parseDateKey(q.asOf) : istDayStart());
  const cFilter = { deleted: false };
  if (q.route) cFilter.route = q.route;
  const customers = await Customer.find(cFilter).sort({ shopName: 1 }).lean();
  const balances = await computeBalances(customers, { upTo: asOf });

  let rows = customers.map((c) => ({ _id: c._id, shopName: c.shopName, route: c.route, balance: balances.get(String(c._id)) }));
  if (q.nonZero === 'true') rows = rows.filter((r) => Math.abs(r.balance) >= 0.01);
  rows.sort((a, b) => b.balance - a.balance);

  const cols = [
    { key: 'shopName', label: 'Dealer', type: 'text' },
    { key: 'route', label: 'Route', type: 'text' },
    money('balance', 'Outstanding'),
  ];
  return {
    title: 'Dealer outstanding',
    subtitle: `As of ${istDateKey(asOf)}`,
    columns: cols,
    rows,
    totals: { shopName: 'Total', ...sumRows(rows, ['balance']) },
  };
}

export async function collectionsReport(q) {
  const { from, to, label } = parseRange(q);
  const match = { type: 'payment', date: { $gte: from, $lte: to } };
  if (q.worker) match.worker = oid(q.worker);
  const map = await pivot(match, { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ } });
  const rows = [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, o]) => ({ date, ...o }));
  const cols = [
    { key: 'date', label: 'Date', type: 'text' },
    money('cash', 'Cash'),
    money('bank', 'Bank'),
    money('collection', 'Total collected'),
  ];
  return {
    title: 'Cash vs bank collections',
    subtitle: label + (q.worker ? '' : ' • all salesmen'),
    columns: cols,
    rows,
    totals: { date: 'Total', ...sumRows(rows, cols.slice(1).map((c) => c.key)) },
  };
}

export async function schemesReport(q) {
  const { from, to, label } = parseRange(q);
  const match = { deleted: false, type: 'scheme', date: { $gte: from, $lte: to } };
  if (q.worker) match.worker = oid(q.worker);
  const agg = await Transaction.aggregate([
    { $match: match },
    { $group: { _id: '$customer', amount: { $sum: '$amount' }, count: { $sum: 1 } } },
  ]);
  const customers = await Customer.find({ _id: { $in: agg.map((a) => a._id) } }).lean();
  const cm = new Map(customers.map((c) => [String(c._id), c]));
  const rows = agg
    .map((a) => {
      const c = cm.get(String(a._id));
      return { shopName: c?.shopName || '-', route: c?.route || '', count: a.count, amount: round2(a.amount) };
    })
    .sort((a, b) => b.amount - a.amount);
  const cols = [
    { key: 'shopName', label: 'Dealer', type: 'text' },
    { key: 'route', label: 'Route', type: 'text' },
    { key: 'count', label: 'Entries', type: 'number' },
    money('amount', 'Scheme amount'),
  ];
  return { title: 'Scheme payout', subtitle: label, columns: cols, rows, totals: { shopName: 'Total', ...sumRows(rows, ['count', 'amount']) } };
}

export async function returnsReport(q) {
  const { from, to, label } = parseRange(q);
  const match = { deleted: false, type: 'return', date: { $gte: from, $lte: to } };
  if (q.worker) match.worker = oid(q.worker);
  const items = await Transaction.find(match)
    .sort({ date: 1 })
    .populate('customer', 'shopName route')
    .populate('worker', 'name')
    .lean();
  const rows = items.map((t) => ({
    date: istDateKey(t.date),
    shopName: t.customer?.shopName || '-',
    route: t.customer?.route || '',
    worker: t.worker?.name || '-',
    note: t.note,
    amount: t.amount,
  }));
  const cols = [
    { key: 'date', label: 'Date', type: 'text' },
    { key: 'shopName', label: 'Dealer', type: 'text' },
    { key: 'route', label: 'Route', type: 'text' },
    { key: 'worker', label: 'Salesman', type: 'text' },
    { key: 'note', label: 'Note', type: 'text' },
    money('amount', 'Amount'),
  ];
  return { title: 'Sale returns', subtitle: label, columns: cols, rows, totals: { date: 'Total', ...sumRows(rows, ['amount']) } };
}

export const REPORTS = {
  summary: summaryReport,
  workers: workersReport,
  outstanding: outstandingReport,
  collections: collectionsReport,
  schemes: schemesReport,
  returns: returnsReport,
};

// ---------------------------------------------------------------------------

export async function adminDashboard() {
  const today = istDayStart();
  const monthStart = parseDateKey(istDateKey(today).slice(0, 8) + '01');
  const weekStart = addDays(today, -6);

  const [todayMap, monthMap, trendMap, customers, pendingRequests, pendingClosings, pendingLogins] = await Promise.all([
    pivot({ date: today }, 'all'),
    pivot({ date: { $gte: monthStart, $lte: istDayEnd(today) } }, 'all'),
    pivot({ date: { $gte: weekStart, $lte: istDayEnd(today) } }, { $dateToString: { format: '%Y-%m-%d', date: '$date', timezone: TZ } }),
    Customer.find({ deleted: false }).select('shopName openingBalance route').lean(),
    AccessRequest.countDocuments({ status: 'pending' }),
    CashClosing.countDocuments({ status: 'submitted' }),
    LoginRequest.countDocuments({ status: 'pending', dateKey: istDateKey(today) }),
  ]);

  const balances = await computeBalances(customers);
  let totalOutstanding = 0;
  for (const v of balances.values()) if (v > 0) totalOutstanding += v;

  const topAgg = await Transaction.aggregate([
    { $match: { deleted: false, type: 'sale', date: { $gte: monthStart } } },
    { $group: { _id: '$customer', amount: { $sum: '$amount' } } },
    { $sort: { amount: -1 } },
    { $limit: 5 },
  ]);
  const cmap = new Map(customers.map((c) => [String(c._id), c]));
  const topCustomers = topAgg.map((a) => ({
    _id: a._id,
    shopName: cmap.get(String(a._id))?.shopName || '-',
    amount: round2(a.amount),
    balance: balances.get(String(a._id)) ?? 0,
  }));

  const topDue = [...customers]
    .map((c) => ({ _id: c._id, shopName: c.shopName, route: c.route, balance: balances.get(String(c._id)) }))
    .filter((c) => c.balance > 0)
    .sort((a, b) => b.balance - a.balance)
    .slice(0, 5);

  const trend = [];
  for (let i = 0; i < 7; i++) {
    const key = istDateKey(addDays(weekStart, i));
    const o = trendMap.get(key) || blank();
    trend.push({ date: key, sale: o.sale, collection: round2(o.cash + o.bank) });
  }

  const pick = (m) => m.get('all') || { ...blank(), netSale: 0, collection: 0 };
  return {
    today: pick(todayMap),
    month: pick(monthMap),
    totalOutstanding: round2(totalOutstanding),
    customerCount: customers.length,
    pendingRequests,
    pendingClosings,
    pendingLogins,
    topCustomers,
    topDue,
    trend,
  };
}
