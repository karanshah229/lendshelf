#!/usr/bin/env node
// Downloads the Firebase app configs for the real projects into firebase-config/<env>/
// (git-ignored). Needs `firebase login` with access to lendshelf-dev / lendshelf-prod.
//
//   npm run firebase:config            # dev and prod
//   npm run firebase:config -- dev     # one environment
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const firebase = path.join(
  root,
  'functions',
  'node_modules',
  '.bin',
  process.platform === 'win32' ? 'firebase.cmd' : 'firebase'
);
const envs = process.argv.slice(2).length ? process.argv.slice(2) : ['dev', 'prod'];
const files = {
  ANDROID: 'google-services.json',
  IOS: 'GoogleService-Info.plist',
  WEB: 'web.json',
};

function run(args) {
  return execFileSync(firebase, args, {
    cwd: root,
    encoding: 'utf8',
    shell: process.platform === 'win32',
  });
}

for (const env of envs) {
  const dir = path.join(root, 'firebase-config', env);
  mkdirSync(dir, { recursive: true });
  for (const [platform, file] of Object.entries(files)) {
    const apps = JSON.parse(run(['apps:list', platform, '--project', env, '--json'])).result ?? [];
    if (apps.length === 0) {
      console.warn(`${env}: no ${platform} app registered, skipping ${file}`);
      continue;
    }
    const { result } = JSON.parse(
      run(['apps:sdkconfig', platform, apps[0].appId, '--project', env, '--json'])
    );
    const contents =
      platform === 'WEB' ? `${JSON.stringify(result.sdkConfig, null, 2)}\n` : result.fileContents;
    writeFileSync(path.join(dir, file), contents);
    console.log(`${env}: wrote firebase-config/${env}/${file}`);
  }
}
