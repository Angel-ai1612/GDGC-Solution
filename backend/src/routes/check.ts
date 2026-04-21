import { Router } from 'express';
import { handleCheck } from '../controllers/checkController';

const router = Router();

router.post('/', handleCheck);

export default router;
