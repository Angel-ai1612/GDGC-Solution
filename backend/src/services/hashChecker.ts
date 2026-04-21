import sharp from 'sharp';
import axios from 'axios';
import { supabase } from '../config/supabase';

export interface HashResult {
    signal: 'content_fingerprint';
    score: number;
    verdict: 'match_authentic' | 'match_manipulated' | 'no_match';
    reason: string;
    matchedLabel?: string;
}

// Simple pHash implementation using pixel averages (demo-safe, no native deps)
async function generatePHash(imageBuffer: Buffer): Promise<string> {
    const { data } = await sharp(imageBuffer)
        .resize(8, 8, { fit: 'fill' })
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const pixels = Array.from(data);
    const avg = pixels.reduce((a, b) => a + b, 0) / pixels.length;
    const bits = pixels.map(p => (p >= avg ? '1' : '0')).join('');

    // Convert binary string to hex
    const hex = bits.match(/.{4}/g)!
        .map(b => parseInt(b, 2).toString(16))
        .join('');

    return hex;
}

function hammingDistance(hash1: string, hash2: string): number {
    let distance = 0;
    const len = Math.min(hash1.length, hash2.length);
    for (let i = 0; i < len; i++) {
        const n1 = parseInt(hash1[i], 16);
        const n2 = parseInt(hash2[i], 16);
        const xor = n1 ^ n2;
        distance += xor.toString(2).split('1').length - 1;
    }
    return distance;
}

export async function checkContentHash(
    imageBufferOrUrl: Buffer | string
): Promise<HashResult> {
    try {
        let buffer: Buffer;

        if (typeof imageBufferOrUrl === 'string') {
            const response = await axios.get(imageBufferOrUrl, {
                responseType: 'arraybuffer',
                timeout: 5000,
            });
            buffer = Buffer.from(response.data);
        } else {
            buffer = imageBufferOrUrl;
        }

        const inputHash = await generatePHash(buffer);

        const { data: hashes, error } = await supabase
            .from('reference_hashes')
            .select('label, phash, is_manipulated');

        if (error) throw error;

        let bestMatch: { label: string; distance: number; isManipulated: boolean } | null = null;

        for (const ref of hashes ?? []) {
            const distance = hammingDistance(inputHash, ref.phash);
            if (!bestMatch || distance < bestMatch.distance) {
                bestMatch = { label: ref.label, distance, isManipulated: ref.is_manipulated };
            }
        }

        const MATCH_THRESHOLD = 10; // hamming distance ≤ 10 = match

        if (bestMatch && bestMatch.distance <= MATCH_THRESHOLD) {
            if (bestMatch.isManipulated) {
                return {
                    signal: 'content_fingerprint',
                    score: -30,
                    verdict: 'match_manipulated',
                    reason: `Hash matches a known manipulated clip: "${bestMatch.label}"`,
                    matchedLabel: bestMatch.label,
                };
            }
            return {
                signal: 'content_fingerprint',
                score: 30,
                verdict: 'match_authentic',
                reason: `Hash matches known authentic clip: "${bestMatch.label}"`,
                matchedLabel: bestMatch.label,
            };
        }

        return {
            signal: 'content_fingerprint',
            score: 0,
            verdict: 'no_match',
            reason: 'No matching original found in reference database',
        };
    } catch (err: any) {
        return {
            signal: 'content_fingerprint',
            score: 0,
            verdict: 'no_match',
            reason: `Hash check failed: ${err.message}`,
        };
    }
}