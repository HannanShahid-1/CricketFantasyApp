import { Stack } from 'expo-router'
import { View } from 'react-native'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { useLeagues } from '@/data/leagues'
import { profilePhotoUri, useProfile } from '@/data/profile'
import { nav } from '@/nav'
import { Button, Row, Screen, Section, Txt } from '@/ui'

export function ProfileScreen() {
  const profile = useProfile((s) => s.profile)
  const leagues = useLeagues((s) => s.leagues)
  return (
    <>
      <Stack.Screen options={{ title: 'Your profile', unstable_headerRightItems: () => [{ type: 'button', label: 'Done', variant: 'done', onPress: nav.close }] }} />
      <Screen gap={26}>
        <View style={{ alignItems: 'center', gap: 12, paddingVertical: 18 }}>
          <ProfileAvatar name={profile.displayName} uri={profilePhotoUri(profile.photo)} size={96} />
          <View style={{ alignItems: 'center', gap: 5 }}>
            <Txt display weight={700} size={27}>{profile.displayName || 'Your profile'}</Txt>
            <Txt size={15} tone="muted">{profile.username ? `@${profile.username}` : 'Add your name and username'}</Txt>
          </View>
          <Button title="Edit profile" icon="pencil" kind="tinted" onPress={nav.editProfile} />
        </View>
        <Section title="Your leagues">
          {leagues.length ? leagues.map((league) => (
            <Row key={league.createdAt} title={league.name} />
          )) : <Row title="No leagues yet" />}
        </Section>
        <Txt size={12} tone="dim" style={{ textAlign: 'center' }}>Your profile is saved on this phone.</Txt>
      </Screen>
    </>
  )
}
