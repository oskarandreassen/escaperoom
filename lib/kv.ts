// lib/kv.ts
import { kv } from '@vercel/kv';

export const KV = kv;

// keys:
// run:codes (SET) -> final codes for antifraud check
export const RUN_CODES_KEY = 'run:codes';
