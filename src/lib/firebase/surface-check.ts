/**
 * Compile-time guard: `index.ts` (web) and `index.native.ts` (native) must export the same names.
 * `npm run typecheck` fails if one side adds or drops an export.
 * Not imported at runtime.
 */
/* eslint-disable import/no-duplicates -- the resolver maps both paths to one platform file */
import type * as Native from './index.native';
import type * as Web from './index';

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const sameExports: Exact<keyof typeof Web, keyof typeof Native> = true;

export default sameExports;
