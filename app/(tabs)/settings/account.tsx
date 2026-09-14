import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { Toggle } from '@/components/Toggle';
import { useAuth } from '@/features/auth/AuthProvider';
import { buildExport, deleteAccount } from '@/features/account/dataExport';
import { saveTextFile } from '@/features/account/saveFile';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/**
 * Your data, and getting rid of it.
 *
 * Both halves are GDPR rights rather than features: article 20 says you may
 * take your data with you in a machine-readable format, and article 17 says
 * you may have it erased. Neither is behind a support e-mail, and neither asks
 * you why.
 */
export default function AccountSettingsScreen() {
  const styles = useThemedStyles(makeStyles);
  const { session, signOut } = useAuth();
  const userId = session?.user.id ?? null;

  const [includeMedication, setIncludeMedication] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState<string>();
  const [exportError, setExportError] = useState<string>();

  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmText, setConfirmText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string>();

  async function handleExport() {
    if (!userId || isExporting) return;

    setIsExporting(true);
    setExportMessage(undefined);
    setExportError(undefined);

    try {
      const file = await buildExport(userId, { includeMedication });
      const result = await saveTextFile(file.filename, file.json);

      if (result.ok) {
        setExportMessage(
          `${file.rowCount} regels geëxporteerd naar ${file.filename}.`,
        );
      } else {
        setExportError(result.reason);
      }
    } catch {
      setExportError('Het exporteren is niet gelukt. Probeer het opnieuw.');
    } finally {
      setIsExporting(false);
    }
  }

  async function handleDelete() {
    setIsDeleting(true);
    setDeleteError(undefined);

    try {
      await deleteAccount();
      // The session is gone with the account; signing out clears what is left
      // on the device and the router drops back to the login screen.
      await signOut();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : 'Je account kon niet worden verwijderd. Probeer het later opnieuw.',
      );
      setIsDeleting(false);
    }
  }

  return (
    <Screen>
      <ScreenHeader title="Je account" subtitle="Je gegevens meenemen of verwijderen." />

      <Card style={styles.card}>
        <Text variant="heading">Gegevens exporteren</Text>
        <Text muted>
          Je krijgt één JSON-bestand met alles wat deze app van je bewaart: je profiel, je
          dagboek, je trainingen, je recepten en je lijstjes.
        </Text>

        <Toggle
          label="Medicatie meenemen"
          description="Gezondheidsgegevens. Het bestand is niet versleuteld, dus bewaar het veilig."
          value={includeMedication}
          onChange={setIncludeMedication}
        />

        {exportMessage ? (
          <Text variant="caption" style={styles.success}>
            {exportMessage}
          </Text>
        ) : null}

        {exportError ? (
          <Text variant="caption" style={styles.error}>
            {exportError}
          </Text>
        ) : null}

        <Button title="Exporteren" loading={isExporting} onPress={handleExport} />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Account verwijderen</Text>
        <Text muted>
          Je account en alles wat erbij hoort worden verwijderd: je profiel, je dagboek, je
          trainingen, je gewicht, je recepten en je medicatie. Dit kan niet ongedaan worden
          gemaakt.
        </Text>
        <Text variant="caption" muted>
          Wil je je gegevens bewaren, exporteer ze dan eerst.
        </Text>

        {deleteError ? (
          <Text variant="caption" style={styles.error}>
            {deleteError}
          </Text>
        ) : null}

        <Button
          title="Account verwijderen"
          variant="secondary"
          onPress={() => {
            setConfirmText('');
            setConfirmDelete(true);
          }}
        />
      </Card>

      <View style={styles.footer}>
        <Text variant="caption" muted>
          Vragen over je gegevens? Alles staat in je eigen Supabase-project; er gaat niets naar
          derden en er draait geen analytics op je gezondheidsgegevens.
        </Text>
      </View>

      <ConfirmDialog
        visible={confirmDelete && confirmText.trim().toUpperCase() === 'VERWIJDER'}
        title="Weet je het zeker?"
        message="Je account en al je gegevens worden definitief verwijderd."
        confirmLabel="Definitief verwijderen"
        destructive
        onCancel={() => setConfirmDelete(false)}
        onConfirm={handleDelete}
      />

      {confirmDelete ? (
        <Card style={styles.card}>
          <Text variant="heading">Typ VERWIJDER om te bevestigen</Text>
          <Text variant="caption" muted>
            Dit is met opzet een beetje omslachtig: er is geen weg terug.
          </Text>
          <Input
            label="Bevestiging"
            value={confirmText}
            onChangeText={setConfirmText}
            placeholder="VERWIJDER"
            autoCapitalize="characters"
            autoFocus
          />
          <Button
            title="Annuleren"
            variant="secondary"
            onPress={() => setConfirmDelete(false)}
            disabled={isDeleting}
          />
        </Card>
      ) : null}
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
    card: { gap: spacing.md, marginBottom: spacing.md },
    success: { color: colors.success },
    error: { color: colors.danger },
    footer: { marginTop: spacing.md, marginBottom: spacing.xl },
  });
