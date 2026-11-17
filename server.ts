import express from 'express';
import fs from 'fs';
import { DatabaseSync } from 'node:sqlite';
import path from 'path';
import { fileURLToPath } from 'url';
import { phishingClassifier } from './src/ml/randomForest.ts';
import type { RiskLevel, ScanRecord } from './src/types/scan.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.resolve(__dirname, 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

const dbPath = path.join(dataDir, 'cybershield.db');
const db = new DatabaseSync(dbPath);

db.exec(`
  CREATE TABLE IF NOT EXISTS scans (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    url TEXT NOT NULL,
    normalized_url TEXT NOT NULL,
    hostname TEXT NOT NULL,
    anatomy_json TEXT NOT NULL,
    risk_level TEXT NOT NULL,
    risk_headline TEXT NOT NULL,
    phishing_probability REAL NOT NULL,
    phishing_votes INTEGER NOT NULL,
    legitimate_votes INTEGER NOT NULL,
    total_trees INTEGER NOT NULL,
    features_json TEXT NOT NULL,
    feature_descriptors_json TEXT NOT NULL,
    signals_json TEXT NOT NULL,
    recommendations_json TEXT NOT NULL,
    created_at TEXT NOT NULL
  );
`);

interface ScanDbRow {
  id: number;
  url: string;
  normalized_url: string;
  hostname: string;
  anatomy_json: string;
  risk_level: string;
  risk_headline: string;
  phishing_probability: number;
  phishing_votes: number;
  legitimate_votes: number;
  total_trees: number;
  features_json: string;
  feature_descriptors_json: string;
  signals_json: string;
  recommendations_json: string;
  created_at: string;
}

function rowToScanRecord(row: ScanDbRow): ScanRecord {
  return {
    id: row.id,
    url: row.url,
    normalizedUrl: row.normalized_url,
    hostname: row.hostname,
    anatomy: JSON.parse(row.anatomy_json),
    riskLevel: row.risk_level as RiskLevel,
    riskHeadline: row.risk_headline,
    phishingProbability: row.phishing_probability,
    treeVotes: {
      phishing: row.phishing_votes,
      legitimate: row.legitimate_votes,
      total: row.total_trees,
    },
    features: JSON.parse(row.features_json),
    featureDescriptors: JSON.parse(row.feature_descriptors_json),
    signals: JSON.parse(row.signals_json),
    recommendations: JSON.parse(row.recommendations_json),
    createdAt: row.created_at,
  };
}

const insertScanStmt = db.prepare(`
  INSERT INTO scans (
    url,
    normalized_url,
    hostname,
    anatomy_json,
    risk_level,
    risk_headline,
    phishing_probability,
    phishing_votes,
    legitimate_votes,
    total_trees,
    features_json,
    feature_descriptors_json,
    signals_json,
    recommendations_json,
    created_at
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const selectAllScansStmt = db.prepare(`
  SELECT * FROM scans ORDER BY id DESC LIMIT 500
`);

const selectScanByIdStmt = db.prepare(`
  SELECT * FROM scans WHERE id = ?
`);

const deleteScanByIdStmt = db.prepare(`
  DELETE FROM scans WHERE id = ?
`);

const deleteAllScansStmt = db.prepare(`
  DELETE FROM scans
`);

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json({ limit: '256kb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok' });
  });

  app.get('/api/model/metrics', (_req, res) => {
    res.json(phishingClassifier.getEvaluationMetrics());
  });

  app.post('/api/scan', (req, res) => {
    const rawUrl = typeof req.body?.url === 'string' ? req.body.url : '';
    try {
      const analysis = phishingClassifier.analyzeUrl(rawUrl);
      const createdAt = new Date().toISOString();

      const result = insertScanStmt.run(
        analysis.url,
        analysis.normalizedUrl,
        analysis.hostname,
        JSON.stringify(analysis.anatomy),
        analysis.riskLevel,
        analysis.riskHeadline,
        analysis.phishingProbability,
        analysis.treeVotes.phishing,
        analysis.treeVotes.legitimate,
        analysis.treeVotes.total,
        JSON.stringify(analysis.features),
        JSON.stringify(analysis.featureDescriptors),
        JSON.stringify(analysis.signals),
        JSON.stringify(analysis.recommendations),
        createdAt,
      );

      const insertedId = Number(result.lastInsertRowid);
      const saved: ScanRecord = {
        id: insertedId,
        ...analysis,
        createdAt,
      };

      res.status(201).json(saved);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to analyze the submitted URL.';
      res.status(400).json({ error: message });
    }
  });

  app.get('/api/scans', (_req, res) => {
    const rows = selectAllScansStmt.all() as unknown as ScanDbRow[];
    const scans = rows.map(rowToScanRecord);
    res.json({ scans });
  });

  app.get('/api/scans/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid scan ID.' });
      return;
    }
    const row = selectScanByIdStmt.get(id) as unknown as ScanDbRow | undefined;
    if (!row) {
      res.status(404).json({ error: 'Scan record not found.' });
      return;
    }
    res.json(rowToScanRecord(row));
  });

  app.delete('/api/scans/:id', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      res.status(400).json({ error: 'Invalid scan ID.' });
      return;
    }
    deleteScanByIdStmt.run(id);
    res.json({ deleted: true, id });
  });

  app.delete('/api/scans', (_req, res) => {
    deleteAllScansStmt.run();
    res.json({ cleared: true });
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distDir, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CyberShield AI server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start CyberShield AI server:', err);
  process.exit(1);
});
