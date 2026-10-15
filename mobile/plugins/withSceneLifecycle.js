// iOS 27 stops any app built with its SDK at launch unless it uses the scene-based life cycle. Expo SDK 57 ships the
// pieces (ExpoAppSceneDelegate + ExpoReactNativeFactoryProvider) but its prebuild template still starts React Native
// from the app delegate. This plugin switches the generated project over at every `expo prebuild`:
//  - Info.plist declares one window scene whose delegate is Expo's EXExpoAppSceneDelegate
//  - AppDelegate keeps creating the React Native factory, conforms to ExpoReactNativeFactoryProvider, and no longer
//    makes its own window (the scene delegate creates it and starts React Native into it)
// Remove once Expo's template does this itself.
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins')

const START_IN_APP_DELEGATE = /\n#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\([\s\S]*?\)\n#endif\n/

module.exports = function withSceneLifecycle(config) {
  config = withInfoPlist(config, (c) => {
    c.modResults.UIApplicationSceneManifest = {
      UIApplicationSupportsMultipleScenes: false,
      UISceneConfigurations: {
        UIWindowSceneSessionRoleApplication: [
          { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: 'EXExpoAppSceneDelegate' },
        ],
      },
    }
    return c
  })

  return withAppDelegate(config, (c) => {
    if (c.modResults.language !== 'swift') throw new Error('withSceneLifecycle: expected a Swift AppDelegate')
    let src = c.modResults.contents
    if (src.includes('ExpoReactNativeFactoryProvider')) return c

    const before = src
    src = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {')
    src = src.replace(START_IN_APP_DELEGATE, '\n    // the window and React Native start in the scene delegate (EXExpoAppSceneDelegate, see Info.plist)\n')
    if (src === before || src.includes('UIWindow(frame:')) {
      throw new Error('withSceneLifecycle: AppDelegate.swift no longer matches the expected template; update the plugin')
    }
    c.modResults.contents = src
    return c
  })
}
