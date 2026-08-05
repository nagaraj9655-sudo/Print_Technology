// Pick an image from the library and return it as a data: URL (so it stores like
// the web app's uploaded logo/signature/footer images and embeds in the PDF).
import * as ImagePicker from 'expo-image-picker'

export async function pickImageDataUrl(): Promise<string | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync()
  if (!perm.granted) return null
  // `mediaTypes: 'images'` is the SDK 57 form; typed as any to stay tolerant.
  const opts: any = { base64: true, quality: 0.6, mediaTypes: 'images', allowsEditing: false }
  const res = await ImagePicker.launchImageLibraryAsync(opts)
  if (res.canceled) return null
  const asset = res.assets?.[0]
  if (!asset?.base64) return null
  const mime = asset.mimeType || 'image/jpeg'
  return `data:${mime};base64,${asset.base64}`
}
