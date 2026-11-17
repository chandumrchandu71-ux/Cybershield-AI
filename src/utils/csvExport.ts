import type { ScanRecord } from '../types/scan.ts';

function escapeCsvCell(raw: string | number | boolean): string {
  const str = String(raw);
  // Mitigate spreadsheet formula injection for untrusted text fields
  const safeStr = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  if (/[",\n\r]/.test(safeStr)) {
    return `"${safeStr.replace(/"/g, '""')}"`;
  }
  return safeStr;
}

export function buildScansCsv(scans: ScanRecord[]): string {
  const headers = [
    'scan_id',
    'scanned_at',
    'url',
    'normalized_url',
    'hostname',
    'protocol',
    'subdomain',
    'registrable_domain',
    'tld',
    'risk_level',
    'phishing_probability_pct',
    'phishing_tree_votes',
    'legitimate_tree_votes',
    'total_trees',
    'url_length',
    'hostname_length',
    'path_length',
    'subdomain_count',
    'has_ip_address',
    'has_at_symbol',
    'hyphen_count',
    'special_char_count',
    'digit_count',
    'digit_ratio',
    'is_https',
    'double_slash_in_path',
    'suspicious_keyword_count',
    'brand_impersonation',
    'has_suspicious_tld',
    'hostname_entropy',
    'triggered_signals',
  ];

  const rows = scans.map((scan) => {
    const f = scan.features;
    const signalSummary = scan.signals.map((s) => s.title).join('; ');
    const cells: Array<string | number> = [
      scan.id,
      scan.createdAt,
      scan.url,
      scan.normalizedUrl,
      scan.hostname,
      scan.anatomy.protocol,
      scan.anatomy.subdomain || '',
      scan.anatomy.registrableDomain,
      scan.anatomy.tld,
      scan.riskLevel,
      scan.phishingProbability.toFixed(1),
      scan.treeVotes.phishing,
      scan.treeVotes.legitimate,
      scan.treeVotes.total,
      f.urlLength,
      f.hostnameLength,
      f.pathLength,
      f.subdomainCount,
      f.hasIpAddress,
      f.hasAtSymbol,
      f.hyphenCount,
      f.specialCharCount,
      f.digitCount,
      f.digitRatio,
      f.isHttps,
      f.doubleSlashInPath,
      f.suspiciousKeywordCount,
      f.brandImpersonation,
      f.hasSuspiciousTld,
      f.hostnameEntropy,
      signalSummary,
    ];
    return cells.map(escapeCsvCell).join(',');
  });

  return [headers.join(','), ...rows].join('\r\n');
}

export function downloadScansCsv(scans: ScanRecord[], filenamePrefix = 'cybershield-scans'): void {
  if (scans.length === 0) return;
  const csv = buildScansCsv(scans);
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const dateStamp = new Date().toISOString().slice(0, 10);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filenamePrefix}-${dateStamp}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
