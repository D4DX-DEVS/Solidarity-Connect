// node --import ./worker/dev/register.mjs … → "mongoose" resolves to the D1 shim.
import { register } from 'node:module';

register('./alias-hooks.mjs', import.meta.url);
