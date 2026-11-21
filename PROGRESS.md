# LendShelf build progress

Status: IN_PROGRESS
Last updated (UTC): 2026-11-20T23:42Z
Driver: main Claude session (overnight autonomous build requested by the owner)

The owner asked for an overnight build: spec → scaffold → backend → app (shadcn-style UI) → run against emulators → independent verification → README. They are asleep; make product/system decisions yourself, record them in DECISIONS.md.

## Phases
- [x] 0. Spec written (SPEC.md)
- [x] 1a. Backend: firebase.json, rules, functions, rules tests, function tests, seed script (134 tests pass; commit 650c11a)
- [x] 1b. App foundation: Expo SDK 58 + NativeWind + React Native Reusables, firebase platform split, auth flow, tabs shell (commit 4b498ec)
- [x] 2. App screens (commit 4f9ec03; 183 Jest tests)
- [ ] 3. Web end-to-end verification + fixes — coordinator smoke test passed (sign-in, Discover, copy page, ask to borrow, accept, add via search, review); full QA agent running
- [ ] 4. Android build + run on emulator; demo APK in dist-apk/ — agent running
- [ ] 5. Independent code + security review; apply fixes — review done; backend fixes committed (7ca6aee, 169 backend tests). Client follow-ups pending (do after QA agent finishes):
  - src/features/add/save.ts: chunk item batches at 19 (rules limit for copies of existing custom works)
  - src/lib/push.ts: use api.registerPushToken / api.unregisterPushToken (new callables) instead of arrayUnion/arrayRemove; add to src/lib/api.ts
  - fromSnap/items+works: coerce authors to string[]
  - Discover + My books: show listener errors instead of empty state
  - Copy page: borrower fallback to loan's title/cover when the copy isn't readable
  - Sign-out: clear Firestore persistence
  - Cover upload: normalise image/jpg → image/jpeg
  - app.config.ts: usesCleartextTraffic only when EXPO_PUBLIC_USE_EMULATORS=1 (after Android agent finishes)
- [ ] 6. README (run, Firebase setup, APK/TestFlight), HANDOFF.md for the morning

## Commands
- Emulators: `npm run emulators` (= `npm --prefix functions run serve`), then `npm run seed`
- Web app against emulators: `npm run dev:web` (http://localhost:8081). Demo users: +919000000001…5 (Asha, Ravi, Meera, Kabir, Zoya); on the code screen use "Use code from emulator".
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm --prefix functions test`

## Resume notes
If a session resumes after a usage-limit reset: read SPEC.md, DECISIONS.md, this file and `git log`, then continue from the first unchecked phase. Update this file (and the timestamp) after each phase.
