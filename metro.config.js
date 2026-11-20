// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// The Cloud Functions package (./functions) has its own node_modules; keep Metro out of it.
// Anchored to this folder so packages such as node_modules/@firebase/functions are unaffected.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const functionsDir = path
  .resolve(__dirname, 'functions')
  .split(/[/\\]/)
  .map(escapeRegExp)
  .join('[/\\\\]');
config.resolver.blockList = [new RegExp(`^${functionsDir}[/\\\\]`)];

module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
