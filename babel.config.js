// babel.config.js
module.exports = {
  presets: ['module:metro-react-native-babel-preset'],
  plugins: ['@babel/plugin-proposal-export-namespace-from'],
  env: {
    test: {
      plugins: ['@babel/plugin-transform-runtime']
    }
  }
};