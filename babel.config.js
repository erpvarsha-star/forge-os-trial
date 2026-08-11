module.exports = function (api) {
  api.cache(true)
  return {
    presets: ['babel-preset-expo', 'nativewind/babel'],
    // Required for react-native-reanimated (used by app/_layout.tsx's launch
    // reveal animation) — must stay last in the plugins array per Reanimated's
    // own setup docs. Pinned dependency, no version change involved here.
    plugins: ['react-native-reanimated/plugin'],
  }
}
