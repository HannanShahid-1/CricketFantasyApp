// The matchup Live Activity: Lock Screen and Dynamic Island (MatchupActivity.swift). The app starts and updates it
// through modules/seam-live-activity. Linked into the Xcode project by @bacons/apple-targets at `expo prebuild`.
/** @type {import('@bacons/apple-targets/app.plugin').ConfigFunction} */
module.exports = () => ({
  type: 'widget',
  name: 'MatchupActivity',
  displayName: 'Seam',
  bundleIdentifier: '.matchup',
  deploymentTarget: '17.0',
  frameworks: ['SwiftUI', 'WidgetKit', 'ActivityKit'],
})
