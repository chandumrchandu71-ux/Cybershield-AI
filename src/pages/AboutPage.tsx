import { ArrowRight, CheckCircle2, Cpu, ShieldAlert } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { AppPage } from '../components/Navbar.tsx';
import { RiskStatusLabel } from '../components/RiskVisuals.tsx';
import type { ModelEvaluationMetrics } from '../types/scan.ts';

interface AboutPageProps {
  modelMetrics: ModelEvaluationMetrics | null;
  onScanTestUrl: (url: string) => Promise<void>;
  onNavigate: (page: AppPage) => void;
}

const OUT_OF_SCOPE_V1 = [
  {
    title: 'Mobile Application',
    detail: 'Native iOS and Android client apps are deferred to post-MVP releases.',
  },
  {
    title: 'Browser Extension',
    detail: 'Inline Chrome/Firefox link-hover warnings are planned for future versions.',
  },
  {
    title: 'Automatic WhatsApp & SMS Link Detection',
    detail: 'Users manually paste links into the web scanner in v1 rather than background message monitoring.',
  },
  {
    title: 'Real-Time Website Content Scanning',
    detail: 'v1 evaluates URL structure and lexical patterns without fetching or executing remote HTML/DOM pages.',
  },
  {
    title: 'Community Threat Reporting',
    detail: 'Crowd-sourced blocklists and user submission moderation are planned for future iterations.',
  },
];

export function AboutPage({
  modelMetrics,
  onScanTestUrl,
  onNavigate,
}: AboutPageProps) {
  const [archImgFailed, setArchImgFailed] = useState(false);
  const [testFilter, setTestFilter] = useState<'all' | 'Phishing' | 'Legitimate' | 'misclassified'>(
    'all',
  );

  const filteredTestSamples = useMemo(() => {
    if (!modelMetrics) return [];
    return modelMetrics.unseenTestSamples.filter((s) => {
      if (testFilter === 'Phishing') return s.actualLabel === 'Phishing';
      if (testFilter === 'Legitimate') return s.actualLabel === 'Legitimate';
      if (testFilter === 'misclassified') return !s.correct;
      return true;
    });
  }, [modelMetrics, testFilter]);

  return (
    <div className="mx-auto max-w-6xl space-y-14 px-4 py-10 sm:px-6">
      {/* Project Intro & Visual */}
      <section className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
        <div className="flex flex-col justify-between space-y-6 lg:col-span-7">
          <div className="space-y-4">
            <p className="text-xs font-medium tracking-wide text-slate-500">
              About CyberShield AI
            </p>
            <h1
              className="font-display text-3xl font-bold tracking-tight text-slate-950 sm:text-4xl"
              style={{ textWrap: 'balance' }}
            >
              Machine learning protection against deceptive URLs and fake websites.
            </h1>
            <p className="text-base leading-relaxed text-slate-600">
              CyberShield AI is a focused cybersecurity MVP built to help everyday users evaluate
              suspicious web links before entering passwords, one-time passcodes, or banking
              credentials. Instead of relying solely on static blocklists that miss newly
              registered phishing domains, the system analyzes structural URL features with a
              Random Forest ensemble.
            </p>
            <p className="text-sm leading-relaxed text-slate-600">
              Every scan parses the URL into its protocol, subdomain chain, registrable domain,
              TLD, and path, extracts 16 numerical indicators, and aggregates votes across{' '}
              <span className="font-mono font-medium text-slate-900">
                {modelMetrics ? modelMetrics.nEstimators : 41}
              </span>{' '}
              CART decision trees.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-4 pt-2">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="inline-flex items-center gap-2 rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              <span>Open URL Scanner</span>
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="lg:col-span-5">
          <div className="h-full min-h-[240px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            {!archImgFailed ? (
              <img
                src="/src/assets/images/about_ml_architecture_1794915283488.jpg"
                alt="Isometric frosted glass decision tree branches representing Random Forest ensemble classification"
                referrerPolicy="no-referrer"
                onError={() => setArchImgFailed(true)}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="flex h-full min-h-[240px] flex-col items-center justify-center gap-3 p-8 text-center">
                <Cpu className="h-10 w-10 text-blue-700" aria-hidden="true" />
                <p className="font-display text-sm font-semibold text-slate-900">
                  Random Forest Classification Pipeline
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Model Evaluation & Error Measurement */}
      {modelMetrics && (
        <section className="space-y-8">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              Model Evaluation on Unseen URLs
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Trained on {modelMetrics.trainSize} labeled URLs and evaluated on a held-out split of{' '}
              {modelMetrics.testSize} unseen legitimate and phishing URLs to measure false
              positives and false negatives.
            </p>
          </div>

          {/* 4 Metric Summary Strip */}
          <div className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <p className="text-xs text-slate-500">Unseen Test Accuracy</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {modelMetrics.accuracy}%
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500">Precision</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {modelMetrics.precision}%
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500">Recall (Phishing Detection)</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {modelMetrics.recall}%
              </p>
            </div>
            <div className="p-5">
              <p className="text-xs text-slate-500">F1 Score</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {modelMetrics.f1Score}%
              </p>
            </div>
          </div>

          {/* Confusion Matrix + Top Feature Importances */}
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Confusion Matrix (False Positives &amp; False Negatives)
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Results across {modelMetrics.testSize} unseen test URLs (24 legitimate, 24
                phishing).
              </p>

              <div className="mt-5 grid grid-cols-2 gap-4">
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-xs font-medium text-emerald-800">True Positives</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                    {modelMetrics.confusionMatrix.truePositives}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Phishing URLs correctly detected
                  </p>
                </div>

                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 p-4">
                  <p className="text-xs font-medium text-emerald-800">True Negatives</p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                    {modelMetrics.confusionMatrix.trueNegatives}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Legitimate URLs correctly cleared
                  </p>
                </div>

                <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
                  <p className="text-xs font-medium text-amber-800">
                    False Positives ({modelMetrics.falsePositiveRate}%)
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                    {modelMetrics.confusionMatrix.falsePositives}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Legitimate URLs flagged as phishing
                  </p>
                </div>

                <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
                  <p className="text-xs font-medium text-red-800">
                    False Negatives ({modelMetrics.falseNegativeRate}%)
                  </p>
                  <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                    {modelMetrics.confusionMatrix.falseNegatives}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    Phishing URLs missed by binary cutoff
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-6">
              <h3 className="font-display text-lg font-semibold text-slate-900">
                Top Gini Feature Importances
              </h3>
              <p className="mt-1 text-xs text-slate-500">
                Relative contribution of extracted URL features across {modelMetrics.nEstimators}{' '}
                trees.
              </p>

              <div className="mt-5 space-y-3">
                {modelMetrics.featureImportances.slice(0, 8).map((item) => (
                  <div key={item.key} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-medium text-slate-700">{item.label}</span>
                      <span className="font-mono font-medium text-slate-900">
                        {item.importance.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                      <div
                        className="h-full bg-blue-700"
                        style={{
                          width: `${Math.min(Math.max(item.importance * 3.2, 3), 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Unseen Test Set Explorer */}
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="flex flex-col gap-4 border-b border-slate-200 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="font-display text-lg font-semibold text-slate-900">
                  Unseen Test URL Predictions
                </h3>
                <p className="text-xs text-slate-500">
                  Verify how the Random Forest scores held-out URLs it was not trained on.
                </p>
              </div>

              <div className="inline-flex flex-wrap items-center gap-1 rounded-lg bg-slate-100 p-1">
                {(
                  [
                    { id: 'all', label: `All (${modelMetrics.testSize})` },
                    { id: 'Phishing', label: 'Phishing' },
                    { id: 'Legitimate', label: 'Legitimate' },
                    { id: 'misclassified', label: 'Errors' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setTestFilter(tab.id)}
                    className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      testFilter === tab.id
                        ? 'bg-white text-slate-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {filteredTestSamples.length === 0 ? (
              <div className="px-6 py-10 text-center text-sm text-slate-500">
                Zero misclassified URLs in this unseen test split.
              </div>
            ) : (
              <div className="max-h-96 overflow-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead className="sticky top-0 bg-slate-50">
                    <tr className="border-b border-slate-200 text-xs font-medium text-slate-500">
                      <th className="px-6 py-3">Unseen Test URL</th>
                      <th className="px-4 py-3">Actual</th>
                      <th className="px-4 py-3">Predicted Tier</th>
                      <th className="px-4 py-3 text-right">Score</th>
                      <th className="px-4 py-3">Outcome</th>
                      <th className="px-6 py-3 text-right">Inspect</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredTestSamples.map((sample) => (
                      <tr key={sample.url} className="hover:bg-slate-50/70">
                        <td className="max-w-xs px-6 py-3">
                          <p className="truncate font-mono text-xs text-slate-900">{sample.url}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-700 whitespace-nowrap">
                          {sample.actualLabel}
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          <RiskStatusLabel riskLevel={sample.riskLevel} />
                        </td>
                        <td className="px-4 py-3 text-right font-mono text-xs font-medium text-slate-900 whitespace-nowrap">
                          {sample.phishingProbability.toFixed(1)}%
                        </td>
                        <td className="px-4 py-3 text-xs whitespace-nowrap">
                          {sample.correct ? (
                            <span className="inline-flex items-center gap-1 font-medium text-emerald-700">
                              <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Correct</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 font-medium text-red-700">
                              <ShieldAlert className="h-3.5 w-3.5" aria-hidden="true" />
                              <span>Error</span>
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-right whitespace-nowrap">
                          <button
                            type="button"
                            onClick={() => onScanTestUrl(sample.url)}
                            className="text-xs font-medium text-blue-700 hover:text-blue-800"
                          >
                            Scan live
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      )}

      {/* MVP Scope & Future Roadmap */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8">
        <h2 className="font-display text-xl font-semibold text-slate-900">
          Current MVP Scope &amp; Future Versions
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          To keep the first release focused, fast, and transparent, the capabilities below are
          intentionally excluded from v1 and reserved for future versions.
        </p>

        <div className="mt-6 grid grid-cols-1 gap-6 border-t border-slate-100 pt-6 sm:grid-cols-2 lg:grid-cols-3">
          {OUT_OF_SCOPE_V1.map((item) => (
            <div key={item.title} className="space-y-1.5">
              <h3 className="font-display text-sm font-semibold text-slate-900">{item.title}</h3>
              <p className="text-xs leading-relaxed text-slate-600">{item.detail}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
