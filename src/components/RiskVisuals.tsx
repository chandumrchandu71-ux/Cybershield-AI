import { AlertTriangle, CheckCircle2, ShieldAlert, ShieldCheck } from 'lucide-react';
import type { RiskLevel } from '../types/scan.ts';

export function getRiskAppearance(riskLevel: RiskLevel) {
  if (riskLevel === 'High Risk') {
    return {
      textClass: 'text-red-700',
      surfaceClass: 'bg-red-50/70 border-red-200',
      barClass: 'bg-red-600',
      shortLabel: 'High Risk',
      Icon: ShieldAlert,
    };
  }
  if (riskLevel === 'Suspicious') {
    return {
      textClass: 'text-amber-700',
      surfaceClass: 'bg-amber-50/70 border-amber-200',
      barClass: 'bg-amber-600',
      shortLabel: 'Suspicious',
      Icon: AlertTriangle,
    };
  }
  return {
    textClass: 'text-emerald-700',
    surfaceClass: 'bg-emerald-50/70 border-emerald-200',
    barClass: 'bg-emerald-600',
    shortLabel: 'No Known Threat Detected',
    Icon: ShieldCheck,
  };
}

export function RiskStatusLabel({ riskLevel }: { riskLevel: RiskLevel }) {
  const { textClass, Icon, shortLabel } = getRiskAppearance(riskLevel);
  return (
    <span className={`inline-flex items-center gap-1.5 font-medium ${textClass}`}>
      <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{shortLabel}</span>
    </span>
  );
}

export function SignalSeverityIcon({ severity }: { severity: 'critical' | 'warning' | 'pass' }) {
  if (severity === 'critical') {
    return <ShieldAlert className="h-4 w-4 shrink-0 text-red-600" aria-hidden="true" />;
  }
  if (severity === 'warning') {
    return <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />;
  }
  return <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />;
}
