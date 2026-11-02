import { Router } from 'express';
import { adminOnly } from '../middleware/auth.js';
import { REPORTS, adminDashboard } from '../services/reports.js';
import { sendExcel, sendPdf } from '../services/exporter.js';
import { notFound } from '../utils/http.js';

const router = Router();
router.use(adminOnly);

router.get('/dashboard', async (req, res) => {
  res.json(await adminDashboard());
});

router.get('/:name', async (req, res) => {
  const build = REPORTS[req.params.name];
  if (!build) throw notFound('Unknown report');
  const report = await build(req.query);
  if (req.query.format === 'xlsx') return sendExcel(res, report);
  if (req.query.format === 'pdf') return sendPdf(res, report);
  res.json(report);
});

export default router;
