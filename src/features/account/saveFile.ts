/**
 * Getting a file off the device.
 *
 * Two completely different mechanisms behind one function:
 *
 *   native  write it into the app's own cache directory and open the share
 *           sheet, so it can go to Files, iCloud, a mail or WhatsApp.
 *   web     make a Blob, hand it to an <a download> and click it.
 *
 * The alternative -- showing the JSON on screen to copy -- is not an export:
 * a year of food logging does not fit in a text field.
 */
import { Platform } from 'react-native';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

export type SaveResult =
  | { ok: true; where: 'shared' | 'downloaded' }
  | { ok: false; reason: string };

export async function saveTextFile(
  filename: string,
  contents: string,
  mimeType = 'application/json',
): Promise<SaveResult> {
  if (Platform.OS === 'web') {
    return saveOnWeb(filename, contents, mimeType);
  }

  try {
    // The cache directory, not documents: the file is a one-off you are about
    // to send somewhere, and the OS may clear it afterwards.
    const file = new File(Paths.cache, filename);
    file.create({ overwrite: true });
    file.write(contents);

    if (!(await Sharing.isAvailableAsync())) {
      return { ok: false, reason: 'Delen werkt niet op dit toestel.' };
    }

    await Sharing.shareAsync(file.uri, {
      mimeType,
      dialogTitle: 'Je gegevens opslaan of delen',
      UTI: 'public.json',
    });

    return { ok: true, where: 'shared' };
  } catch {
    return { ok: false, reason: 'Het bestand kon niet worden opgeslagen.' };
  }
}

function saveOnWeb(filename: string, contents: string, mimeType: string): SaveResult {
  try {
    const blob = new Blob([contents], { type: mimeType });
    const url = URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Freeing the object URL straight away would cancel the download in some
    // browsers, so it is released a moment later instead.
    setTimeout(() => URL.revokeObjectURL(url), 10_000);

    return { ok: true, where: 'downloaded' };
  } catch {
    return { ok: false, reason: 'Het bestand kon niet worden gedownload.' };
  }
}
