import assert from 'node:assert/strict';
import { lightboxTint } from '../web/night-style.js';
assert.equal(lightboxTint('#f6f3ee', '#1b1b1b'), '#f6f3ee');
assert.equal(lightboxTint('#111111', '#f4efe6'), '#f4efe6');
assert.equal(lightboxTint('#7a1c22', '#f8e9c8'), '#f8e9c8');
assert.equal(lightboxTint('#c9a253', '#1a1408'), '#c9a253');
console.log('ok: 白底／深底與金色燈箱的柔光色選擇');
