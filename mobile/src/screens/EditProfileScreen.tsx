import { Stack } from 'expo-router'
import * as ImagePicker from 'expo-image-picker'
import { useState } from 'react'
import { Pressable, ScrollView, TextInput, View } from 'react-native'
import { ProfileAvatar } from '@/components/ProfileAvatar'
import { normalizeUsername, profilePhotoUri, profileProblem, saveProfile, useProfile, type PickedPhoto } from '@/data/profile'
import { nav } from '@/nav'
import { alpha, useTheme } from '@/theme/theme'
import { Button, Icon, report, Section, Txt } from '@/ui'

export function EditProfileScreen() {
  const t = useTheme()
  const profile = useProfile((s) => s.profile)
  const saving = useProfile((s) => s.saving)
  const [name, setName] = useState(profile.displayName)
  const [username, setUsername] = useState(profile.username)
  const [photo, setPhoto] = useState<PickedPhoto | null | undefined>(undefined)
  const [picking, setPicking] = useState(false)
  const [usernameTouched, setUsernameTouched] = useState(false)
  const photoUri = photo === undefined ? profilePhotoUri(profile.photo) : photo?.uri ?? null
  const changed = name.trim() !== profile.displayName || normalizeUsername(username) !== profile.username || photo !== undefined
  const problem = profileProblem(name, username)
  const canSave = changed && !problem && !saving && !picking
  const save = async () => {
    if (!canSave) return
    const error = await saveProfile(name, username, photo)
    if (report(error, 'Profile saved')) nav.close()
  }
  const choosePhoto = async () => {
    if (picking || saving) return
    setPicking(true)
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.75 })
      if (!result.canceled && result.assets[0]) {
        const asset = result.assets[0]
        const extension = asset.mimeType === 'image/png' ? 'png' : asset.mimeType === 'image/heic' ? 'heic' : asset.mimeType === 'image/webp' ? 'webp' : 'jpg'
        setPhoto({ uri: asset.uri, extension })
      }
    } catch { report('Could not open your photos. Please try again.') }
    finally { setPicking(false) }
  }
  const fieldStyle = { flex: 1, fontFamily: t.font.body(500), fontSize: 16, color: t.c.text, paddingVertical: 15 }
  return (
    <>
      <Stack.Screen options={{ title: 'Edit profile', gestureEnabled: !saving,
        unstable_headerLeftItems: () => [{ type: 'button', label: 'Cancel', disabled: saving, onPress: nav.close }],
        unstable_headerRightItems: () => [{ type: 'button', label: saving ? 'Saving…' : 'Save', variant: 'done', disabled: !canSave, onPress: save }],
      }} />
      <ScrollView style={{ flex: 1, backgroundColor: t.c.bg }} contentInsetAdjustmentBehavior="automatic" automaticallyAdjustKeyboardInsets keyboardDismissMode="interactive" keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, paddingBottom: 40, gap: 24 }}>
        <View style={{ alignItems: 'center', gap: 10, paddingVertical: 10 }}>
          <Pressable disabled={picking || saving} onPress={() => void choosePhoto()} accessibilityRole="button" accessibilityLabel="Change profile photo" style={{ position: 'relative' }}>
            <ProfileAvatar name={name} uri={photoUri} size={96} />
            <View style={{ position: 'absolute', bottom: 0, right: 0, width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: t.c.accent, borderWidth: 3, borderColor: t.c.bg }}>
              <Icon name="camera.fill" size={13} color={t.c.accentInk} />
            </View>
          </Pressable>
          <Button title={picking ? 'Opening photos…' : 'Choose photo'} kind="plain" disabled={picking || saving} onPress={() => void choosePhoto()} />
          {photoUri && <Button title="Remove photo" kind="plain" size="small" disabled={saving || picking} onPress={() => setPhoto(null)} />}
        </View>
        <Section title="Display name">
          <View style={{ paddingHorizontal: 16 }}>
            <TextInput accessibilityLabel="Display name" value={name} onChangeText={setName} placeholder="Your name" maxLength={32} editable={!saving} autoCorrect={false} autoCapitalize="words" textContentType="nickname" returnKeyType="done" selectionColor={t.c.accent} placeholderTextColor={t.c.dim} keyboardAppearance={t.dark ? 'dark' : 'light'} style={fieldStyle} />
          </View>
        </Section>
        <Section title="Username" footer={usernameTouched && !/^[a-z0-9_]{3,24}$/.test(normalizeUsername(username)) ? 'Use 3–24 letters, numbers or underscores.' : 'Your username will be confirmed when online accounts are available.'}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16 }}>
            <Txt tone="muted" size={17}>@</Txt>
            <TextInput accessibilityLabel="Username" value={username} onChangeText={(value) => { setUsername(value); setUsernameTouched(true) }} placeholder="username" maxLength={25} editable={!saving} autoCorrect={false} autoCapitalize="none" spellCheck={false} textContentType="username" returnKeyType="done" onSubmitEditing={() => void save()} selectionColor={t.c.accent} placeholderTextColor={t.c.dim} keyboardAppearance={t.dark ? 'dark' : 'light'} style={fieldStyle} />
          </View>
        </Section>
        <View style={{ padding: 14, borderRadius: 14, backgroundColor: alpha(t.c.accent, 0.07), flexDirection: 'row', gap: 9, alignItems: 'center' }}>
          <Icon name="person.crop.circle" size={18} color={t.c.accent} />
          <Txt size={13} tone="muted" style={{ flex: 1, lineHeight: 18 }}>Your photo and name make it easier for league mates to recognise you.</Txt>
        </View>
      </ScrollView>
    </>
  )
}
