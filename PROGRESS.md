# LendShelf build progress

Status: IN PROGRESS (v1.1 on real devices and real Firebase)
Last updated: 2026-11-22 00:40 IST
Driver: main Claude session; workstreams below run as parallel agents.

## Workstreams (2026-11-21)

| # | Workstream | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | UX v1.1 build (B1–B6, C1–C14) + QA fixes | lead | Done | Commit fd901b7. 388 app tests, 182 backend tests pass. |
| 2 | Phone build (physical Android phone, arm64) against emulators | lead | Done | USB `adb reverse`; placeholder API key shape fixed; onboarding name gate fixed. |
| 3 | Native QA walkthrough on the phone (against dev) | QA agent | Done | Most flows pass. 4 major bugs (push prompt, confirm-button taps, Add back button, short-name collisions) + minors; report docs/ux/QA-ANDROID.md. |
| 11 | Fix phone QA bugs | UI agent, logic agent | Done | Confirm-button taps, Add back, dialog keyboard, push permission, name collisions, return history (returnEvents), pickup-window return, WRITE_CONTACTS blocked. 420 app tests. |
| 12 | Cloud Function cold starts | functions agent | Done (dev) | Lazy loading + one function per instance + preferRest: start-up 2.4 s → 1.7 s; server first call 2-3 s. Remaining delay looks client-side (App Check token). No cost added. |
| 4 | Real Firebase: Firestore, Auth, apps, rules/indexes | lead | Done | Both projects. Dev has test numbers +91 90000 00001–05 (code in firebase-config/TEST-NUMBERS.md). |
| 5 | Real Firebase: Cloud Functions, Storage bucket, scheduler | functions agent, lead | Done | Both projects: 19/19 functions, buckets in us-central1 (free tier) with rules. Dev checked end to end on web (sign-in, onUserCreated, completeProfile, syncContacts). IAM: 3 roles added by hand, then retries for propagation; see functions/README.md. |
| 6 | Env switching (`APP_ENV=emulator|dev|prod`) | lead | Done | `npm run firebase:config` downloads git-ignored configs. |
| 7 | Docs for environments (README, HANDOFF) | docs agent | Done | README: Environments section, Going live rewritten, phone dev/prod build. HANDOFF: 2026-11-21 update. Link to functions/README.md#deploying-to-dev--prod to check once workstream 5 lands. |
| 8 | Privacy audit, then push to GitHub | audit agent, lead | Done | Audit clean (all files, history, 119 images). fd901b7 pushed to github.com/karanshah229/lendshelf main. Repo pinned to the noreply git identity. |
| 9 | Dev APK on the phone, real sign-in | lead | Done | Installed 21:54. Test-number sign-in (Play Integrity), account setup and contact matching against the real address book all pass on dev. |
| 10 | Remove emulator mode and demo seed (owner decision 21:45) | app, backend, docs agents | Done | App: no emulator paths, placeholders deleted. Backend: seed and serve gone, cover URLs https-only (rules deployed to dev and prod). Tests keep a private emulator (firebase.test.json). |

## Waiting on the owner
- Nothing right now.

## Earlier phases (v1, done)
- [x] 0. Spec written (SPEC.md)
- [x] 1a. Backend: rules, functions, tests, seed (650c11a)
- [x] 1b. App foundation (4b498ec)
- [x] 2. App screens (4f9ec03)
- [x] 3. Web end-to-end verification (5eb1f5a)
- [x] 4. Android debug + release build on the API 37 emulator (e725291)
- [x] 5. Independent code + security review (650c11a..afc2272)
- [x] 6. README, HANDOFF.md

## Commands
- Emulators: `npm run emulators`, then `npm run seed`
- Web: `npm run dev:web` (emulators) or `npm run dev:web:real` (lendshelf-dev)
- Checks: `npm run typecheck`, `npm run lint`, `npm test`, `npm --prefix functions test`
