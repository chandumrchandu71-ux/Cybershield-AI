export type RiskLevel =
  | 'High Risk'
  | 'Suspicious'
  | 'No Known Threat Detected';

export interface UrlFeatures {
  urlLength: number;
  hostnameLength: number;
  pathLength: number;
  subdomainCount: number;
  hasIpAddress: number;
  hasAtSymbol: number;
  hyphenCount: number;
  specialCharCount: number;
  digitCount: number;
  digitRatio: number;
  isHttps: number;
  doubleSlashInPath: number;
  suspiciousKeywordCount: number;
  brandImpersonation: number;
  hasSuspiciousTld: number;
  hostnameEntropy: number;
}

export interface FeatureDescriptor {
  key: keyof UrlFeatures;
  label: string;
  value: number;
  formattedValue: string;
  status: 'normal' | 'elevated' | 'critical';
  explanation: string;
}

export interface ParsedUrlAnatomy {
  rawUrl: string;
  normalizedUrl: string;
  protocol: string;
  protocolAssumed: boolean;
  hostname: string;
  subdomain: string;
  registrableDomain: string;
  tld: string;
  pathAndQuery: string;
}

export interface TriggeredSignal {
  title: string;
  detail: string;
  severity: 'critical' | 'warning' | 'pass';
}

export interface ScanRecord {
  id: number;
  url: string;
  normalizedUrl: string;
  hostname: string;
  anatomy: ParsedUrlAnatomy;
  riskLevel: RiskLevel;
  riskHeadline: string;
  phishingProbability: number;
  treeVotes: {
    phishing: number;
    legitimate: number;
    total: number;
  };
  features: UrlFeatures;
  featureDescriptors: FeatureDescriptor[];
  signals: TriggeredSignal[];
  recommendations: string[];
  createdAt: string;
}

export interface FeatureImportanceItem {
  key: keyof UrlFeatures;
  label: string;
  importance: number;
}

export interface TestSampleEvaluation {
  url: string;
  actualLabel: 'Phishing' | 'Legitimate';
  predictedLabel: 'Phishing' | 'Legitimate';
  riskLevel: RiskLevel;
  phishingProbability: number;
  correct: boolean;
}

export interface ModelEvaluationMetrics {
  algorithm: string;
  nEstimators: number;
  maxDepth: number;
  featuresPerSplit: number;
  featureCount: number;
  datasetSize: number;
  trainSize: number;
  testSize: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  falsePositiveRate: number;
  falseNegativeRate: number;
  confusionMatrix: {
    truePositives: number;
    trueNegatives: number;
    falsePositives: number;
    falseNegatives: number;
  };
  featureImportances: FeatureImportanceItem[];
  unseenTestSamples: TestSampleEvaluation[];
}
