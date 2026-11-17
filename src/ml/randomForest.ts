import { PHISHING_DATASET } from './dataset.ts';
import {
  extractUrlFeatures,
  FEATURE_LABELS,
  FEATURE_ORDER,
  vectorizeFeatures,
} from './features.ts';
import type {
  ModelEvaluationMetrics,
  RiskLevel,
  ScanRecord,
  TestSampleEvaluation,
  TriggeredSignal,
  UrlFeatures,
} from '../types/scan.ts';

interface TreeNode {
  leaf: boolean;
  prediction?: 0 | 1;
  phishingRate?: number;
  featureIndex?: number;
  threshold?: number;
  left?: TreeNode;
  right?: TreeNode;
}

interface TrainingRow {
  vector: number[];
  label: 0 | 1;
  url: string;
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function giniImpurity(labels: Array<0 | 1>): number {
  if (labels.length === 0) return 0;
  let positives = 0;
  for (const l of labels) {
    positives += l;
  }
  const p1 = positives / labels.length;
  const p0 = 1 - p1;
  return 1 - (p0 * p0 + p1 * p1);
}

function sampleFeatures(totalFeatures: number, maxFeatures: number, rng: () => number): number[] {
  const indices = Array.from({ length: totalFeatures }, (_, idx) => idx);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = indices[i];
    indices[i] = indices[j];
    indices[j] = tmp;
  }
  return indices.slice(0, maxFeatures);
}

function buildCartTree(
  rows: TrainingRow[],
  depth: number,
  maxDepth: number,
  minSamplesSplit: number,
  maxFeatures: number,
  rng: () => number,
  importanceAccumulator: number[],
  totalSamples: number,
): TreeNode {
  const labels = rows.map((r) => r.label);
  const positives = labels.reduce<number>((sum, l) => sum + l, 0);
  const phishingRate = positives / rows.length;
  const majorityClass: 0 | 1 = positives * 2 >= rows.length ? 1 : 0;

  if (
    depth >= maxDepth ||
    rows.length < minSamplesSplit ||
    positives === 0 ||
    positives === rows.length
  ) {
    return { leaf: true, prediction: majorityClass, phishingRate };
  }

  const parentGini = giniImpurity(labels);
  const candidateFeatures = sampleFeatures(FEATURE_ORDER.length, maxFeatures, rng);

  let bestGain = 0;
  let bestFeatureIndex = -1;
  let bestThreshold = 0;
  let bestLeft: TrainingRow[] = [];
  let bestRight: TrainingRow[] = [];

  for (const fIdx of candidateFeatures) {
    const uniqueVals = Array.from(new Set(rows.map((r) => r.vector[fIdx]))).sort((a, b) => a - b);
    if (uniqueVals.length <= 1) continue;

    for (let i = 0; i < uniqueVals.length - 1; i++) {
      const threshold = (uniqueVals[i] + uniqueVals[i + 1]) / 2;
      const leftRows: TrainingRow[] = [];
      const rightRows: TrainingRow[] = [];

      for (const row of rows) {
        if (row.vector[fIdx] <= threshold) {
          leftRows.push(row);
        } else {
          rightRows.push(row);
        }
      }

      if (leftRows.length === 0 || rightRows.length === 0) continue;

      const leftGini = giniImpurity(leftRows.map((r) => r.label));
      const rightGini = giniImpurity(rightRows.map((r) => r.label));
      const weightedGini =
        (leftRows.length / rows.length) * leftGini +
        (rightRows.length / rows.length) * rightGini;
      const gain = parentGini - weightedGini;

      if (gain > bestGain) {
        bestGain = gain;
        bestFeatureIndex = fIdx;
        bestThreshold = threshold;
        bestLeft = leftRows;
        bestRight = rightRows;
      }
    }
  }

  if (bestFeatureIndex === -1 || bestGain <= 1e-6) {
    return { leaf: true, prediction: majorityClass, phishingRate };
  }

  importanceAccumulator[bestFeatureIndex] += (rows.length / totalSamples) * bestGain;

  return {
    leaf: false,
    featureIndex: bestFeatureIndex,
    threshold: bestThreshold,
    left: buildCartTree(
      bestLeft,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccumulator,
      totalSamples,
    ),
    right: buildCartTree(
      bestRight,
      depth + 1,
      maxDepth,
      minSamplesSplit,
      maxFeatures,
      rng,
      importanceAccumulator,
      totalSamples,
    ),
  };
}

function predictSingleTree(node: TreeNode, vector: number[]): 0 | 1 {
  let cursor = node;
  while (!cursor.leaf) {
    const idx = cursor.featureIndex ?? 0;
    const threshold = cursor.threshold ?? 0;
    cursor = vector[idx] <= threshold ? (cursor.left ?? cursor) : (cursor.right ?? cursor);
  }
  return cursor.prediction ?? 0;
}

class RandomForestPhishingClassifier {
  private readonly nEstimators = 41;
  private readonly maxDepth = 7;
  private readonly minSamplesSplit = 3;
  private readonly featuresPerSplit = 4;
  private trees: TreeNode[] = [];
  private evaluationMetrics: ModelEvaluationMetrics;

  constructor() {
    this.evaluationMetrics = this.trainAndEvaluate();
  }

  private trainAndEvaluate(): ModelEvaluationMetrics {
    const rng = createSeededRng(20261117);
    const trainSamples: TrainingRow[] = [];
    const testSamples: Array<TrainingRow & { url: string }> = [];

    for (const sample of PHISHING_DATASET) {
      const { features } = extractUrlFeatures(sample.url);
      const row: TrainingRow = {
        vector: vectorizeFeatures(features),
        label: sample.label,
        url: sample.url,
      };
      if (sample.split === 'train') {
        trainSamples.push(row);
      } else {
        testSamples.push(row);
      }
    }

    const importanceAccumulator = new Array<number>(FEATURE_ORDER.length).fill(0);
    this.trees = [];

    for (let t = 0; t < this.nEstimators; t++) {
      const bootstrap: TrainingRow[] = [];
      for (let i = 0; i < trainSamples.length; i++) {
        const idx = Math.floor(rng() * trainSamples.length);
        bootstrap.push(trainSamples[idx]);
      }

      const tree = buildCartTree(
        bootstrap,
        0,
        this.maxDepth,
        this.minSamplesSplit,
        this.featuresPerSplit,
        rng,
        importanceAccumulator,
        bootstrap.length,
      );
      this.trees.push(tree);
    }

    const totalImportance = importanceAccumulator.reduce((a, b) => a + b, 0) || 1;
    const featureImportances = FEATURE_ORDER.map((key, idx) => ({
      key,
      label: FEATURE_LABELS[key],
      importance: Number(((importanceAccumulator[idx] / totalImportance) * 100).toFixed(1)),
    })).sort((a, b) => b.importance - a.importance);

    let tp = 0;
    let tn = 0;
    let fp = 0;
    let fn = 0;
    const unseenEvaluations: TestSampleEvaluation[] = [];

    for (const sample of testSamples) {
      const { phishingVotes } = this.vote(sample.vector);
      const probability = phishingVotes / this.nEstimators;
      const predictedBinary: 0 | 1 = probability >= 0.5 ? 1 : 0;
      const riskLevel = this.mapRiskLevel(probability);

      if (sample.label === 1 && predictedBinary === 1) tp++;
      else if (sample.label === 0 && predictedBinary === 0) tn++;
      else if (sample.label === 0 && predictedBinary === 1) fp++;
      else if (sample.label === 1 && predictedBinary === 0) fn++;

      unseenEvaluations.push({
        url: sample.url,
        actualLabel: sample.label === 1 ? 'Phishing' : 'Legitimate',
        predictedLabel: predictedBinary === 1 ? 'Phishing' : 'Legitimate',
        riskLevel,
        phishingProbability: Number((probability * 100).toFixed(1)),
        correct: predictedBinary === sample.label,
      });
    }

    const total = testSamples.length || 1;
    const accuracy = Number((((tp + tn) / total) * 100).toFixed(1));
    const precision = tp + fp > 0 ? Number(((tp / (tp + fp)) * 100).toFixed(1)) : 0;
    const recall = tp + fn > 0 ? Number(((tp / (tp + fn)) * 100).toFixed(1)) : 0;
    const f1Score =
      precision + recall > 0
        ? Number(((2 * precision * recall) / (precision + recall)).toFixed(1))
        : 0;
    const falsePositiveRate = tn + fp > 0 ? Number(((fp / (tn + fp)) * 100).toFixed(1)) : 0;
    const falseNegativeRate = tp + fn > 0 ? Number(((fn / (tp + fn)) * 100).toFixed(1)) : 0;

    return {
      algorithm: 'Random Forest Classifier (CART Ensemble)',
      nEstimators: this.nEstimators,
      maxDepth: this.maxDepth,
      featuresPerSplit: this.featuresPerSplit,
      featureCount: FEATURE_ORDER.length,
      datasetSize: PHISHING_DATASET.length,
      trainSize: trainSamples.length,
      testSize: testSamples.length,
      accuracy,
      precision,
      recall,
      f1Score,
      falsePositiveRate,
      falseNegativeRate,
      confusionMatrix: {
        truePositives: tp,
        trueNegatives: tn,
        falsePositives: fp,
        falseNegatives: fn,
      },
      featureImportances,
      unseenTestSamples: unseenEvaluations,
    };
  }

  private vote(vector: number[]): { phishingVotes: number; legitimateVotes: number } {
    let phishingVotes = 0;
    for (const tree of this.trees) {
      phishingVotes += predictSingleTree(tree, vector);
    }
    return {
      phishingVotes,
      legitimateVotes: this.nEstimators - phishingVotes,
    };
  }

  private mapRiskLevel(probability: number): RiskLevel {
    if (probability >= 0.62) return 'High Risk';
    if (probability >= 0.34) return 'Suspicious';
    return 'No Known Threat Detected';
  }

  private getRiskHeadline(riskLevel: RiskLevel): string {
    if (riskLevel === 'High Risk') {
      return 'High Risk – Potentially dangerous website.';
    }
    if (riskLevel === 'Suspicious') {
      return 'Suspicious – Further verification recommended.';
    }
    return 'No Known Threat Detected – No threat identified by the available checks; not guaranteed safe.';
  }

  private buildSignalsAndRecommendations(
    features: UrlFeatures,
    matchedKeywords: string[],
    impersonatedBrands: string[],
    riskLevel: RiskLevel,
    tld: string,
    protocolAssumed: boolean,
  ): { signals: TriggeredSignal[]; recommendations: string[] } {
    const signals: TriggeredSignal[] = [];

    if (features.hasIpAddress) {
      signals.push({
        title: 'Raw IP address used instead of a domain name',
        detail:
          'This link points directly to a numeric IP host rather than a registered domain name, a common tactic to evade domain reputation checks.',
        severity: 'critical',
      });
    }

    if (features.brandImpersonation) {
      signals.push({
        title: `Possible brand impersonation (${impersonatedBrands.join(', ')})`,
        detail:
          'A recognized brand keyword appears in the subdomain, hyphenated host, or URL path while the registrable root domain does not belong to that brand.',
        severity: 'critical',
      });
    }

    if (features.hasAtSymbol) {
      signals.push({
        title: 'At-symbol (@) credential masking detected',
        detail:
          'Everything before the @ symbol in a URL is ignored by browsers as legacy userinfo, disguising the real destination domain.',
        severity: 'critical',
      });
    }

    if (features.doubleSlashInPath) {
      signals.push({
        title: 'Double-slash (//) redirect pattern in path',
        detail:
          'An extra // sequence appears after the domain, commonly used to mask third-party open redirects.',
        severity: 'critical',
      });
    }

    if (features.hasSuspiciousTld) {
      signals.push({
        title: `High-abuse top-level domain (.${tld})`,
        detail:
          'This URL uses a disposable or frequently abused TLD often associated with short-lived phishing campaigns.',
        severity: 'warning',
      });
    }

    if (features.subdomainCount >= 2) {
      signals.push({
        title: `${features.subdomainCount} nested subdomains detected`,
        detail:
          'Deep subdomain chains are often used to make a fraudulent host resemble a legitimate portal at first glance.',
        severity: features.subdomainCount >= 3 ? 'critical' : 'warning',
      });
    }

    if (features.suspiciousKeywordCount >= 1) {
      signals.push({
        title: `Phishing lure keywords found (${matchedKeywords.slice(0, 4).join(', ')})`,
        detail:
          'The URL contains urgency or account-action terms commonly used to trick visitors into entering credentials.',
        severity: features.suspiciousKeywordCount >= 2 ? 'warning' : 'warning',
      });
    }

    if (features.hyphenCount >= 2) {
      signals.push({
        title: `${features.hyphenCount} hyphens inside the hostname`,
        detail:
          'Multiple hyphens in the domain name are frequently used to string together spoofed security or brand terms.',
        severity: features.hyphenCount >= 3 ? 'critical' : 'warning',
      });
    }

    if (!features.isHttps) {
      signals.push({
        title: protocolAssumed
          ? 'No explicit HTTPS protocol specified'
          : 'Unencrypted HTTP connection',
        detail: protocolAssumed
          ? 'The submitted input omitted https://; unencrypted HTTP links transmit passwords and form data in plaintext.'
          : 'The URL uses http:// instead of https://, meaning traffic is unencrypted and vulnerable to interception.',
        severity: 'warning',
      });
    }

    if (features.urlLength > 85) {
      signals.push({
        title: `Unusually long URL (${features.urlLength} characters)`,
        detail:
          'Extended URLs can push the true domain out of view on mobile screens and browser address bars.',
        severity: 'warning',
      });
    }

    if (features.hostnameEntropy >= 3.6) {
      signals.push({
        title: `High hostname character randomness (${features.hostnameEntropy.toFixed(2)} bits)`,
        detail:
          'Elevated entropy suggests an automatically generated or obfuscated domain name.',
        severity: 'warning',
      });
    }

    if (signals.length === 0 || riskLevel === 'No Known Threat Detected') {
      if (features.isHttps) {
        signals.push({
          title: 'Uses encrypted HTTPS transport',
          detail: 'The URL explicitly specifies HTTPS, protecting data in transit from eavesdropping.',
          severity: 'pass',
        });
      }
      if (!features.hasIpAddress && !features.brandImpersonation && !features.hasAtSymbol) {
        signals.push({
          title: 'Clean structural domain pattern',
          detail:
            'No IP literals, @ masking, or mismatched brand keywords were detected in the URL structure.',
          severity: 'pass',
        });
      }
    }

    const recommendations: string[] = [];
    if (riskLevel === 'High Risk') {
      recommendations.push(
        'Do not enter passwords, one-time passcodes (OTPs), PINs, or banking information on this website.',
      );
      recommendations.push(
        'Close the link immediately and navigate to the service manually by typing its official domain or using a saved bookmark.',
      );
      recommendations.push(
        'If you received this link via SMS, WhatsApp, or email, verify the sender through an independent official phone number.',
      );
    } else if (riskLevel === 'Suspicious') {
      recommendations.push(
        'Avoid entering passwords, payment card numbers, or personal identity details until you confirm the domain is authentic.',
      );
      recommendations.push(
        'Inspect the registrable root domain carefully for subtle spelling changes, extra hyphens, or unfamiliar TLDs.',
      );
      recommendations.push(
        'Access your account through the organization’s official app or known homepage rather than following this direct link.',
      );
    } else {
      recommendations.push(
        'No lexical phishing indicators were flagged, but URL-only checks cannot inspect live webpage content or zero-day compromises.',
      );
      recommendations.push(
        'Always confirm the browser address bar matches the exact official domain before submitting passwords or banking credentials.',
      );
      recommendations.push(
        'Enable multi-factor authentication (MFA) on sensitive accounts to reduce risk even if a link is later compromised.',
      );
    }

    return { signals, recommendations };
  }

  public analyzeUrl(rawUrl: string): Omit<ScanRecord, 'id' | 'createdAt'> {
    const {
      anatomy,
      features,
      descriptors,
      matchedKeywords,
      impersonatedBrands,
    } = extractUrlFeatures(rawUrl);

    const vector = vectorizeFeatures(features);
    const { phishingVotes, legitimateVotes } = this.vote(vector);
    const phishingProbability = phishingVotes / this.nEstimators;
    const riskLevel = this.mapRiskLevel(phishingProbability);
    const riskHeadline = this.getRiskHeadline(riskLevel);

    const { signals, recommendations } = this.buildSignalsAndRecommendations(
      features,
      matchedKeywords,
      impersonatedBrands,
      riskLevel,
      anatomy.tld,
      anatomy.protocolAssumed,
    );

    return {
      url: anatomy.rawUrl,
      normalizedUrl: anatomy.normalizedUrl,
      hostname: anatomy.hostname,
      anatomy,
      riskLevel,
      riskHeadline,
      phishingProbability: Number((phishingProbability * 100).toFixed(1)),
      treeVotes: {
        phishing: phishingVotes,
        legitimate: legitimateVotes,
        total: this.nEstimators,
      },
      features,
      featureDescriptors: descriptors,
      signals,
      recommendations,
    };
  }

  public getEvaluationMetrics(): ModelEvaluationMetrics {
    return this.evaluationMetrics;
  }
}

export const phishingClassifier = new RandomForestPhishingClassifier();
