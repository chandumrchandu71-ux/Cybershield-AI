import { AlertTriangle, ArrowRight, Search, Shield, ShieldAlert, ShieldCheck } from 'lucide-react';
import { useState, type FormEvent } from 'react';
import type { ModelEvaluationMetrics } from '../types/scan.ts';
import type { AppPage } from '../components/Navbar.tsx';

interface HomePageProps {
  onScanSubmit: (url: string) => Promise<void>;
  isScanning: boolean;
  scanError: string | null;
  onNavigate: (page: AppPage) => void;
  modelMetrics: ModelEvaluationMetrics | null;
}

const SAMPLE_LINKS = [
  {
    label: 'Phishing example',
    url: 'https://paypal.com.verify-account-id.xyz/login',
  },
  {
    label: 'Suspicious link',
    url: 'http://login-portal.example.org/auth',
  },
  {
    label: 'Official domain',
    url: 'https://www.chase.com/personal/checking',
  },
];

export function HomePage({
  onScanSubmit,
  isScanning,
  scanError,
  onNavigate,
  modelMetrics,
}: HomePageProps) {
  const [urlInput, setUrlInput] = useState('');
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    await onScanSubmit(urlInput);
  };

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Split */}
      <section className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
          <div className="grid grid-cols-1 items-stretch gap-10 lg:grid-cols-12">
            <div className="flex flex-col justify-between gap-8 lg:col-span-7">
              <div className="space-y-5">
                <p className="text-xs font-medium tracking-wide text-slate-500">
                  CyberShield AI · Random Forest URL Inspection
                </p>

                <h1
                  className="font-display text-4xl font-bold tracking-tight text-slate-950 sm:text-5xl"
                  style={{ textWrap: 'balance', lineHeight: 1.1 }}
                >
                  Check any website link before you trust it.
                </h1>

                <p className="max-w-2xl text-base leading-relaxed text-slate-600">
                  Paste a website URL to inspect its structure, domain patterns, and phishing
                  indicators. CyberShield AI extracts 16 lexical features and classifies links
                  with a trained Random Forest model before you share credentials or banking
                  details.
                </p>
              </div>

              {/* Quick URL Input Form */}
              <div className="space-y-3">
                <form
                  onSubmit={handleSubmit}
                  className="flex flex-col gap-3 sm:flex-row sm:items-stretch"
                >
                  <div className="relative flex-1">
                    <Search
                      className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
                      aria-hidden="true"
                    />
                    <input
                      type="text"
                      value={urlInput}
                      onChange={(e) => setUrlInput(e.target.value)}
                      placeholder="https://example.com/login"
                      aria-label="Website URL to scan"
                      className="h-12 w-full rounded-lg border border-slate-300 bg-white pl-10 pr-4 font-mono text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-700/20"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isScanning}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-lg bg-blue-700 px-6 text-sm font-semibold text-white transition-colors duration-150 hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 whitespace-nowrap shrink-0"
                  >
                    <span>{isScanning ? 'Scanning URL...' : 'Scan URL'}</span>
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </form>

                {scanError && (
                  <p role="alert" className="text-sm font-medium text-red-700">
                    {scanError}
                  </p>
                )}

                <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-slate-500">
                  <span>Try an example:</span>
                  {SAMPLE_LINKS.map((sample) => (
                    <button
                      key={sample.url}
                      type="button"
                      onClick={() => setUrlInput(sample.url)}
                      className="font-medium text-blue-700 underline decoration-blue-700/30 underline-offset-4 hover:decoration-blue-700 whitespace-nowrap"
                    >
                      {sample.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Right Visual Anchor */}
            <div className="lg:col-span-5">
              <div className="h-full min-h-[260px] overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                {!heroImgFailed ? (
                  <img
                    src="/src/assets/images/hero_security_inspection_1794915283381.jpg"
                    alt="Optical inspection prism and slate-blue metal shield instrument symbolizing precise URL verification"
                    referrerPolicy="no-referrer"
                    onError={() => setHeroImgFailed(true)}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full min-h-[260px] flex-col items-center justify-center gap-3 bg-slate-100 p-8 text-center">
                    <Shield className="h-12 w-12 text-blue-700" aria-hidden="true" />
                    <p className="font-display text-base font-semibold text-slate-900">
                      CyberShield URL Inspection Engine
                    </p>
                    <p className="max-w-xs text-xs text-slate-500">
                      Lexical feature extraction and Random Forest classification
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4-Column Working Process Strip */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="mb-6 flex flex-col justify-between gap-2 sm:flex-row sm:items-end">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
              How URL verification works
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              Every submitted web link passes through a four-stage deterministic pipeline.
            </p>
          </div>
          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
          >
            <span>Open full scanner workspace</span>
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="grid grid-cols-1 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
          <div className="p-6">
            <p className="font-mono text-xs font-medium text-slate-400">01</p>
            <h3 className="mt-2 font-display text-base font-semibold text-slate-900">
              URL Input
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Paste any HTTP or HTTPS link. The parser normalizes the protocol, host, subdomains,
              and query string.
            </p>
          </div>

          <div className="p-6 sm:border-t lg:border-t-0">
            <p className="font-mono text-xs font-medium text-slate-400">02</p>
            <h3 className="mt-2 font-display text-base font-semibold text-slate-900">
              Feature Extraction
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Measures 16 indicators including URL length, subdomain depth, IP literals, brand
              spoofing, and entropy.
            </p>
          </div>

          <div className="p-6 border-t border-slate-200 lg:border-t-0">
            <p className="font-mono text-xs font-medium text-slate-400">03</p>
            <h3 className="mt-2 font-display text-base font-semibold text-slate-900">
              Random Forest Vote
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              41 trained decision trees evaluate the feature vector and aggregate a phishing
              probability score.
            </p>
          </div>

          <div className="p-6 border-t border-slate-200 lg:border-t-0">
            <p className="font-mono text-xs font-medium text-slate-400">04</p>
            <h3 className="mt-2 font-display text-base font-semibold text-slate-900">
              Risk &amp; Safety Advice
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-slate-600">
              Outputs one of three clear risk tiers along with specific warning signs and next-step
              safety guidance.
            </p>
          </div>
        </div>
      </section>

      {/* Three Risk Classifications + Adjacent Model Proof */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-1 gap-10 lg:grid-cols-12">
          <div className="space-y-5 lg:col-span-7">
            <div>
              <h2 className="font-display text-2xl font-semibold tracking-tight text-slate-900">
                Three transparent risk outcomes
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                Results explain why a URL appears risky rather than issuing opaque pass/fail labels.
              </p>
            </div>

            <div className="divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white">
              <div className="flex items-start gap-4 p-5">
                <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-red-600" aria-hidden="true" />
                <div>
                  <h3 className="font-display text-sm font-semibold text-red-700">
                    High Risk – Potentially dangerous website.
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Strong lexical phishing patterns such as raw IP hosts, brand impersonation in
                    subdomains, or deceptive credential paths. Never enter passwords or banking
                    details.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5">
                <AlertTriangle
                  className="mt-0.5 h-5 w-5 shrink-0 text-amber-600"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-display text-sm font-semibold text-amber-700">
                    Suspicious – Further verification recommended.
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    Mixed warning signs such as unencrypted HTTP, multiple hyphens, or sensitive
                    keywords. Verify the official domain manually before signing in.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4 p-5">
                <ShieldCheck
                  className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"
                  aria-hidden="true"
                />
                <div>
                  <h3 className="font-display text-sm font-semibold text-emerald-700">
                    No Known Threat Detected – No threat identified by the available checks; not
                    guaranteed safe.
                  </h3>
                  <p className="mt-1 text-sm text-slate-600">
                    No lexical phishing indicators were detected in the URL string. Because live page
                    contents are not crawled in v1, always confirm the address bar before logging in.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Adjacent Unseen Evaluation Proof */}
          <div className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-5">
            <div className="space-y-4">
              <div>
                <h2 className="font-display text-xl font-semibold tracking-tight text-slate-900">
                  Measured on unseen URLs
                </h2>
                <p className="mt-1 text-sm text-slate-600">
                  Evaluated on a held-out test split of{' '}
                  <span className="font-mono font-medium text-slate-900">
                    {modelMetrics ? modelMetrics.testSize : 48}
                  </span>{' '}
                  unseen legitimate and phishing URLs.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4 border-y border-slate-200 py-5">
                <div>
                  <p className="text-xs text-slate-500">Test Accuracy</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">
                    {modelMetrics ? `${modelMetrics.accuracy}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">F1 Score</p>
                  <p className="mt-1 font-mono text-2xl font-semibold text-slate-950">
                    {modelMetrics ? `${modelMetrics.f1Score}%` : '—'}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">False Positives</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-slate-950">
                    {modelMetrics ? `${modelMetrics.confusionMatrix.falsePositives}` : '—'}
                    {modelMetrics && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({modelMetrics.falsePositiveRate}%)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-slate-500">False Negatives</p>
                  <p className="mt-1 font-mono text-xl font-semibold text-slate-950">
                    {modelMetrics ? `${modelMetrics.confusionMatrix.falseNegatives}` : '—'}
                    {modelMetrics && (
                      <span className="ml-1.5 text-xs font-normal text-slate-500">
                        ({modelMetrics.falseNegativeRate}%)
                      </span>
                    )}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 flex items-center justify-between gap-4">
              <p className="text-xs text-slate-500">
                Dataset: {modelMetrics ? modelMetrics.datasetSize : 240} labeled URLs ·{' '}
                {modelMetrics ? modelMetrics.nEstimators : 41} CART trees
              </p>
              <button
                type="button"
                onClick={() => onNavigate('about')}
                className="text-sm font-medium text-blue-700 hover:text-blue-800 whitespace-nowrap shrink-0"
              >
                View full report →
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
