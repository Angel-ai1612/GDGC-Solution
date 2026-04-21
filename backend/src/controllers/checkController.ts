import { Request, Response } from 'express';
import { checkSourceCredibility } from '../services/sourceChecker';
import { checkContentHash } from '../services/hashChecker';
import { inspectMetadata } from '../services/metadataInspector';
import { computeTrustScore } from '../services/scoringEngine';

export async function handleCheck(req: Request, res: Response) {
  const { url } = req.body;

  if (!url || typeof url !== 'string') {
    return res.status(400).json({
      error: 'invalid_input',
      message: 'A valid "url" string is required in the request body.',
    });
  }

  try {
    new URL(url); // validate URL format
  } catch {
    return res.status(400).json({
      error: 'invalid_url',
      message: 'The provided URL is not valid.',
    });
  }

  try {
    // Run all 3 signals in parallel
    const [sourceResult, hashResult, metadataResult] = await Promise.all([
      checkSourceCredibility(url),
      checkContentHash(url),
      inspectMetadata(url),
    ]);

    const trustScore = computeTrustScore(sourceResult, hashResult, metadataResult);

    return res.status(200).json({
      success: true,
      data: trustScore,
      checkedUrl: url,
      checkedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('Check failed:', err);
    return res.status(500).json({
      error: 'processing_error',
      message: 'An error occurred while processing the media.',
    });
  }
}
