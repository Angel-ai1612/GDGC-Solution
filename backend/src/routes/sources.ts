import { Router, Request, Response } from 'express';
import { supabase } from '../config/supabase';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  const { data, error } = await supabase
    .from('trusted_sources')
    .select('name, domain, category')
    .eq('is_active', true)
    .order('name');

  if (error) {
    return res.status(500).json({ error: 'db_error', message: error.message });
  }

  return res.status(200).json({ success: true, count: data.length, data });
});

export default router;
