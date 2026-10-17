import { Image } from 'expo-image'
import { useEffect, useState } from 'react'
import { Pressable, View } from 'react-native'
import { profilePhotoUri, useProfile } from '@/data/profile'
import { nav } from '@/nav'
import { alpha, useTheme } from '@/theme/theme'
import { Icon, Txt } from '@/ui'

export function ProfileAvatar({ name, uri, size = 80 }: { name: string; uri: string | null; size?: number }) {
  const t = useTheme()
  const [failed, setFailed] = useState(false)
  useEffect(() => setFailed(false), [uri])
  const initials = name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((part) => Array.from(part)[0]).join('').toUpperCase()
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: alpha(t.c.accent, 0.14), borderWidth: 1, borderColor: alpha(t.c.accent, 0.2) }}>
      {uri && !failed ? <Image source={{ uri }} contentFit="cover" style={{ width: size, height: size }} onError={() => setFailed(true)} accessible={false} />
        : initials ? <Txt display weight={700} size={size * 0.34} tone="accent" accessible={false}>{initials}</Txt>
        : <Icon name="person.fill" size={size * 0.46} color={t.c.accent} />}
    </View>
  )
}

export function ProfileButton() {
  const profile = useProfile((s) => s.profile)
  return (
    <Pressable onPress={nav.profile} accessibilityRole="button" accessibilityLabel="Your profile" hitSlop={6} style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', opacity: pressed ? 0.7 : 1 })}>
      <ProfileAvatar name={profile.displayName} uri={profilePhotoUri(profile.photo)} size={38} />
    </Pressable>
  )
}
