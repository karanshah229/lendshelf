#!/usr/bin/env node
// Runs the locally installed firebase-tools (used by the deploy scripts and by
// the backend test scripts) with a Java runtime that the test emulators accept
// (firebase-tools 15 needs Java 21+). Deploys don't need Java.
//
// If JAVA_HOME (or `java` on PATH) is older than 21, this looks for a newer
// JDK in a few well-known places (Android Studio's bundled JBR, common JDK
// install folders) and uses it for this process only. Nothing global changes.
import { spawn, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";

const MIN_JAVA = 21;
const isWin = process.platform === "win32";
const javaExe = isWin ? "java.exe" : "java";

function javaMajor(javaBin) {
  try {
    const r = spawnSync(javaBin, ["-version"], { encoding: "utf8" });
    const out = `${r.stderr ?? ""}${r.stdout ?? ""}`;
    const m = out.match(/version "(\d+)(?:\.(\d+))?/);
    if (!m) return 0;
    const major = Number(m[1]);
    return major === 1 ? Number(m[2] ?? 0) : major;
  } catch {
    return 0;
  }
}

function candidateHomes() {
  const homes = [];
  if (process.env.LENDSHELF_JAVA_HOME) homes.push(process.env.LENDSHELF_JAVA_HOME);
  if (process.env.JAVA_HOME) homes.push(process.env.JAVA_HOME);
  const roots = isWin
    ? [
        "C:\\Program Files\\Android\\Android Studio\\jbr",
        "C:\\Program Files\\Eclipse Adoptium",
        "C:\\Program Files\\Java",
        "C:\\Program Files\\Zulu",
        "C:\\Program Files\\Microsoft",
        "C:\\Program Files\\Amazon Corretto",
      ]
    : [
        "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
        "/Library/Java/JavaVirtualMachines",
        "/usr/lib/jvm",
        "/opt/android-studio/jbr",
      ];
  for (const root of roots) {
    if (!existsSync(root)) continue;
    homes.push(root);
    try {
      for (const d of readdirSync(root)) {
        homes.push(path.join(root, d));
        homes.push(path.join(root, d, "Contents", "Home"));
      }
    } catch {
      /* ignore unreadable folders */
    }
  }
  return homes;
}

const env = { ...process.env };
if (javaMajor("java") < MIN_JAVA && !(env.JAVA_HOME && javaMajor(path.join(env.JAVA_HOME, "bin", javaExe)) >= MIN_JAVA)) {
  const home = candidateHomes().find((h) => {
    const bin = path.join(h, "bin", javaExe);
    return existsSync(bin) && javaMajor(bin) >= MIN_JAVA;
  });
  if (home) {
    env.JAVA_HOME = home;
    env.PATH = `${path.join(home, "bin")}${path.delimiter}${env.PATH ?? ""}`;
    console.error(`[firebase.mjs] Using Java from ${home}`);
  } else {
    console.error(
      `[firebase.mjs] Warning: no Java ${MIN_JAVA}+ found. The test emulators need it. ` +
        "Install a JDK 21+ or set LENDSHELF_JAVA_HOME.",
    );
  }
} else if (env.JAVA_HOME && javaMajor(path.join(env.JAVA_HOME, "bin", javaExe)) >= MIN_JAVA) {
  env.PATH = `${path.join(env.JAVA_HOME, "bin")}${path.delimiter}${env.PATH ?? ""}`;
}

// Windows: the JDK creates AF_UNIX sockets for NIO pipes in the temp folder.
// Under some temp paths (8.3 short names, sandboxed temp dirs) that fails
// with "Unable to establish loopback connection" and the Firestore emulator
// dies on start. Point it at a folder inside this package instead.
if (isWin) {
  const sockDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", ".tmp");
  mkdirSync(sockDir, { recursive: true });
  const opt = `-Djdk.net.unixdomain.tmpdir=${sockDir}`;
  if (!(env.JAVA_TOOL_OPTIONS ?? "").includes("jdk.net.unixdomain.tmpdir")) {
    env.JAVA_TOOL_OPTIONS = `${env.JAVA_TOOL_OPTIONS ?? ""} ${opt}`.trim();
  }
}

// The Functions emulator (tests) and `firebase deploy` give the code 10 s to
// load before giving up ("Cannot determine backend specification"). On a busy
// machine loading firebase-admin can take longer. Seconds.
env.FUNCTIONS_DISCOVERY_TIMEOUT ??= "60";

const require = createRequire(import.meta.url);
const cli = require.resolve("firebase-tools/lib/bin/firebase.js");
const child = spawn(process.execPath, [cli, ...process.argv.slice(2)], { stdio: "inherit", env });
child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal);
  process.exit(code ?? 1);
});
