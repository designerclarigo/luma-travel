import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
export async function writePortable(name: string, text: string, mime = 'application/json') {
  if (!await Sharing.isAvailableAsync()) throw new Error('File sharing is unavailable on this device. Use Copy text for a trip summary.');
  const file = new File(Paths.cache, name.replace(/[^a-zA-Z0-9._-]/g, '-')); file.write(text); await Sharing.shareAsync(file.uri, { mimeType: mime, dialogTitle: 'Save or share from Waylo', UTI: mime === 'text/calendar' ? 'com.apple.ical.ics' : 'public.json' });
}
export async function readPortableFile() { const result = await DocumentPicker.getDocumentAsync({ type: ['application/json', 'text/plain', 'application/octet-stream'], copyToCacheDirectory: true, multiple: false }); if (result.canceled) return null; const file = new File(result.assets[0].uri); if (file.size > 5_000_000) throw new Error('Choose a Waylo file under 5 MB.'); return file.text(); }
