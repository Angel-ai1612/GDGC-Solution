import { SourceResult } from './sourceChecker';
import { HashResult } from './hashChecker';
import { MetadataResult } from './metadataInspector';

export type TrustLabel = 'Likely Authentic' | 'Unverified' | 'Suspicious';

export interface TrustScore {
  score: number;
  label: TrustLabel;
  emoji: string;
  signals: {
    source: SourceResult;
    hash: HashResult;
    metadata: MetadataResult;
  };
  recommendation: string;
}

const NEUTRAL_BASE = 15;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getLabel(score: number): { label: TrustLabel; emoji: string } {
  if (score >= 75) return { label: 'Likely Authentic', emoji: '✅' };
  if (score >= 40) return { label: 'Unverified', emoji: '⚠️' };
  return { label: 'Suspicious', emoji: '❌' };
}

function buildRecommendation(
  label: TrustLabel,
  source: SourceResult,
  hash: HashResult,
  metadata: MetadataResult
): string {
  if (label === 'Likely Authentic') {
    return 'Content appears authentic. Source is verified, hash matches a known original, and metadata is consistent.';
  }

  if (label === 'Suspicious') {
    const reasons: string[] = [];
    if (source.verdict === 'unknown') reasons.push('source is unverified');
    if (hash.verdict === 'match_manipulated') reasons.push('hash matches a known manipulated clip');
    if (metadata.verdict === 'anomaly') reasons.push('metadata anomalies detected');
    return `Exercise caution — ${reasons.join('; ')}. Do not share without further verification.`;
  }

  // Unverified
  if (source.verdict === 'verified') {
    return 'Content comes from a trusted source but could not be matched to a known original. Treat with moderate caution.';
  }
  return 'Source is unknown and content could not be verified against the reference database. Verify independently before sharing.';
}

export function computeTrustScore(
  source: SourceResult,
  hash: HashResult,
  metadata: MetadataResult
): TrustScore {
  const raw = NEUTRAL_BASE + source.score + hash.score + metadata.score;
  const score = clamp(raw, 0, 100);
  const { label, emoji } = getLabel(score);
  const recommendation = buildRecommendation(label, source, hash, metadata);

  return {
    score,
    label,
    emoji,
    signals: { source, hash, metadata },
    recommendation,
  };
}
