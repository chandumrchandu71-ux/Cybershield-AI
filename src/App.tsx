import { useCallback, useEffect, useState } from 'react';
import { Footer } from './components/Footer.tsx';
import { Navbar, type AppPage } from './components/Navbar.tsx';
import { AboutPage } from './pages/AboutPage.tsx';
import { DashboardPage } from './pages/DashboardPage.tsx';
import { HomePage } from './pages/HomePage.tsx';
import { ResultPage } from './pages/ResultPage.tsx';
import { ScannerPage } from './pages/ScannerPage.tsx';
import type { ModelEvaluationMetrics, ScanRecord } from './types/scan.ts';

export default function App() {
  const [currentPage, setCurrentPage] = useState<AppPage>('home');
  const [activeResult, setActiveResult] = useState<ScanRecord | null>(null);
  const [scans, setScans] = useState<ScanRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [isScanning, setIsScanning] = useState(false);
  const [scanError, setScanError] = useState<string | null>(null);
  const [modelMetrics, setModelMetrics] = useState<ModelEvaluationMetrics | null>(null);

  const fetchHistory = useCallback(async () => {
    setIsLoadingHistory(true);
    try {
      const res = await fetch('/api/scans');
      if (res.ok) {
        const data = (await res.json()) as { scans: ScanRecord[] };
        setScans(data.scans ?? []);
      }
    } catch {
      // Keep current state if transient network error occurs
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  const fetchModelMetrics = useCallback(async () => {
    try {
      const res = await fetch('/api/model/metrics');
      if (res.ok) {
        const data = (await res.json()) as ModelEvaluationMetrics;
        setModelMetrics(data);
      }
    } catch {
      // Non-blocking
    }
  }, []);

  useEffect(() => {
    void fetchHistory();
    void fetchModelMetrics();
  }, [fetchHistory, fetchModelMetrics]);

  const handleNavigate = (page: AppPage) => {
    setScanError(null);
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleScanSubmit = async (rawUrl: string) => {
    setScanError(null);
    if (!rawUrl.trim()) {
      setScanError('Please enter a website URL to scan.');
      return;
    }

    setIsScanning(true);
    try {
      const res = await fetch('/api/scan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: rawUrl }),
      });

      const payload = await res.json();
      if (!res.ok) {
        setScanError(payload?.error || 'Could not analyze the submitted URL.');
        return;
      }

      const record = payload as ScanRecord;
      setActiveResult(record);
      setScans((prev) => [record, ...prev.filter((s) => s.id !== record.id)]);
      setCurrentPage('result');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch {
      setScanError('Network error while scanning the URL. Please try again.');
    } finally {
      setIsScanning(false);
    }
  };

  const handleSelectScan = (scan: ScanRecord) => {
    setScanError(null);
    setActiveResult(scan);
    setCurrentPage('result');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteScan = async (id: number) => {
    try {
      const res = await fetch(`/api/scans/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setScans((prev) => prev.filter((s) => s.id !== id));
        if (activeResult?.id === id) {
          setActiveResult(null);
        }
      }
    } catch {
      // Ignore transient error
    }
  };

  const handleClearHistory = async () => {
    try {
      const res = await fetch('/api/scans', { method: 'DELETE' });
      if (res.ok) {
        setScans([]);
        setActiveResult(null);
      }
    } catch {
      // Ignore transient error
    }
  };

  const handleRunBatchScans = async (urls: string[]) => {
    const created: ScanRecord[] = [];
    for (const url of urls) {
      try {
        const res = await fetch('/api/scan', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url }),
        });
        if (res.ok) {
          created.push((await res.json()) as ScanRecord);
        }
      } catch {
        // Continue batch
      }
    }
    if (created.length > 0) {
      await fetchHistory();
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <Navbar
        currentPage={currentPage}
        onNavigate={handleNavigate}
        hasActiveResult={Boolean(activeResult)}
      />

      <main className="flex-1">
        {currentPage === 'home' && (
          <HomePage
            onScanSubmit={handleScanSubmit}
            isScanning={isScanning}
            scanError={scanError}
            onNavigate={handleNavigate}
            modelMetrics={modelMetrics}
          />
        )}

        {currentPage === 'scanner' && (
          <ScannerPage
            onScanSubmit={handleScanSubmit}
            isScanning={isScanning}
            scanError={scanError}
            scans={scans}
            isLoadingHistory={isLoadingHistory}
            onSelectScan={handleSelectScan}
            onDeleteScan={handleDeleteScan}
            onClearHistory={handleClearHistory}
          />
        )}

        {currentPage === 'dashboard' && (
          <DashboardPage
            scans={scans}
            isLoading={isLoadingHistory}
            onSelectScan={handleSelectScan}
            onNavigate={handleNavigate}
            onRunBatchScans={handleRunBatchScans}
          />
        )}

        {currentPage === 'result' && (
          <ResultPage
            scan={activeResult}
            recentScans={scans}
            onSelectScan={handleSelectScan}
            onNavigate={handleNavigate}
          />
        )}

        {currentPage === 'about' && (
          <AboutPage
            modelMetrics={modelMetrics}
            onScanTestUrl={handleScanSubmit}
            onNavigate={handleNavigate}
          />
        )}
      </main>

      <Footer onNavigate={handleNavigate} />
    </div>
  );
}
