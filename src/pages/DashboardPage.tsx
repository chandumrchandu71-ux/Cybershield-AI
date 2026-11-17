import * as d3 from 'd3';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Download,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { AppPage } from '../components/Navbar.tsx';
import type { ScanRecord } from '../types/scan.ts';
import { downloadScansCsv } from '../utils/csvExport.ts';

interface DashboardPageProps {
  scans: ScanRecord[];
  isLoading: boolean;
  onSelectScan: (scan: ScanRecord) => void;
  onNavigate: (page: AppPage) => void;
  onRunBatchScans: (urls: string[]) => Promise<void>;
}

type TimeRange = 'all' | '24h' | '7d' | '30d';
type BucketUnit = 'auto' | 'minute' | 'hour' | 'day';
type TrendChartMode = 'area' | 'bar';

interface TimeBucket {
  date: Date;
  label: string;
  highRisk: number;
  suspicious: number;
  safe: number;
  total: number;
}

const RISK_SERIES = [
  { key: 'highRisk' as const, label: 'High Risk', color: '#DC2626' },
  { key: 'suspicious' as const, label: 'Suspicious', color: '#D97706' },
  { key: 'safe' as const, label: 'Safe (No Known Threat)', color: '#16A34A' },
];

const SAMPLE_BATCH_URLS = [
  'https://www.google.com/search?q=cybersecurity+guide',
  'https://paypal.com.verify-account-id.xyz/login',
  'http://login-portal.example.org/auth',
  'https://www.chase.com/personal/checking',
  'http://192.168.104.22/paypal/login.php',
  'https://docs.github.com/en/authentication',
  'http://microsoft-365-password-expiry-notice.top/login',
  'http://secure-portal.example.net/account/auth',
  'https://www.cloudflare.com/application-services/',
  'https://amaz0n-order-refund-claim.xyz/verify',
];

function resolveGranularity(
  scans: ScanRecord[],
  selected: BucketUnit,
): 'minute' | 'hour' | 'day' {
  if (selected !== 'auto') return selected;
  if (scans.length <= 1) return 'minute';
  const times = scans.map((s) => new Date(s.createdAt).getTime());
  const spanMs = Math.max(...times) - Math.min(...times);
  if (spanMs <= 2 * 60 * 60 * 1000) return 'minute';
  if (spanMs <= 3 * 24 * 60 * 60 * 1000) return 'hour';
  return 'day';
}

function floorDate(date: Date, unit: 'minute' | 'hour' | 'day'): Date {
  const d = new Date(date.getTime());
  if (unit === 'minute') {
    d.setSeconds(0, 0);
  } else if (unit === 'hour') {
    d.setMinutes(0, 0, 0);
  } else {
    d.setHours(0, 0, 0, 0);
  }
  return d;
}

function useContainerWidth(ref: React.RefObject<HTMLDivElement | null>) {
  const [width, setWidth] = useState(720);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const update = () => {
      const next = Math.floor(el.getBoundingClientRect().width);
      if (next > 0) setWidth(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

export function DashboardPage({
  scans,
  isLoading,
  onSelectScan,
  onNavigate,
  onRunBatchScans,
}: DashboardPageProps) {
  const [timeRange, setTimeRange] = useState<TimeRange>('all');
  const [granularity, setGranularity] = useState<BucketUnit>('auto');
  const [chartMode, setChartMode] = useState<TrendChartMode>('area');
  const [isSeedingBatch, setIsSeedingBatch] = useState(false);

  // Tooltip states
  const [trendTooltip, setTrendTooltip] = useState<{
    x: number;
    y: number;
    bucket: TimeBucket;
  } | null>(null);

  const [donutTooltip, setDonutTooltip] = useState<{
    label: string;
    count: number;
    pct: string;
    color: string;
  } | null>(null);

  const [scoreTooltip, setScoreTooltip] = useState<{
    x: number;
    y: number;
    scan: ScanRecord;
  } | null>(null);

  const trendContainerRef = useRef<HTMLDivElement | null>(null);
  const trendSvgRef = useRef<SVGSVGElement | null>(null);
  const donutSvgRef = useRef<SVGSVGElement | null>(null);
  const scoreContainerRef = useRef<HTMLDivElement | null>(null);
  const scoreSvgRef = useRef<SVGSVGElement | null>(null);

  const trendWidth = useContainerWidth(trendContainerRef);
  const scoreWidth = useContainerWidth(scoreContainerRef);

  const filteredScans = useMemo(() => {
    const now = Date.now();
    const cutoffs: Record<TimeRange, number> = {
      all: 0,
      '24h': now - 24 * 60 * 60 * 1000,
      '7d': now - 7 * 24 * 60 * 60 * 1000,
      '30d': now - 30 * 24 * 60 * 60 * 1000,
    };
    const cutoff = cutoffs[timeRange];
    return scans
      .filter((s) => new Date(s.createdAt).getTime() >= cutoff)
      .slice()
      .sort(
        (a, b) =>
          new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
  }, [scans, timeRange]);

  const effectiveUnit = useMemo(
    () => resolveGranularity(filteredScans, granularity),
    [filteredScans, granularity],
  );

  const summary = useMemo(() => {
    let highRisk = 0;
    let suspicious = 0;
    let safe = 0;
    for (const s of filteredScans) {
      if (s.riskLevel === 'High Risk') highRisk++;
      else if (s.riskLevel === 'Suspicious') suspicious++;
      else safe++;
    }
    const total = filteredScans.length;
    const pct = (n: number) => (total > 0 ? ((n / total) * 100).toFixed(1) : '0.0');
    return {
      total,
      highRisk,
      suspicious,
      safe,
      highPct: pct(highRisk),
      suspiciousPct: pct(suspicious),
      safePct: pct(safe),
    };
  }, [filteredScans]);

  const timeBuckets = useMemo<TimeBucket[]>(() => {
    if (filteredScans.length === 0) return [];
    const map = new Map<number, TimeBucket>();
    const fmt =
      effectiveUnit === 'minute'
        ? d3.timeFormat('%b %d, %H:%M')
        : effectiveUnit === 'hour'
          ? d3.timeFormat('%b %d, %H:00')
          : d3.timeFormat('%b %d, %Y');

    for (const scan of filteredScans) {
      const bucketDate = floorDate(new Date(scan.createdAt), effectiveUnit);
      const key = bucketDate.getTime();
      let entry = map.get(key);
      if (!entry) {
        entry = {
          date: bucketDate,
          label: fmt(bucketDate),
          highRisk: 0,
          suspicious: 0,
          safe: 0,
          total: 0,
        };
        map.set(key, entry);
      }
      if (scan.riskLevel === 'High Risk') entry.highRisk++;
      else if (scan.riskLevel === 'Suspicious') entry.suspicious++;
      else entry.safe++;
      entry.total++;
    }

    return Array.from(map.values()).sort(
      (a, b) => a.date.getTime() - b.date.getTime(),
    );
  }, [filteredScans, effectiveUnit]);

  // 1. D3 Risk Distribution Over Time (Stacked Area or Grouped Bars)
  useEffect(() => {
    const svgEl = trendSvgRef.current;
    if (!svgEl || timeBuckets.length === 0) return;

    const height = 310;
    const margin = { top: 20, right: 20, bottom: 42, left: 42 };
    const innerW = Math.max(trendWidth - margin.left - margin.right, 160);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${trendWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const tickFmt =
      effectiveUnit === 'minute'
        ? d3.timeFormat('%H:%M')
        : effectiveUnit === 'hour'
          ? d3.timeFormat('%m/%d %H:00')
          : d3.timeFormat('%b %d');

    if (chartMode === 'area' && timeBuckets.length >= 2) {
      const x = d3
        .scaleTime()
        .domain(d3.extent(timeBuckets, (d) => d.date) as [Date, Date])
        .range([0, innerW]);

      const yMax = Math.max(
        d3.max(timeBuckets, (d) => d.total) ?? 1,
        2,
      );
      const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

      // Horizontal gridlines
      g.append('g')
        .attr('class', 'grid')
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.min(yMax, 5))
            .tickSize(-innerW)
            .tickFormat(() => ''),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('line')
            .attr('stroke', '#E2E8F0')
            .attr('stroke-dasharray', '3,3'),
        );

      const stackGen = d3
        .stack<TimeBucket>()
        .keys(['safe', 'suspicious', 'highRisk']);
      const stacked = stackGen(timeBuckets);

      const colorByKey: Record<string, string> = {
        highRisk: '#DC2626',
        suspicious: '#D97706',
        safe: '#16A34A',
      };

      const areaGen = d3
        .area<d3.SeriesPoint<TimeBucket>>()
        .x((d) => x(d.data.date))
        .y0((d) => y(d[0]))
        .y1((d) => y(d[1]))
        .curve(d3.curveMonotoneX);

      const lineGen = d3
        .line<d3.SeriesPoint<TimeBucket>>()
        .x((d) => x(d.data.date))
        .y((d) => y(d[1]))
        .curve(d3.curveMonotoneX);

      g.selectAll('.risk-area')
        .data(stacked)
        .join('path')
        .attr('class', 'risk-area')
        .attr('fill', (d) => colorByKey[d.key])
        .attr('fill-opacity', 0.22)
        .attr('d', areaGen);

      g.selectAll('.risk-stroke')
        .data(stacked)
        .join('path')
        .attr('class', 'risk-stroke')
        .attr('fill', 'none')
        .attr('stroke', (d) => colorByKey[d.key])
        .attr('stroke-width', 2)
        .attr('d', lineGen);

      // Interactive hover targets per bucket
      const focusLine = g
        .append('line')
        .attr('y1', 0)
        .attr('y2', innerH)
        .attr('stroke', '#64748B')
        .attr('stroke-width', 1)
        .attr('stroke-dasharray', '3,3')
        .style('opacity', 0);

      const bisect = d3.bisector<TimeBucket, Date>((d) => d.date).left;

      g.append('rect')
        .attr('width', innerW)
        .attr('height', innerH)
        .attr('fill', 'transparent')
        .on('mousemove', (event) => {
          const [mx] = d3.pointer(event);
          const hoveredDate = x.invert(mx);
          const idx = bisect(timeBuckets, hoveredDate, 1);
          const d0 = timeBuckets[idx - 1];
          const d1 = timeBuckets[idx];
          let nearest = d0;
          if (d1 && d0) {
            nearest =
              hoveredDate.getTime() - d0.date.getTime() >
              d1.date.getTime() - hoveredDate.getTime()
                ? d1
                : d0;
          }
          if (nearest) {
            const cx = x(nearest.date);
            focusLine.attr('x1', cx).attr('x2', cx).style('opacity', 1);
            setTrendTooltip({
              x: cx + margin.left,
              y: margin.top + 12,
              bucket: nearest,
            });
          }
        })
        .on('mouseleave', () => {
          focusLine.style('opacity', 0);
          setTrendTooltip(null);
        });

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(
          d3
            .axisBottom(x)
            .ticks(Math.min(timeBuckets.length, 6))
            .tickFormat((d) => tickFmt(d as Date)),
        )
        .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', '#64748B')
            .attr('font-size', '11px')
            .attr('font-family', 'JetBrains Mono, monospace'),
        );

      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.min(yMax, 5))
            .tickFormat(d3.format('d')),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', '#64748B')
            .attr('font-size', '11px')
            .attr('font-family', 'JetBrains Mono, monospace'),
        );
    } else {
      // Grouped Bar Chart (also used cleanly when only 1 time bucket exists)
      const x0 = d3
        .scaleBand()
        .domain(timeBuckets.map((d) => d.label))
        .range([0, innerW])
        .paddingInner(0.24)
        .paddingOuter(0.12);

      const keys = ['highRisk', 'suspicious', 'safe'] as const;
      const x1 = d3
        .scaleBand()
        .domain(keys)
        .range([0, x0.bandwidth()])
        .padding(0.1);

      const yMax = Math.max(
        d3.max(timeBuckets, (d) => Math.max(d.highRisk, d.suspicious, d.safe)) ?? 1,
        2,
      );
      const y = d3.scaleLinear().domain([0, yMax]).nice().range([innerH, 0]);

      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.min(yMax, 5))
            .tickSize(-innerW)
            .tickFormat(() => ''),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('line')
            .attr('stroke', '#E2E8F0')
            .attr('stroke-dasharray', '3,3'),
        );

      const colorByKey: Record<string, string> = {
        highRisk: '#DC2626',
        suspicious: '#D97706',
        safe: '#16A34A',
      };

      const groups = g
        .selectAll('.bucket-group')
        .data(timeBuckets)
        .join('g')
        .attr('class', 'bucket-group')
        .attr('transform', (d) => `translate(${x0(d.label) ?? 0},0)`);

      groups
        .selectAll('rect')
        .data((d) => keys.map((k) => ({ key: k, value: d[k], bucket: d })))
        .join('rect')
        .attr('x', (d) => x1(d.key) ?? 0)
        .attr('y', (d) => y(d.value))
        .attr('width', Math.max(x1.bandwidth(), 4))
        .attr('height', (d) => innerH - y(d.value))
        .attr('rx', 3)
        .attr('fill', (d) => colorByKey[d.key])
        .style('cursor', 'pointer')
        .on('mouseenter', (_event, d) => {
          const gx = (x0(d.bucket.label) ?? 0) + x0.bandwidth() / 2 + margin.left;
          setTrendTooltip({
            x: gx,
            y: margin.top + 12,
            bucket: d.bucket,
          });
        })
        .on('mouseleave', () => setTrendTooltip(null));

      const maxLabels = Math.max(Math.floor(innerW / 110), 2);
      const step = Math.max(1, Math.ceil(timeBuckets.length / maxLabels));
      const tickVals = timeBuckets
        .filter((_, idx) => idx % step === 0)
        .map((d) => d.label);

      g.append('g')
        .attr('transform', `translate(0,${innerH})`)
        .call(d3.axisBottom(x0).tickValues(tickVals))
        .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', '#64748B')
            .attr('font-size', '11px')
            .attr('font-family', 'JetBrains Mono, monospace'),
        );

      g.append('g')
        .call(
          d3
            .axisLeft(y)
            .ticks(Math.min(yMax, 5))
            .tickFormat(d3.format('d')),
        )
        .call((axis) => axis.select('.domain').remove())
        .call((axis) =>
          axis
            .selectAll('text')
            .attr('fill', '#64748B')
            .attr('font-size', '11px')
            .attr('font-family', 'JetBrains Mono, monospace'),
        );
    }
  }, [timeBuckets, trendWidth, chartMode, effectiveUnit]);

  // 2. D3 Donut Chart for Overall Risk Share
  useEffect(() => {
    const svgEl = donutSvgRef.current;
    if (!svgEl || summary.total === 0) return;

    const size = 230;
    const radius = size / 2;
    const innerRadius = radius * 0.62;
    const outerRadius = radius - 8;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${size} ${size}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${radius},${radius})`);

    const pieData = [
      {
        label: 'High Risk',
        count: summary.highRisk,
        pct: summary.highPct,
        color: '#DC2626',
      },
      {
        label: 'Suspicious',
        count: summary.suspicious,
        pct: summary.suspiciousPct,
        color: '#D97706',
      },
      {
        label: 'Safe (No Known Threat)',
        count: summary.safe,
        pct: summary.safePct,
        color: '#16A34A',
      },
    ].filter((d) => d.count > 0);

    const pie = d3
      .pie<(typeof pieData)[number]>()
      .value((d) => d.count)
      .sort(null)
      .padAngle(0.025);

    const arc = d3
      .arc<d3.PieArcDatum<(typeof pieData)[number]>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius)
      .cornerRadius(3);

    const hoverArc = d3
      .arc<d3.PieArcDatum<(typeof pieData)[number]>>()
      .innerRadius(innerRadius)
      .outerRadius(outerRadius + 5)
      .cornerRadius(3);

    g.selectAll('path')
      .data(pie(pieData))
      .join('path')
      .attr('d', arc)
      .attr('fill', (d) => d.data.color)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('d', hoverArc(d));
        setDonutTooltip(d.data);
      })
      .on('mouseleave', function (_event, d) {
        d3.select(this).attr('d', arc(d));
        setDonutTooltip(null);
      });
  }, [summary]);

  // 3. D3 Phishing Probability Timeline (Individual Scan Scores)
  useEffect(() => {
    const svgEl = scoreSvgRef.current;
    if (!svgEl || filteredScans.length === 0) return;

    const height = 240;
    const margin = { top: 18, right: 20, bottom: 34, left: 46 };
    const innerW = Math.max(scoreWidth - margin.left - margin.right, 160);
    const innerH = height - margin.top - margin.bottom;

    const svg = d3.select(svgEl);
    svg.selectAll('*').remove();
    svg.attr('viewBox', `0 0 ${scoreWidth} ${height}`);

    const g = svg
      .append('g')
      .attr('transform', `translate(${margin.left},${margin.top})`);

    const dates = filteredScans.map((s) => new Date(s.createdAt));
    const minD = d3.min(dates) ?? new Date();
    const maxD = d3.max(dates) ?? new Date();
    const paddedMax =
      minD.getTime() === maxD.getTime()
        ? new Date(maxD.getTime() + 60 * 1000)
        : maxD;
    const paddedMin =
      minD.getTime() === maxD.getTime()
        ? new Date(minD.getTime() - 60 * 1000)
        : minD;

    const x = d3.scaleTime().domain([paddedMin, paddedMax]).range([0, innerW]);
    const y = d3.scaleLinear().domain([0, 100]).range([innerH, 0]);

    // Risk cutoff reference bands/lines (62% High Risk, 34% Suspicious)
    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(62))
      .attr('y2', y(62))
      .attr('stroke', '#FCA5A5')
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(62) - 5)
      .attr('text-anchor', 'end')
      .attr('fill', '#B91C1C')
      .attr('font-size', '10px')
      .text('High Risk threshold (62%)');

    g.append('line')
      .attr('x1', 0)
      .attr('x2', innerW)
      .attr('y1', y(34))
      .attr('y2', y(34))
      .attr('stroke', '#FCD34D')
      .attr('stroke-dasharray', '4,4');

    g.append('text')
      .attr('x', innerW - 4)
      .attr('y', y(34) - 5)
      .attr('text-anchor', 'end')
      .attr('fill', '#B45309')
      .attr('font-size', '10px')
      .text('Suspicious threshold (34%)');

    if (filteredScans.length >= 2) {
      const scoreLine = d3
        .line<ScanRecord>()
        .x((d) => x(new Date(d.createdAt)))
        .y((d) => y(d.phishingProbability))
        .curve(d3.curveMonotoneX);

      g.append('path')
        .datum(filteredScans)
        .attr('fill', 'none')
        .attr('stroke', '#94A3B8')
        .attr('stroke-width', 1.5)
        .attr('d', scoreLine);
    }

    const colorForScan = (s: ScanRecord) =>
      s.riskLevel === 'High Risk'
        ? '#DC2626'
        : s.riskLevel === 'Suspicious'
          ? '#D97706'
          : '#16A34A';

    g.selectAll('circle')
      .data(filteredScans)
      .join('circle')
      .attr('cx', (d) => x(new Date(d.createdAt)))
      .attr('cy', (d) => y(d.phishingProbability))
      .attr('r', 5)
      .attr('fill', colorForScan)
      .attr('stroke', '#FFFFFF')
      .attr('stroke-width', 1.5)
      .style('cursor', 'pointer')
      .on('mouseenter', function (_event, d) {
        d3.select(this).attr('r', 7);
        setScoreTooltip({
          x: x(new Date(d.createdAt)) + margin.left,
          y: y(d.phishingProbability) + margin.top,
          scan: d,
        });
      })
      .on('mouseleave', function () {
        d3.select(this).attr('r', 5);
        setScoreTooltip(null);
      })
      .on('click', (_event, d) => {
        onSelectScan(d);
      });

    const fmt =
      effectiveUnit === 'day' ? d3.timeFormat('%b %d') : d3.timeFormat('%H:%M');

    g.append('g')
      .attr('transform', `translate(0,${innerH})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(5)
          .tickFormat((d) => fmt(d as Date)),
      )
      .call((axis) => axis.select('.domain').attr('stroke', '#CBD5E1'))
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', '#64748B')
          .attr('font-size', '11px')
          .attr('font-family', 'JetBrains Mono, monospace'),
      );

    g.append('g')
      .call(
        d3
          .axisLeft(y)
          .tickValues([0, 34, 62, 100])
          .tickFormat((v) => `${v}%`),
      )
      .call((axis) => axis.select('.domain').remove())
      .call((axis) =>
        axis
          .selectAll('text')
          .attr('fill', '#64748B')
          .attr('font-size', '11px')
          .attr('font-family', 'JetBrains Mono, monospace'),
      );
  }, [filteredScans, scoreWidth, effectiveUnit, onSelectScan]);

  const handleRunSampleBatch = async () => {
    setIsSeedingBatch(true);
    try {
      await onRunBatchScans(SAMPLE_BATCH_URLS);
    } finally {
      setIsSeedingBatch(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-8 px-4 py-10 sm:px-6">
      {/* Header & Controls */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1">
          <h1 className="font-display text-3xl font-bold tracking-tight text-slate-950">
            Scan Trends Dashboard
          </h1>
          <p className="text-sm text-slate-600">
            Interactive D3.js distribution of High Risk, Suspicious, and Safe URL scans over time.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div
            role="group"
            aria-label="Filter by time window"
            className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1"
          >
            {(
              [
                { id: 'all', label: 'All Time' },
                { id: '24h', label: '24h' },
                { id: '7d', label: '7d' },
                { id: '30d', label: '30d' },
              ] as const
            ).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setTimeRange(opt.id)}
                className={`rounded-md px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                  timeRange === opt.id
                    ? 'bg-white text-slate-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {scans.length > 0 && (
            <button
              type="button"
              disabled={filteredScans.length === 0}
              onClick={() => downloadScansCsv(filteredScans, 'cybershield-scan-trends')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 hover:text-slate-950 disabled:cursor-not-allowed disabled:opacity-50 whitespace-nowrap shrink-0"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Export CSV</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onNavigate('scanner')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-700 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-800 whitespace-nowrap shrink-0"
          >
            <span>New URL Scan</span>
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Loading / Empty / Populated States */}
      {isLoading ? (
        <div className="space-y-6">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <div
                key={i}
                className="h-24 animate-pulse rounded-xl border border-slate-200 bg-white"
              />
            ))}
          </div>
          <div className="h-80 animate-pulse rounded-xl border border-slate-200 bg-white" />
        </div>
      ) : scans.length === 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-8 text-center sm:p-12">
          <BarChart3 className="mx-auto h-10 w-10 text-blue-700" aria-hidden="true" />
          <h2 className="mt-4 font-display text-xl font-semibold text-slate-950">
            No scan history available yet
          </h2>
          <p className="mx-auto mt-2 max-w-lg text-sm text-slate-600">
            Scan URLs in the scanner or run a sample batch of 10 real URLs through the Random
            Forest classifier to populate the time-series trend charts.
          </p>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={() => onNavigate('scanner')}
              className="rounded-lg bg-blue-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-800 whitespace-nowrap"
            >
              Open URL Scanner
            </button>
            <button
              type="button"
              disabled={isSeedingBatch}
              onClick={handleRunSampleBatch}
              className="rounded-lg border border-slate-200 bg-white px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60 whitespace-nowrap"
            >
              {isSeedingBatch ? 'Running 10 URL Scans...' : 'Run 10 Sample URL Scans'}
            </button>
          </div>
        </section>
      ) : (
        <>
          {/* 4-Column KPI Summary Strip */}
          <section className="grid grid-cols-2 divide-y divide-slate-200 rounded-xl border border-slate-200 bg-white sm:grid-cols-4 sm:divide-x sm:divide-y-0">
            <div className="p-5">
              <p className="text-xs font-medium text-slate-500">Total Scans</p>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {summary.total}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {timeBuckets.length} time {timeBuckets.length === 1 ? 'bucket' : 'buckets'}
              </p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-700">
                <ShieldAlert className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>High Risk</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {summary.highRisk}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{summary.highPct}% of scans</p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-amber-700">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Suspicious</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {summary.suspicious}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">
                {summary.suspiciousPct}% of scans
              </p>
            </div>

            <div className="p-5">
              <div className="flex items-center gap-1.5 text-xs font-medium text-emerald-700">
                <ShieldCheck className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                <span>Safe (No Known Threat)</span>
              </div>
              <p className="mt-1 font-mono text-2xl font-bold text-slate-950">
                {summary.safe}
              </p>
              <p className="mt-1 font-mono text-xs text-slate-500">{summary.safePct}% of scans</p>
            </div>
          </section>

          {filteredScans.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-10 text-center">
              <p className="text-sm font-medium text-slate-700">
                No scans recorded inside the selected time window.
              </p>
              <button
                type="button"
                onClick={() => setTimeRange('all')}
                className="mt-2 text-xs font-medium text-blue-700 hover:text-blue-800"
              >
                Show All Time
              </button>
            </div>
          ) : (
            <>
              {/* Primary Trend Chart + Donut Breakdown */}
              <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
                <section className="rounded-xl border border-slate-200 bg-white p-6 lg:col-span-8">
                  <div className="flex flex-col gap-3 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h2 className="font-display text-lg font-semibold text-slate-900">
                        Risk Distribution Over Time
                      </h2>
                      <p className="text-xs text-slate-500">
                        Grouped by {effectiveUnit} · Hover over the chart to inspect counts
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                        {(
                          [
                            { id: 'area', label: 'Stacked Area' },
                            { id: 'bar', label: 'Grouped Bars' },
                          ] as const
                        ).map((mode) => (
                          <button
                            key={mode.id}
                            type="button"
                            onClick={() => setChartMode(mode.id)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                              chartMode === mode.id
                                ? 'bg-white text-slate-950 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {mode.label}
                          </button>
                        ))}
                      </div>

                      <div className="inline-flex items-center gap-1 rounded-lg bg-slate-100 p-1">
                        {(
                          [
                            { id: 'auto', label: 'Auto' },
                            { id: 'minute', label: 'Min' },
                            { id: 'hour', label: 'Hour' },
                            { id: 'day', label: 'Day' },
                          ] as const
                        ).map((unit) => (
                          <button
                            key={unit.id}
                            type="button"
                            onClick={() => setGranularity(unit.id)}
                            className={`rounded-md px-2.5 py-1 text-xs font-medium whitespace-nowrap ${
                              granularity === unit.id
                                ? 'bg-white text-slate-950 shadow-xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {unit.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="mt-4 flex flex-wrap items-center gap-5 text-xs text-slate-600">
                    {RISK_SERIES.map((item) => (
                      <div key={item.key} className="flex items-center gap-2">
                        <span
                          className="h-2.5 w-2.5 rounded-xs"
                          style={{ backgroundColor: item.color }}
                          aria-hidden="true"
                        />
                        <span>{item.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* D3 SVG Container */}
                  <div ref={trendContainerRef} className="relative mt-3 w-full">
                    <svg ref={trendSvgRef} className="w-full overflow-visible" />

                    {trendTooltip && (
                      <div
                        className="pointer-events-none absolute z-10 w-52 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-sm backdrop-blur-xs"
                        style={{
                          left: Math.min(Math.max(trendTooltip.x - 104, 8), trendWidth - 216),
                          top: trendTooltip.y,
                        }}
                      >
                        <p className="font-mono font-semibold text-slate-900">
                          {trendTooltip.bucket.label}
                        </p>
                        <div className="mt-2 space-y-1">
                          <div className="flex justify-between">
                            <span className="text-red-700">High Risk</span>
                            <span className="font-mono font-medium text-slate-900">
                              {trendTooltip.bucket.highRisk}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-amber-700">Suspicious</span>
                            <span className="font-mono font-medium text-slate-900">
                              {trendTooltip.bucket.suspicious}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-emerald-700">Safe</span>
                            <span className="font-mono font-medium text-slate-900">
                              {trendTooltip.bucket.safe}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </section>

                {/* Donut Distribution Card */}
                <section className="flex flex-col justify-between rounded-xl border border-slate-200 bg-white p-6 lg:col-span-4">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Outcome Breakdown
                    </h2>
                    <p className="text-xs text-slate-500">
                      Share of classified scans across all three tiers.
                    </p>
                  </div>

                  <div className="relative mx-auto my-4 flex h-[230px] w-[230px] items-center justify-center">
                    <svg ref={donutSvgRef} className="h-full w-full" />
                    <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                      {donutTooltip ? (
                        <>
                          <span className="text-xs font-medium text-slate-500">
                            {donutTooltip.label}
                          </span>
                          <span className="font-mono text-2xl font-bold text-slate-950">
                            {donutTooltip.pct}%
                          </span>
                          <span className="font-mono text-xs text-slate-500">
                            {donutTooltip.count} scans
                          </span>
                        </>
                      ) : (
                        <>
                          <span className="text-xs text-slate-500">Total</span>
                          <span className="font-mono text-2xl font-bold text-slate-950">
                            {summary.total}
                          </span>
                          <span className="text-xs text-slate-500">URLs</span>
                        </>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2 border-t border-slate-100 pt-4 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-red-700">High Risk</span>
                      <span className="font-mono text-slate-900">
                        {summary.highRisk} ({summary.highPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-amber-700">Suspicious</span>
                      <span className="font-mono text-slate-900">
                        {summary.suspicious} ({summary.suspiciousPct}%)
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-emerald-700">
                        Safe (No Known Threat)
                      </span>
                      <span className="font-mono text-slate-900">
                        {summary.safe} ({summary.safePct}%)
                      </span>
                    </div>
                  </div>
                </section>
              </div>

              {/* Phishing Probability Timeline Scatter/Line Chart */}
              <section className="rounded-xl border border-slate-200 bg-white p-6">
                <div className="flex flex-col gap-2 border-b border-slate-100 pb-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-display text-lg font-semibold text-slate-900">
                      Phishing Score Timeline by Scan
                    </h2>
                    <p className="text-xs text-slate-500">
                      Individual Random Forest probability scores over time · Click any point to
                      inspect its full Result Page
                    </p>
                  </div>
                </div>

                <div ref={scoreContainerRef} className="relative mt-4 w-full">
                  <svg ref={scoreSvgRef} className="w-full overflow-visible" />

                  {scoreTooltip && (
                    <div
                      className="pointer-events-none absolute z-10 w-64 rounded-lg border border-slate-200 bg-white/95 p-3 text-xs shadow-sm backdrop-blur-xs"
                      style={{
                        left: Math.min(Math.max(scoreTooltip.x - 128, 8), scoreWidth - 264),
                        top: Math.max(scoreTooltip.y - 84, 4),
                      }}
                    >
                      <p className="truncate font-mono font-medium text-slate-900">
                        {scoreTooltip.scan.hostname}
                      </p>
                      <p className="mt-1 text-slate-600">
                        {scoreTooltip.scan.riskLevel} ·{' '}
                        <span className="font-mono font-semibold text-slate-900">
                          {scoreTooltip.scan.phishingProbability.toFixed(1)}%
                        </span>
                      </p>
                      <p className="mt-0.5 font-mono text-[11px] text-slate-500">
                        {new Date(scoreTooltip.scan.createdAt).toLocaleString()}
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
