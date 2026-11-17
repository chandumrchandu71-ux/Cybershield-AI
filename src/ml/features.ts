import type {
  FeatureDescriptor,
  ParsedUrlAnatomy,
  UrlFeatures,
} from '../types/scan.ts';

const SUSPICIOUS_TLDS = new Set([
  'xyz',
  'top',
  'tk',
  'ml',
  'ga',
  'cf',
  'gq',
  'buzz',
  'club',
  'icu',
  'work',
  'click',
  'link',
  'support',
  'info',
  'pw',
  'cc',
  'vip',
  'loan',
  'bid',
  'win',
  'site',
  'online',
]);

const SUSPICIOUS_KEYWORDS = [
  'login',
  'signin',
  'sign-in',
  'verify',
  'verification',
  'update',
  'secure',
  'security',
  'account',
  'banking',
  'confirm',
  'wallet',
  'suspend',
  'suspended',
  'unlock',
  'password',
  'webscr',
  'ebayisapi',
  'billing',
  'recover',
  'auth',
  'authenticate',
  'credential',
  'otp',
  'kyc',
  'invoice',
  'claim',
  'gift',
  'free',
];

const BRAND_DOMAINS: Array<{ keyword: string; officialRoots: string[] }> = [
  { keyword: 'paypal', officialRoots: ['paypal.com', 'paypal.me'] },
  { keyword: 'paypa1', officialRoots: [] },
  { keyword: 'apple', officialRoots: ['apple.com', 'icloud.com'] },
  { keyword: 'icloud', officialRoots: ['icloud.com', 'apple.com'] },
  { keyword: 'microsoft', officialRoots: ['microsoft.com', 'live.com', 'office.com', 'outlook.com'] },
  { keyword: 'office365', officialRoots: ['microsoft.com', 'office.com'] },
  { keyword: 'google', officialRoots: ['google.com', 'accounts.google.com', 'youtube.com'] },
  { keyword: 'g00gle', officialRoots: [] },
  { keyword: 'amazon', officialRoots: ['amazon.com', 'amazon.co.uk', 'amazon.in', 'aws.amazon.com'] },
  { keyword: 'amaz0n', officialRoots: [] },
  { keyword: 'netflix', officialRoots: ['netflix.com'] },
  { keyword: 'chase', officialRoots: ['chase.com'] },
  { keyword: 'bankofamerica', officialRoots: ['bankofamerica.com'] },
  { keyword: 'wellsfargo', officialRoots: ['wellsfargo.com'] },
  { keyword: 'citibank', officialRoots: ['citibank.com', 'citi.com'] },
  { keyword: 'hsbc', officialRoots: ['hsbc.com', 'hsbc.co.uk'] },
  { keyword: 'hdfc', officialRoots: ['hdfcbank.com'] },
  { keyword: 'sbi', officialRoots: ['onlinesbi.sbi', 'sbi.co.in'] },
  { keyword: 'icici', officialRoots: ['icicibank.com'] },
  { keyword: 'coinbase', officialRoots: ['coinbase.com'] },
  { keyword: 'binance', officialRoots: ['binance.com'] },
  { keyword: 'metamask', officialRoots: ['metamask.io'] },
  { keyword: 'instagram', officialRoots: ['instagram.com'] },
  { keyword: 'facebook', officialRoots: ['facebook.com'] },
  { keyword: 'whatsapp', officialRoots: ['whatsapp.com'] },
  { keyword: 'dhl', officialRoots: ['dhl.com'] },
  { keyword: 'fedex', officialRoots: ['fedex.com'] },
  { keyword: 'ups', officialRoots: ['ups.com'] },
  { keyword: 'usps', officialRoots: ['usps.com'] },
  { keyword: 'irs', officialRoots: ['irs.gov'] },
  { keyword: 'dropbox', officialRoots: ['dropbox.com'] },
  { keyword: 'adobe', officialRoots: ['adobe.com'] },
  { keyword: 'linkedin', officialRoots: ['linkedin.com'] },
  { keyword: 'steam', officialRoots: ['steampowered.com', 'steamcommunity.com'] },
];

const MULTI_PART_PUBLIC_SUFFIXES = new Set([
  'co.uk',
  'org.uk',
  'ac.uk',
  'gov.uk',
  'co.in',
  'org.in',
  'gov.in',
  'com.au',
  'com.br',
  'co.jp',
  'co.za',
]);

export const FEATURE_ORDER: Array<keyof UrlFeatures> = [
  'urlLength',
  'hostnameLength',
  'pathLength',
  'subdomainCount',
  'hasIpAddress',
  'hasAtSymbol',
  'hyphenCount',
  'specialCharCount',
  'digitCount',
  'digitRatio',
  'isHttps',
  'doubleSlashInPath',
  'suspiciousKeywordCount',
  'brandImpersonation',
  'hasSuspiciousTld',
  'hostnameEntropy',
];

export const FEATURE_LABELS: Record<keyof UrlFeatures, string> = {
  urlLength: 'Total URL Length',
  hostnameLength: 'Hostname Length',
  pathLength: 'Path & Query Length',
  subdomainCount: 'Subdomain Depth',
  hasIpAddress: 'IP Address Literal',
  hasAtSymbol: 'At-Symbol (@) Masking',
  hyphenCount: 'Hostname Hyphens',
  specialCharCount: 'Special Characters',
  digitCount: 'Hostname Digits',
  digitRatio: 'Hostname Digit Ratio',
  isHttps: 'HTTPS Encryption',
  doubleSlashInPath: 'Double-Slash Redirect',
  suspiciousKeywordCount: 'Phishing Lure Keywords',
  brandImpersonation: 'Brand Impersonation',
  hasSuspiciousTld: 'High-Risk TLD',
  hostnameEntropy: 'Hostname Entropy',
};

function isIpv4(host: string): boolean {
  const parts = host.split('.');
  if (parts.length !== 4) return false;
  return parts.every((p) => {
    if (!/^\d{1,3}$/.test(p)) return false;
    const n = Number(p);
    return n >= 0 && n <= 255;
  });
}

function isIpLiteral(host: string): boolean {
  if (isIpv4(host)) return true;
  if (host.startsWith('[') && host.endsWith(']')) return true;
  if (/^0x[0-9a-f]+$/i.test(host) || /^\d{8,12}$/.test(host)) return true;
  return false;
}

function shannonEntropy(input: string): number {
  if (!input) return 0;
  const counts = new Map<string, number>();
  for (const ch of input) {
    counts.set(ch, (counts.get(ch) ?? 0) + 1);
  }
  let entropy = 0;
  const len = input.length;
  for (const count of counts.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  return Number(entropy.toFixed(3));
}

export function normalizeAndParseUrl(rawInput: string): ParsedUrlAnatomy {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error('Please enter a website URL to scan.');
  }
  if (/\s/.test(trimmed)) {
    throw new Error('URLs cannot contain spaces. Remove spaces and try again.');
  }

  const hasExplicitScheme = /^[a-zA-Z][a-zA-Z0-9+.-]*:\/\//.test(trimmed);
  const candidate = hasExplicitScheme ? trimmed : `http://${trimmed}`;

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error('Enter a valid web URL such as https://example.com/login');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Only http:// and https:// website links can be analyzed.');
  }

  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || (!hostname.includes('.') && !isIpLiteral(hostname) && hostname !== 'localhost')) {
    throw new Error('Enter a valid domain name or IP address (for example, example.com).');
  }

  let subdomain = '';
  let registrableDomain = hostname;
  let tld = '';
  let subdomainCount = 0;

  if (!isIpLiteral(hostname)) {
    const parts = hostname.split('.').filter(Boolean);
    if (parts.length >= 2) {
      const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
      if (parts.length >= 3 && MULTI_PART_PUBLIC_SUFFIXES.has(lastTwo)) {
        tld = lastTwo;
        registrableDomain = `${parts[parts.length - 3]}.${lastTwo}`;
        const subParts = parts.slice(0, parts.length - 3);
        subdomain = subParts.join('.');
        subdomainCount = subParts.length;
      } else {
        tld = parts[parts.length - 1];
        registrableDomain = lastTwo;
        const subParts = parts.slice(0, parts.length - 2);
        subdomain = subParts.join('.');
        subdomainCount = subParts.length;
      }
    }
  }

  // Ignore pure 'www' when measuring deceptive subdomain depth
  const effectiveSubParts = subdomain
    ? subdomain.split('.').filter((p) => p !== 'www')
    : [];
  void effectiveSubParts;

  return {
    rawUrl: trimmed,
    normalizedUrl: parsed.toString(),
    protocol: parsed.protocol.replace(':', ''),
    protocolAssumed: !hasExplicitScheme,
    hostname,
    subdomain,
    registrableDomain,
    tld,
    pathAndQuery: `${parsed.pathname}${parsed.search}${parsed.hash}`,
  };
}

export function extractUrlFeatures(rawInput: string): {
  anatomy: ParsedUrlAnatomy;
  features: UrlFeatures;
  descriptors: FeatureDescriptor[];
  matchedKeywords: string[];
  impersonatedBrands: string[];
} {
  const anatomy = normalizeAndParseUrl(rawInput);
  const fullUrl = anatomy.normalizedUrl;
  const host = anatomy.hostname;
  const pathLower = anatomy.pathAndQuery.toLowerCase();
  const combinedLower = `${host}${pathLower}`;

  const ipFlag = isIpLiteral(host) ? 1 : 0;

  let subdomainCount = 0;
  if (!ipFlag && anatomy.subdomain) {
    const subParts = anatomy.subdomain.split('.').filter((p) => p !== 'www');
    subdomainCount = subParts.length;
  }

  const hasAtSymbol = rawInput.includes('@') || fullUrl.includes('@') ? 1 : 0;
  const hyphenCount = (host.match(/-/g) ?? []).length;
  const specialChars = fullUrl.match(/[?=&%_~;$!*+,]/g) ?? [];
  const specialCharCount = specialChars.length;
  const digits = host.match(/\d/g) ?? [];
  const digitCount = digits.length;
  const digitRatio = host.length > 0 ? Number((digitCount / host.length).toFixed(3)) : 0;
  const isHttps = anatomy.protocol === 'https' && !anatomy.protocolAssumed ? 1 : 0;

  const schemeEnd = fullUrl.indexOf('://') + 3;
  const afterScheme = fullUrl.slice(schemeEnd);
  const slashIndex = afterScheme.indexOf('/');
  const pathSection = slashIndex >= 0 ? afterScheme.slice(slashIndex) : '';
  const doubleSlashInPath = pathSection.includes('//') ? 1 : 0;

  const matchedKeywords: string[] = [];
  for (const kw of SUSPICIOUS_KEYWORDS) {
    if (combinedLower.includes(kw)) {
      matchedKeywords.push(kw);
    }
  }
  const suspiciousKeywordCount = matchedKeywords.length;

  const impersonatedBrands: string[] = [];
  for (const brand of BRAND_DOMAINS) {
    const inHost = host.includes(brand.keyword);
    const inPath = pathLower.includes(brand.keyword);
    if (inHost || inPath) {
      const isOfficial = brand.officialRoots.some(
        (root) =>
          anatomy.registrableDomain === root ||
          anatomy.hostname === root ||
          anatomy.hostname.endsWith(`.${root}`),
      );
      if (!isOfficial) {
        impersonatedBrands.push(brand.keyword);
      }
    }
  }
  const brandImpersonation = impersonatedBrands.length > 0 ? 1 : 0;

  const topTld = anatomy.tld.split('.').pop() ?? '';
  const hasSuspiciousTld = SUSPICIOUS_TLDS.has(topTld) ? 1 : 0;
  const hostnameEntropy = shannonEntropy(host.replace(/\./g, ''));

  const features: UrlFeatures = {
    urlLength: fullUrl.length,
    hostnameLength: host.length,
    pathLength: anatomy.pathAndQuery.length,
    subdomainCount,
    hasIpAddress: ipFlag,
    hasAtSymbol,
    hyphenCount,
    specialCharCount,
    digitCount,
    digitRatio,
    isHttps,
    doubleSlashInPath,
    suspiciousKeywordCount,
    brandImpersonation,
    hasSuspiciousTld,
    hostnameEntropy,
  };

  const descriptors: FeatureDescriptor[] = [
    {
      key: 'urlLength',
      label: FEATURE_LABELS.urlLength,
      value: features.urlLength,
      formattedValue: `${features.urlLength} chars`,
      status: features.urlLength > 95 ? 'critical' : features.urlLength > 65 ? 'elevated' : 'normal',
      explanation: 'Phishing links often exceed 75 characters to hide deceptive hosts or parameters.',
    },
    {
      key: 'hostnameLength',
      label: FEATURE_LABELS.hostnameLength,
      value: features.hostnameLength,
      formattedValue: `${features.hostnameLength} chars`,
      status: features.hostnameLength > 34 ? 'critical' : features.hostnameLength > 24 ? 'elevated' : 'normal',
      explanation: 'Unusually long hostnames frequently indicate keyword stuffing or spoofed prefixes.',
    },
    {
      key: 'subdomainCount',
      label: FEATURE_LABELS.subdomainCount,
      value: features.subdomainCount,
      formattedValue: `${features.subdomainCount}`,
      status: features.subdomainCount >= 3 ? 'critical' : features.subdomainCount >= 2 ? 'elevated' : 'normal',
      explanation: 'Multiple subdomains (e.g., login.bank.verify.example.xyz) imitate trusted brands.',
    },
    {
      key: 'hasIpAddress',
      label: FEATURE_LABELS.hasIpAddress,
      value: features.hasIpAddress,
      formattedValue: features.hasIpAddress ? 'Detected' : 'None',
      status: features.hasIpAddress ? 'critical' : 'normal',
      explanation: 'Legitimate consumer sites almost never serve login pages via raw IP addresses.',
    },
    {
      key: 'brandImpersonation',
      label: FEATURE_LABELS.brandImpersonation,
      value: features.brandImpersonation,
      formattedValue: features.brandImpersonation
        ? `Match (${impersonatedBrands.join(', ')})`
        : 'None',
      status: features.brandImpersonation ? 'critical' : 'normal',
      explanation: 'Detects well-known brand names placed inside an unrelated registrable domain or path.',
    },
    {
      key: 'suspiciousKeywordCount',
      label: FEATURE_LABELS.suspiciousKeywordCount,
      value: features.suspiciousKeywordCount,
      formattedValue:
        matchedKeywords.length > 0
          ? `${features.suspiciousKeywordCount} (${matchedKeywords.slice(0, 3).join(', ')})`
          : '0',
      status:
        features.suspiciousKeywordCount >= 3
          ? 'critical'
          : features.suspiciousKeywordCount >= 1
            ? 'elevated'
            : 'normal',
      explanation: 'Counts urgency or credential-lure terms like verify, login, update, suspend, or wallet.',
    },
    {
      key: 'hasSuspiciousTld',
      label: FEATURE_LABELS.hasSuspiciousTld,
      value: features.hasSuspiciousTld,
      formattedValue: features.hasSuspiciousTld ? `.${topTld} (Flagged)` : `.${topTld || 'n/a'}`,
      status: features.hasSuspiciousTld ? 'critical' : 'normal',
      explanation: 'Low-cost or disposable TLDs appear disproportionately in short-lived phishing campaigns.',
    },
    {
      key: 'isHttps',
      label: FEATURE_LABELS.isHttps,
      value: features.isHttps,
      formattedValue: features.isHttps ? 'HTTPS' : 'HTTP / Missing',
      status: features.isHttps ? 'normal' : 'elevated',
      explanation: 'Checks whether the link explicitly enforces encrypted HTTPS transport.',
    },
    {
      key: 'hyphenCount',
      label: FEATURE_LABELS.hyphenCount,
      value: features.hyphenCount,
      formattedValue: `${features.hyphenCount}`,
      status: features.hyphenCount >= 3 ? 'critical' : features.hyphenCount >= 2 ? 'elevated' : 'normal',
      explanation: 'Phishing domains frequently join impersonated words with hyphens (e.g., secure-bank-login).',
    },
    {
      key: 'specialCharCount',
      label: FEATURE_LABELS.specialCharCount,
      value: features.specialCharCount,
      formattedValue: `${features.specialCharCount}`,
      status: features.specialCharCount >= 8 ? 'critical' : features.specialCharCount >= 5 ? 'elevated' : 'normal',
      explanation: 'Excessive query delimiters, encoded characters, or symbol noise in the URL string.',
    },
    {
      key: 'hasAtSymbol',
      label: FEATURE_LABELS.hasAtSymbol,
      value: features.hasAtSymbol,
      formattedValue: features.hasAtSymbol ? 'Detected' : 'None',
      status: features.hasAtSymbol ? 'critical' : 'normal',
      explanation: 'The @ symbol causes browsers to ignore text before it and navigate to the trailing host.',
    },
    {
      key: 'doubleSlashInPath',
      label: FEATURE_LABELS.doubleSlashInPath,
      value: features.doubleSlashInPath,
      formattedValue: features.doubleSlashInPath ? 'Detected' : 'None',
      status: features.doubleSlashInPath ? 'critical' : 'normal',
      explanation: 'A // sequence inside the URL path often indicates an open-redirect chain.',
    },
    {
      key: 'digitCount',
      label: FEATURE_LABELS.digitCount,
      value: features.digitCount,
      formattedValue: `${features.digitCount} (${(features.digitRatio * 100).toFixed(0)}%)`,
      status: features.digitRatio > 0.25 ? 'critical' : features.digitCount >= 3 ? 'elevated' : 'normal',
      explanation: 'High digit density in a domain can signal auto-generated hosts or homoglyph swaps (paypa1).',
    },
    {
      key: 'hostnameEntropy',
      label: FEATURE_LABELS.hostnameEntropy,
      value: features.hostnameEntropy,
      formattedValue: `${features.hostnameEntropy.toFixed(2)} bits`,
      status: features.hostnameEntropy >= 3.8 ? 'critical' : features.hostnameEntropy >= 3.45 ? 'elevated' : 'normal',
      explanation: 'Measures character randomness in the hostname to detect algorithmically generated domains.',
    },
    {
      key: 'pathLength',
      label: FEATURE_LABELS.pathLength,
      value: features.pathLength,
      formattedValue: `${features.pathLength} chars`,
      status: features.pathLength > 60 ? 'elevated' : 'normal',
      explanation: 'Length of the path, query string, and fragment following the domain.',
    },
    {
      key: 'digitRatio',
      label: FEATURE_LABELS.digitRatio,
      value: features.digitRatio,
      formattedValue: `${(features.digitRatio * 100).toFixed(1)}%`,
      status: features.digitRatio > 0.25 ? 'critical' : features.digitRatio > 0.12 ? 'elevated' : 'normal',
      explanation: 'Proportion of numeric characters inside the hostname string.',
    },
  ];

  return {
    anatomy,
    features,
    descriptors,
    matchedKeywords,
    impersonatedBrands,
  };
}

export function vectorizeFeatures(features: UrlFeatures): number[] {
  return FEATURE_ORDER.map((key) => features[key]);
}
