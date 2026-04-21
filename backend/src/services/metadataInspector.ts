import sharp from 'sharp';
import axios from 'axios';

export interface MetadataResult {
    signal: 'metadata_analysis';
    score: number;
    verdict: 'present' | 'absent' | 'anomaly';
    reason: string;
    flags: string[];
}

export async function inspectMetadata(
    imageBufferOrUrl: Buffer | string
): Promise<MetadataResult> {
    const flags: string[] = [];

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

        const metadata = await sharp(buffer).metadata();

        // Check 1: EXIF presence
        const hasExif = !!metadata.exif;
        if (!hasExif) flags.push('no_exif');

        // Check 2: Expected format consistency
        const format = metadata.format;
        const validFormats = ['jpeg', 'png', 'webp', 'gif'];
        if (!format || !validFormats.includes(format)) {
            flags.push('unexpected_format');
        }

        // Check 3: Suspicious dimensions (very small = possible crop artefact)
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;
        if (width < 100 || height < 100) {
            flags.push('suspicious_dimensions');
        }

        // Check 4: Double compression heuristic (density mismatch)
        if (metadata.density && (metadata.density < 50 || metadata.density > 1200)) {
            flags.push('abnormal_density');
        }

        // Scoring
        if (flags.length === 0 && hasExif) {
            return {
                signal: 'metadata_analysis',
                score: 15,
                verdict: 'present',
                reason: 'Metadata present and consistent',
                flags,
            };
        }

        if (flags.includes('no_exif') && flags.length === 1) {
            return {
                signal: 'metadata_analysis',
                score: -10,
                verdict: 'absent',
                reason: 'Metadata absent or stripped — common in re-uploaded content',
                flags,
            };
        }

        const anomalyScore = flags.length >= 2 ? -20 : -10;
        return {
            signal: 'metadata_analysis',
            score: anomalyScore,
            verdict: 'anomaly',
            reason: `Anomalies detected: ${flags.join(', ')}`,
            flags,
        };
    } catch (err: any) {
        return {
            signal: 'metadata_analysis',
            score: 0,
            verdict: 'absent',
            reason: `Metadata inspection failed: ${err.message}`,
            flags,
        };
    }
}