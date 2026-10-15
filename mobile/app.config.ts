// Adds each developer's own Apple signing identity to app.json, so nobody's IDs are committed.
// They come from mobile/.env.local (git-ignored; copy .env.example). Expo Go doesn't need them.
import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...(config as ExpoConfig),
  ios: {
    ...config.ios,
    // unique per Apple account: Apple won't let two accounts sign the same bundle ID
    bundleIdentifier: process.env.SEAM_BUNDLE_ID || 'com.example.seam',
    appleTeamId: process.env.SEAM_APPLE_TEAM_ID || undefined,
  },
})
