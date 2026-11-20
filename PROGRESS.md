# LendShelf build progress

Status: IN_PROGRESS
Last updated (UTC): 2026-11-21T20:20Z
Driver: main Claude session (overnight autonomous build requested by the owner)

The owner asked for an overnight build: spec → scaffold → backend → app (shadcn-style UI) → run against emulators → independent verification → README. They are asleep; make product/system decisions yourself, record them in DECISIONS.md.

## Phases
- [x] 0. Spec written (SPEC.md)
- [ ] 1a. Backend: firebase.json, rules, functions, rules tests, function tests, seed script
- [ ] 1b. App foundation: Expo + NativeWind + React Native Reusables, firebase platform split, auth flow, tabs shell
- [ ] 2. App screens (Discover/Book/Copy/Person, My books/Add/Shelves/Lend, Loans/Me/Export)
- [ ] 3. Run on web against emulators; verify every flow end to end; fix
- [ ] 4. Android debug APK build + run on emulator (stretch)
- [ ] 5. Fresh verifier agents (spec conformance, code review, security rules); fix
- [ ] 6. README (run, Firebase setup, APK/TestFlight), HANDOFF.md for the morning

## Resume notes
If a session resumes after a usage-limit reset: read SPEC.md, DECISIONS.md, this file and `git log`, then continue from the first unchecked phase. Update this file (and the timestamp) after each phase.
