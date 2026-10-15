// Shares the web app's code (../app/src: engine, store, bots, helpers) and data (../app/public) with the iPhone app.
// Shared files must use this app's copies of react/zustand/etc., never ../app/node_modules (two Reacts crash).
const { getDefaultConfig } = require('expo/metro-config')
const path = require('path')

const config = getDefaultConfig(__dirname)
const shared = path.resolve(__dirname, '../app')

config.watchFolders = [path.join(shared, 'src'), path.join(shared, 'public')]
// player photo thumbnails (src/generated/thumbs) are HEIC: small, and they keep the cut-out's transparency
config.resolver.assetExts.push('heic')

const resolve = config.resolver.resolveRequest
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const fromShared = context.originModulePath.startsWith(shared + path.sep)
  const bare = !moduleName.startsWith('.') && !path.isAbsolute(moduleName)
  const ctx = fromShared && bare ? { ...context, originModulePath: path.join(__dirname, 'index.ts') } : context
  return (resolve ?? context.resolveRequest)(ctx, moduleName, platform)
}

module.exports = config
