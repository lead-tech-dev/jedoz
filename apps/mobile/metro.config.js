const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Ensure Metro can always resolve the empty module path in PNPM workspaces.
config.resolver.emptyModulePath = require.resolve(
  'metro-runtime/src/modules/empty-module.js',
  { paths: [__dirname] }
);

module.exports = config;
