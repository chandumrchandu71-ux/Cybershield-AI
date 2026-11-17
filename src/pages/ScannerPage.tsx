import { ArrowRight, Download, Search, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { RiskStatusLabel } from '../components/RiskVisuals.tsx';
import type { RiskLevel, ScanRecord } from '../types/scan.ts';
import { downloadScansCsv } from '../utils/csvExport.ts';

interface ScannerPageProps {
  onScanSubmit: (url: string) => Promise<void>;
  isScanning: boolean;
  scanError: string | null;
  scans: ScanRecord[];
  isLoadingHistory: boolean;
  onSelectScan: (scan: ScanRecord) => void;
  onDeleteScan: (id: number) => Promise<void>;
  onClearHistory: () => Promise<void>;
}

const TEST_PRESETS = [
  {
    name: 'Brand Spoof (.xyz)',
    url: 'https://paypal.com.secure-resolution-check.xyz/signin',
  },
  {
    name: 'Raw IP Harvester',
    url: 'http://203.0.113.45/paypal/verify-login.php',
  },
  {
    name: 'Multi-Subdomain Lure',
    url: 'https://wellsfargo.verify.user.session-check.info/auth',
  },
  {
    name: 'Legitimate Bank URL',
    url: 'https://www.bankofamerica.com/security-center/overview/',
  },
  {
    name: 'Suspicious Link',
    url: 'http://login-portal.example.org/auth',
  },
];

function previewAnatomy(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const hasScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  try {
    const u = new URL(hasScheme ? trimmed : `http://${trimmed}`);
    const parts = u.hostname.split('.').filter(Boolean);
    const tld = parts.length >= 2 ? parts[parts.length - 1] : '—';
    const root = parts.length >= 2 ? `${parts[parts.length - 2]}.${tld}` : u.hostname;
    const subdomain = parts.length > 2 ? parts.slice(0, -2).join('.') : 'None';
    return {
      protocol: hasScheme ? u.protocol.replace(':', '').toUpperCase() : 'Assumed HTTP',
      subdomain,
      root,
      tld: `.${tld}`,
      path: `${u.pathname}${u.search}` || '/',
    };
  } catch {
    return null;
  }
}

export function ScannerPage({
  onScanSubmit,
  isScanning,
  scanError,
  scans,
  isLoadingHistory,
  onSelectScan,
  onDeleteScan,
  onClearHistory,
}: ScannerPageProps) {
  const [urlInput, setUrlInput] = useState('');
  const [riskFilter, setRiskFilter] = useState<'all' | RiskLevel>('all');
  const [historySearch, setHistorySearch] = useState('');

  const livePreview = useMemo(() => previewAnatomy(urlInput), [urlInput]);

  const filteredScans = useMemo(() => {
    return scans.filter((scan) => {
      if (riskFilter !== 'all' && scan.riskLevel !== riskFilter) return false;
      if (historySearch.trim()) {
        const q = historySearch.trim().toLowerCase();
        return (
          scan.url.toLowerCase().includes(q) || scan.hostname.toLowerCase().includes(q)
        );
      }
      return true;
    });
  }, [scans, riskFilter, historySearch]);

  const counts = useMemo(() => {
    const summary = {
      all: scans.length,
      high: 0,
      suspicious: 0,
      safe: 0,
    };
    for (const s of scans) {
      if (s.riskLevel === 'High Risk') summary.high++;
      else if (s.riskLevel === 'Suspicious') summary.suspicious++;
      else summary.safe++;
    }
    return summary;
  }, [scans]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onScanSubmit(urlInput);
  };

  return (
    <div className="mx-auto max-w-6xl space-y-12 px-4 py-10 sm:px-6">
      {/* Scanner Header & Input Panel */}
      <section className="space-y-6 rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <div className="space-y-2">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
            URL Phishing Scanner
          </h1>
          <p className="max-w-2xl text-sm leading-relaxed text-slate-600">
            Enter or paste a website link below. CyberShield AI extracts 16 URL structural features
            and classifies the link using the trained Random Forest ensemble.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-stretch">
            <div className="relative flex-1">
              <Search
                className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                aria-hidden="true"
              />
              <input
                type="text"
                value={urlInput}
                onChange={(e) => setUrlInput(e.target.value)}
                placeholder="Paste a website URL (e.g. https://login.verify-account.xyz/auth)"
                aria-label="Website URL input"
                className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-10 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
              />
              {urlInput && (
                <button
                  type="button"
                  onClick={() => setUrlInput('')}
                  aria-label="Clear URL input"
                  className="absolute right-2.5 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <button
              type="submit"
              disabled={isScanning}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
            >
              <span>{isScanning ? 'Analyzing URL...' : 'Analyze URL'}</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {scanError && (
            <p role="alert" className="text-sm font-medium text-red-700">
              {scanError}
            </p>
          )}
        </form>

        {/* Preset Test Links */}
        <div className="flex flex-wrap items-center gap-2 border-t border-slate-100 pt-4">
          <span className="mr-1 text-xs font-medium text-slate-500">Sample URLs:</span>
          {TEST_PRESETS.map((preset) => (
            <button
              key={preset.url}
              type="button"
              onClick={() => setUrlInput(preset.url)}
              className="rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 whitespace-nowrap"
            >
              {preset.name}
            </button>
          ))}
        </div>

        {/* Live URL Anatomy Preview */}
        {livePreview && (
          <div className="border-t border-slate-200 pt-5">
            <p className="mb-3 text-xs font-medium text-slate-500">Live URL Structure Preview</p>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
              <div>
                <p className="text-xs text-slate-500">Protocol</p>
                <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900">
                  {livePreview.protocol}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Subdomain</p>
                <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900">
                  {livePreview.subdomain}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">Root Domain</p>
                <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900">
                  {livePreview.root}
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500">TLD</p>
                <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900">
                  {livePreview.tld}
                </p>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <p className="text-xs text-slate-500">Path &amp; Query</p>
                <p className="mt-0.5 truncate font-mono text-xs font-medium text-slate-900">
                  {livePreview.path}
                </p>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* Scan History Table (SQLite Persisted) */}
      <section className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
              Recent Scan History
            </h2>
            <p className="text-xs text-slate-500">
              Saved locally in SQLite · {counts.all} total scans · {counts.high} high risk ·{' '}
              {counts.suspicious} suspicious
            </p>
          </div>

          {scans.length > 0 && (
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <button
                type="button"
                disabled={filteredScans.length === 0}
                onClick={() => downloadScansCsv(filteredScans, 'cybershield-scan-history')}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <Download className="h-3.5 w-3.5" aria-hidden="true" />
                <span>
                  {filteredScans.length === scans.length
                    ? 'Export CSV'
                    : `Export CSV (${filteredScans.length})`}
                </span>
              </button>

              <button
                type="button"
                onClick={onClearHistory}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 hover:text-slate-900 whitespace-nowrap shrink-0"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                <span>Clear History</span>
              </button>
            </div>
          )}
        </div>

        {/* Filter & Search Toolbar */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div
            role="tablist"
            aria-label="Filter scans by risk level"
            className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { id: 'all', label: `All (${counts.all})` },
                { id: 'High Risk', label: `High Risk (${counts.high})` },
                { id: 'Suspicious', label: `Suspicious (${counts.suspicious})` },
                { id: 'No Known Threat Detected', label: `Cleared (${counts.safe})` },
              ] as const
            ).map((tab) => {
              const active = riskFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setRiskFilter(tab.id)}
                  className={`rounded-md px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-white text-slate-950 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>

          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <input
              type="text"
              value={historySearch}
              onChange={(e) => setHistorySearch(e.target.value)}
              placeholder="Filter scanned URLs..."
              aria-label="Filter scan history"
              className="h-9 w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none"
            />
          </div>
        </div>

        {/* History States: Loading / Empty / Populated */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
          {isLoadingHistory ? (
            <div className="divide-y divide-slate-100">
              {[1, 2, 3].map((idx) => (
                <div key={idx} className="flex items-center justify-between px-5 py-3.5">
                  <div className="h-4 w-64 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-24 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : scans.length === 0 ? (
            <div className="px-6 py-12 text-center">
              <p className="font-display text-base font-semibold text-slate-900">
                No URLs scanned yet
              </p>
              <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
                Paste a website link above or choose one of the sample URLs to see the Random
                Forest classification and feature breakdown.
              </p>
            </div>
          ) : filteredScans.length === 0 ? (
            <div className="px-6 py-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No scanned URLs match the current filter.
              </p>
              <button
                type="button"
                onClick={() => {
                  setRiskFilter('all');
                  setHistorySearch('');
                }}
                className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Reset filters
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                    <th className="px-5 py-3">Website URL</th>
                    <th className="px-4 py-3">Risk Assessment</th>
                    <th className="px-4 py-3 text-right">Phishing Score</th>
                    <th className="px-4 py-3 text-right">Tree Votes</th>
                    <th className="px-4 py-3 text-right">Scanned</th>
                    <th className="px-4 py-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredScans.map((scan) => (
                    <tr
                      key={scan.id}
                      onClick={() => onSelectScan(scan)}
                      className="cursor-pointer transition-colors hover:bg-slate-50/80"
                    >
                      <td className="max-w-xs px-5 py-3">
                        <p className="truncate font-mono text-xs font-medium text-slate-900">
                          {scan.url}
                        </p>
                        <p className="truncate text-xs text-slate-500">{scan.hostname}</p>
                      </td>
                      <td className="px-4 py-3 text-xs whitespace-nowrap">
                        <RiskStatusLabel riskLevel={scan.riskLevel} />
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                        {scan.phishingProbability.toFixed(1)}%
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-600 whitespace-nowrap">
                        {scan.treeVotes.phishing}/{scan.treeVotes.total}
                      </td>
                      <td className="px-4 py-3 text-right font-mono text-xs text-slate-500 whitespace-nowrap">
                        {new Date(scan.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td
                        className="px-4 py-3 text-right whitespace-nowrap"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => onSelectScan(scan)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            View
                          </button>
                          <button
                            type="button"
                            onClick={() => onDeleteScan(scan.id)}
                            aria-label={`Delete scan for ${scan.hostname}`}
                            className="rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
