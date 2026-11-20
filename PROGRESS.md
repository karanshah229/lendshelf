# LendShelf build progress

Status: IN_PROGRESS
Last updated (UTC): 2026-11-20T21:35Z
Driver: main Claude session (overnight autonomous build requested by the owner)

The owner asked for an overnight build: spec → scaffold → backend → app (shadcn-style UI) → run against emulators → independent verification → README. They are asleep; make product/system decisions yourself, record them in DECISIONS.md.

## Phases
- [x] 0. Spec written (SPEC.md)
- [x] 1a. Backend: firebase.json, rules, functions, rules tests, function tests, seed script (134 tests pass; commit 650c11a)
- [x] 1b. App foundation: Expo SDK 58 + NativeWind + React Native Reusables, firebase platform split, auth flow, tabs shell (commit 4b498ec)
- [ ] 2. App screens (Discover/Book/Copy/Person, My books/Add/Shelves/Lend, Loans/Me/Export) — 3 agents running in parallel

## Commands
- Emulators: `npm run emulators` (= `npm --prefix functions run serve`), then `npm run seed`
- Web app against emulators: `npm run dev:web` (http://localhost:8081). Demo users: +919000000001…5 (Asha, Ravi, Meera, Kabir, Zoya); on the code screen use "Use code from emulator".
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm --prefix functions test`
- [ ] 3. Run on web against emulators; verify every flow end to end; fix
- [ ] 4. Android debug APK build + run on emulator (stretch)
- [ ] 5. Fresh verifier agents (spec conformance, code review, security rules); fix
- [ ] 6. README (run, Firebase setup, APK/TestFlight), HANDOFF.md for the morning

## Resume notes
If a session resumes after a usage-limit reset: read SPEC.md, DECISIONS.md, this file and `git log`, then continue from the first unchecked phase. Update this file (and the timestamp) after each phase.
