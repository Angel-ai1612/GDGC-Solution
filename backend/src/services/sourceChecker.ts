import { supabase } from '../config/supabase';

export interface SourceResult {
  signal: 'source_credibility';
  score: number;
  verdict: 'verified' | 'unknown';
  reason: string;
  sourceName?: string;
}

export async function checkSourceCredibility(inputUrl: string): Promise<SourceResult> {
  try {
    const hostname = new URL(inputUrl).hostname.replace('www.', '');

    const { data, error } = await supabase
      .from('trusted_sources')
      .select('name, domain')
      .eq('is_active', true)
      .eq('domain', hostname)
      .maybeSingle();

    if (error) throw error;

    if (data) {
      return {
        signal: 'source_credibility',
        score: 40,
        verdict: 'verified',
        reason: `Verified source: ${data.name}`,
        sourceName: data.name,
      };
    }

    return {
      signal: 'source_credibility',
      score: 0,
      verdict: 'unknown',
      reason: 'Source domain not found in trusted sources list',
    };
  } catch (err: any) {
    return {
      signal: 'source_credibility',
      score: 0,
      verdict: 'unknown',
      reason: `Could not resolve source: ${err.message}`,
    };
  }
}