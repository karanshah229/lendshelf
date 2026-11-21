# LendShelf build progress

Status: IN PROGRESS (v1.1 on real devices and real Firebase)
Last updated: 2026-11-21 20:10 IST
Driver: main Claude session; workstreams below run as parallel agents.

## Workstreams (2026-11-21)

| # | Workstream | Owner | Status | Notes |
|---|---|---|---|---|
| 1 | UX v1.1 build (B1–B6, C1–C14) + QA fixes | lead | Done | Commit fd901b7. 388 app tests, 182 backend tests pass. |
| 2 | Phone build (physical Android phone, arm64) against emulators | lead | Done | USB `adb reverse`; placeholder API key shape fixed; onboarding name gate fixed. |
| 3 | Native QA walkthrough on the phone | QA agent | Blocked | Phone dropped off adb at ~19:00. Found: keyboard covered footer buttons (fixed in fd901b7). Resume when the phone is connected. |
| 4 | Real Firebase: Firestore, Auth, apps, rules/indexes | lead | Done | Both projects. Dev has test numbers +91 90000 00001–05 (code in firebase-config/TEST-NUMBERS.md). |
| 5 | Real Firebase: Cloud Functions, Storage bucket, scheduler | functions agent | Ready, blocked on Blaze | `npm run deploy:dev` / `deploy:prod` (+ `:dry-run`). Steps in functions/README.md → Deploying to dev / prod. App Check off via functions/.env.<alias>. No paid API turned on yet. |
| 6 | Env switching (`APP_ENV=emulator|dev|prod`) | lead | Done | `npm run firebase:config` downloads git-ignored configs. |
| 7 | Docs for environments (README, HANDOFF) | docs agent | Done | README: Environments section, Going live rewritten, phone dev/prod build. HANDOFF: 2026-11-21 update. Link to functions/README.md#deploying-to-dev--prod to check once workstream 5 lands. |
| 8 | Privacy audit, then push to GitHub | audit agent, lead | Done | Audit clean (all files, history, 119 images). fd901b7 pushed to github.com/karanshah229/lendshelf main. Repo pinned to the noreply git identity. |
| 9 | Dev APK on the phone, real sign-in | lead | Waiting | Needs 5 (functions) and the phone back on USB. |

## Waiting on the owner
- Upgrade lendshelf-dev and lendshelf-prod to Blaze and set a budget alert.
- Reconnect the phone (USB debugging) for QA and the dev APK.

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
