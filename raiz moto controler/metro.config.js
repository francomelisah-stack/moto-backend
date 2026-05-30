// metro.config.js
// mqtt v4 usa WebSocket global de React Native directamente.
// Solo necesitamos permitir archivos .cjs que vienen con la librería.
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
config.resolver.sourceExts.push('cjs');

module.exports = config;
