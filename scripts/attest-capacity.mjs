#!/usr/bin/env node
/**
 * Proof-of-capacity attestation helper (MVP mock).
 *
 * Usage:
 *   node scripts/attest-capacity.mjs sign --provider G... --model H100 --qty 8 --hours 720
 *   node scripts/attest-capacity.mjs verify --file attestation.json
 *
 * Mainnet: replace HMAC mock with remote attestation / signed benchmark result.
 */

import { createHmac, createHash, randomBytes } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const SECRET = process.env.APEX_ATTEST_SECRET || 'apex-testnet-mock-secret';

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) {
      out[a.slice(2)] = argv[++i];
    } else {
      out._.push(a);
    }
  }
  return out;
}

function sign(payload) {
  const body = JSON.stringify(payload);
  const hash = createHash('sha256').update(body).digest('hex');
  const sig = createHmac('sha256', SECRET).update(hash).digest('hex');
  return { ...payload, content_hash: hash, signature: sig, schema: 'apex.capacity_attest.v1' };
}

function verify(doc) {
  const { content_hash, signature, schema, ...rest } = doc;
  if (schema !== 'apex.capacity_attest.v1') return { ok: false, reason: 'bad schema' };
  const body = JSON.stringify(rest);
  const hash = createHash('sha256').update(body).digest('hex');
  if (hash !== content_hash) return { ok: false, reason: 'hash mismatch' };
  const expect = createHmac('sha256', SECRET).update(hash).digest('hex');
  if (expect !== signature) return { ok: false, reason: 'bad signature' };
  return { ok: true };
}

const args = parseArgs(process.argv.slice(2));
const cmd = args._[0];

if (cmd === 'sign') {
  const coeff = {
    H100: 1.0,
    H200: 1.4,
    B200: 2.5,
    GB200: 3.5,
    A100: 0.6,
    RTX4090: 0.35,
  };
  const model = args.model || 'H100';
  const qty = Number(args.qty || 1);
  const hours = Number(args.hours || 1);
  const c = coeff[model];
  if (c == null) {
    console.error('Unknown model', model);
    process.exit(1);
  }
  const cu = qty * hours * c;
  const payload = {
    provider: args.provider || 'GPLACEHOLDER',
    gpu_model: model,
    quantity: qty,
    hours,
    coefficient: c,
    capacity_cu: cu,
    nonce: randomBytes(8).toString('hex'),
    issued_at: new Date().toISOString(),
  };
  const doc = sign(payload);
  const file = args.out || 'attestation.json';
  writeFileSync(file, JSON.stringify(doc, null, 2));
  console.log('Wrote', file);
  console.log('capacity_cu=', cu, 'content_hash=', doc.content_hash);
} else if (cmd === 'verify') {
  const file = args.file || 'attestation.json';
  const doc = JSON.parse(readFileSync(file, 'utf8'));
  const res = verify(doc);
  console.log(res);
  process.exit(res.ok ? 0 : 1);
} else {
  console.log(`Usage:
  node scripts/attest-capacity.mjs sign --provider G... --model H100 --qty 8 --hours 720 [--out attestation.json]
  node scripts/attest-capacity.mjs verify --file attestation.json`);
  process.exit(1);
}
