const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Workaround for module resolution issues in @iabtcf/core (used by react-native-google-mobile-ads)
// Setting this to false bypasses ESM exports matching bugs inside Metro for privacy libraries
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
