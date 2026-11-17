import {
  AlertTriangle,
  ArrowLeft,
  Check,
  CheckCircle2,
  Copy,
  ShieldAlert,
} from 'lucide-react';
import { useState } from 'react';
import type { AppPage } from '../components/Navbar.tsx';
import { getRiskAppearance, SignalSeverityIcon } from '../components/RiskVisuals.tsx';
import type { ScanRecord } from '../types/scan.ts';

interface ResultPageProps {
  scan: ScanRecord | null;
  recentScans: ScanRecord[];
  onSelectScan: (scan: ScanRecord) => void;
  onNavigate: (page: AppPage) => void;
}

export function ResultPage({
  scan,
  recentScans,
  onSelectScan,
  onNavigate,
}: ResultPageProps) {
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [copiedReport, setCopiedReport] = useState(false);

  if (!scan) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 sm:px-6">
        <div className="rounded-xl border border-slate-200 bg-white p-8 text-center sm:p-12">
          <h1 className="font-display text-2xl font-bold text-slate-950">
            No scan result selected
          </h1>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
            Submit a website URL in the scanner to view its Random Forest classification,
            extracted feature breakdown, and safety recommendations.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-blue-800 whitespace-nowrap"
            >
              Go to URL Scanner
            </button>
            {recentScans.length > 0 && (
              <button
                type="button"
                onClick={() => onSelectScan(recentScans[0])}
                className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap"
              >
                Open Most Recent Scan
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const appearance = getRiskAppearance(scan.riskLevel);
  const VerdictIcon = appearance.Icon;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(scan.normalizedUrl);
      setCopiedUrl(true);
      setTimeout(() => setCopiedUrl(false), 1800);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  const handleCopyReport = async () => {
    const summary = [
      `CyberShield AI URL Assessment`,
      `URL: ${scan.normalizedUrl}`,
      `Result: ${scan.riskHeadline}`,
      `Random Forest Confidence: ${scan.phishingProbability.toFixed(1)}% phishing score (${scan.treeVotes.phishing}/${scan.treeVotes.total} trees)`,
      `Key Findings:`,
      ...scan.signals.map((s) => `- ${s.title}: ${s.detail}`),
      `Safety Advice:`,
      ...scan.recommendations.map((r) => `- ${r}`),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(summary);
      setCopiedReport(true);
      setTimeout(() => setCopiedReport(false), 1800);
    } catch {
      // Clipboard blocked in some embedded contexts
    }
  };

  const criticalCount = scan.featureDescriptors.filter((d) => d.status === 'critical').length;
  const elevatedCount = scan.featureDescriptors.filter((d) => d.status === 'elevated').length;

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <button
          type="button"
          onClick={() => onNavigate('scanner')}
          className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 hover:text-slate-950 whitespace-nowrap"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          <span>Scan Another URL</span>
        </button>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleCopyReport}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 whitespace-nowrap shrink-0"
          >
            {copiedReport ? (
              <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
            ) : (
              <Copy className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            <span>{copiedReport ? 'Summary Copied' : 'Copy Report Summary'}</span>
          </button>
        </div>
      </div>

      {/* Primary Risk Verdict Card */}
      <section className={`rounded-xl border p-6 sm:p-8 ${appearance.surfaceClass}`}>
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12 lg:items-center">
          <div className="space-y-4 lg:col-span-8">
            <div className="flex items-start gap-3">
              <VerdictIcon
                className={`mt-1 h-7 w-7 shrink-0 ${appearance.textClass}`}
                aria-hidden="true"
              />
              <div>
                <p className={`text-xs font-semibold uppercase tracking-wide ${appearance.textClass}`}>
                  {scan.riskLevel}
                </p>
                <h1
                  className="mt-1 font-display text-2xl font-bold tracking-tight text-slate-950 sm:text-3xl"
                  style={{ textWrap: 'balance' }}
                >
                  {scan.riskHeadline}
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200/80 bg-white px-3.5 py-2.5">
              <span className="min-w-0 flex-1 break-all font-mono text-xs text-slate-900 sm:text-sm">
                {scan.normalizedUrl}
              </span>
              <button
                type="button"
                onClick={handleCopyUrl}
                aria-label="Copy analyzed URL"
                className="inline-flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 shrink-0"
              >
                {copiedUrl ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
                <span>{copiedUrl ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            <p className="text-xs text-slate-600">
              Host: <span className="font-mono text-slate-900">{scan.hostname}</span>
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              Scanned {new Date(scan.createdAt).toLocaleString()}
              <span className="mx-2" aria-hidden="true">
                ·
              </span>
              {criticalCount} critical and {elevatedCount} elevated URL signals
            </p>
          </div>

          {/* Random Forest Tree Consensus Meter */}
          <div className="rounded-lg border border-slate-200 bg-white p-5 lg:col-span-4">
            <div className="flex items-baseline justify-between">
              <span className="text-xs font-medium text-slate-500">Phishing Score</span>
              <span className={`font-mono text-2xl font-bold ${appearance.textClass}`}>
                {scan.phishingProbability.toFixed(1)}%
              </span>
            </div>

            <div className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className={`h-full transition-all duration-300 ${appearance.barClass}`}
                style={{ width: `${Math.max(scan.phishingProbability, 4)}%` }}
              />
            </div>

            <div className="mt-3 flex items-center justify-between text-xs text-slate-600">
              <span>Random Forest Vote</span>
              <span className="font-mono font-medium text-slate-900">
                {scan.treeVotes.phishing} / {scan.treeVotes.total} trees
              </span>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-slate-500">
              {scan.treeVotes.phishing} decision trees predicted phishing and{' '}
              {scan.treeVotes.legitimate} predicted legitimate.
            </p>
          </div>
        </div>
      </section>

      {/* Explanation + Safety Recommendations */}
      <section className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-7">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Why this URL received this assessment
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Key structural and lexical indicators evaluated by the model.
          </p>

          <ul className="mt-5 divide-y divide-slate-100">
            {scan.signals.map((signal, idx) => (
              <li key={idx} className="flex items-start gap-3 py-3.5 first:pt-0 last:pb-0">
                <span className="mt-0.5">
                  <SignalSeverityIcon severity={signal.severity} />
                </span>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-slate-900">{signal.title}</p>
                  <p className="text-sm leading-relaxed text-slate-600">{signal.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Safety Recommendations
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Practical precautions before interacting with this website.
          </p>

          <ul className="mt-5 space-y-3.5">
            {scan.recommendations.map((rec, idx) => (
              <li
                key={idx}
                className="flex items-start gap-3 rounded-lg border border-slate-200 bg-slate-50/70 p-3.5"
              >
                <span className="mt-0.5 font-mono text-xs font-semibold text-blue-700">
                  0{idx + 1}
                </span>
                <p className="text-sm leading-relaxed text-slate-700">{rec}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* URL Structural Dissection */}
      <section className="rounded-xl border border-slate-200 bg-white p-6">
        <h2 className="font-display text-lg font-semibold text-slate-900">
          URL Structural Breakdown
        </h2>
        <div className="mt-4 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-2 lg:grid-cols-5">
          <div>
            <p className="text-xs text-slate-500">Protocol</p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900">
              {scan.anatomy.protocol.toUpperCase()}
              {scan.anatomy.protocolAssumed ? ' (assumed)' : ''}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Subdomain</p>
            <p className="mt-1 break-all font-mono text-sm font-medium text-slate-900">
              {scan.anatomy.subdomain || 'None'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Registrable Domain</p>
            <p className="mt-1 break-all font-mono text-sm font-medium text-slate-900">
              {scan.anatomy.registrableDomain}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Top-Level Domain</p>
            <p className="mt-1 font-mono text-sm font-medium text-slate-900">
              .{scan.anatomy.tld || 'n/a'}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Path &amp; Query</p>
            <p className="mt-1 break-all font-mono text-sm font-medium text-slate-900">
              {scan.anatomy.pathAndQuery || '/'}
            </p>
          </div>
        </div>
      </section>

      {/* All 16 Extracted Features Table */}
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-6 py-5">
          <h2 className="font-display text-lg font-semibold text-slate-900">
            Extracted URL Features (16 Indicators)
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Exact numerical and structural values supplied to the Random Forest classifier.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50/70 text-xs font-medium text-slate-500">
                <th className="px-6 py-3">Feature</th>
                <th className="px-4 py-3">Measured Value</th>
                <th className="px-4 py-3">Assessment</th>
                <th className="px-6 py-3">What It Checks</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {scan.featureDescriptors.map((feat) => (
                <tr key={feat.key} className="hover:bg-slate-50/60">
                  <td className="px-6 py-3 font-medium text-slate-900 whitespace-nowrap">
                    {feat.label}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                    {feat.formattedValue}
                  </td>
                  <td className="px-4 py-3 text-xs whitespace-nowrap">
                    {feat.status === 'critical' ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-red-700">
                        <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Critical</span>
                      </span>
                    ) : feat.status === 'elevated' ? (
                      <span className="inline-flex items-center gap-1.5 font-medium text-amber-700">
                        <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Elevated</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 font-medium text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                        <span>Normal</span>
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-3 text-xs leading-relaxed text-slate-600">
                    {feat.explanation}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
