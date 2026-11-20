/**
 * Compile-time guard: `contacts.ts` (native) and `contacts.web.ts` must export the same names.
 * Not imported at runtime.
 */
/* eslint-disable import/no-duplicates -- the resolver maps both paths to one platform file */
import type * as Native from './contacts';
import type * as Web from './contacts.web';

type Exact<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;

const sameExports: Exact<keyof typeof Web, keyof typeof Native> = true;

export default sameExports;
