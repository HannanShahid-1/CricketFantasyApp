import { requireOptionalNativeModule } from 'expo'

// The matchup Live Activity (ios/SeamLiveActivityModule.swift). Missing in Expo Go and on Android: then it's null.

interface SeamLiveActivity {
  /** Live Activities are allowed for Seam (Settings → Seam → Live Activities) */
  isEnabled(): boolean
  /** JSON for MatchupAttributes and its ContentState (ios/MatchupAttributes.swift) */
  sync(attributes: string, state: string): Promise<void>
  end(): Promise<void>
}

export const LiveActivity = requireOptionalNativeModule<SeamLiveActivity>('SeamLiveActivity')
