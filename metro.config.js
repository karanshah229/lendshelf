// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The Cloud Functions package (./functions) has its own node_modules; keep Metro out of it.
// Anchored to this folder so packages such as node_modules/@firebase/functions are unaffected.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const anchored = (dir) =>
  new RegExp(
    `^${path
      .resolve(__dirname, dir)
      .split(/[/\\]/)
      .map(escapeRegExp)
      .join('[/\\\\]')}[/\\\\]`
  );
// Also keep Metro out of generated native projects and build output: Gradle writes
// short-lived socket files there that crash Metro's file watcher on Windows (EACCES).
config.resolver.blockList = ['functions', 'android', 'ios', 'dist', 'dist-apk'].map(anchored);

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
