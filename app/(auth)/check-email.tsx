import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage } from '@/features/auth/authErrors';
import { colors, spacing } from '@/theme/theme';

/**
 * Shown after signing up, because e-mail confirmation is switched on in
 * Supabase: the account exists but cannot sign in until the link in the mail
 * has been opened.
 */
export default function CheckEmailScreen() {
  const router = useRouter();
  const { resendConfirmation } = useAuth();
  const { email } = useLocalSearchParams<{ email?: string }>();

  const [isSending, setIsSending] = useState(false);
  const [notice, setNotice] = useState<string>();
  const [error, setError] = useState<string>();

  async function handleResend() {
    if (isSending || !email) return;

    setIsSending(true);
    setNotice(undefined);
    setError(undefined);
    try {
      await resendConfirmation(email);
      setNotice('We hebben de mail opnieuw verstuurd.');
    } catch (caught) {
      setError(authErrorMessage(caught));
    } finally {
      setIsSending(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Check je mail</Text>
        <Text muted>
          We hebben een bevestigingslink gestuurd{email ? ` naar ${email}` : ''}. Open die link,
          kom daarna terug en log in.
        </Text>
      </View>

      <Card style={styles.card}>
        <Text variant="heading">Geen mail ontvangen?</Text>
        <Text muted>
          Kijk eerst in je spam-map. De mail kan een paar minuten onderweg zijn.
        </Text>

        {notice ? (
          <Text variant="caption" style={styles.notice}>
            {notice}
          </Text>
        ) : null}

        {error ? (
          <Text variant="caption" style={styles.error}>
            {error}
          </Text>
        ) : null}

        <Button
          title="Mail opnieuw sturen"
          variant="secondary"
          onPress={handleResend}
          loading={isSending}
          disabled={!email}
        />
      </Card>

      <View style={styles.footer}>
        <Button title="Ik heb bevestigd — inloggen" onPress={() => router.replace('/(auth)')} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.lg },
  card: { gap: spacing.sm },
  notice: { color: colors.success },
  error: { color: colors.danger },
  footer: { marginTop: spacing.lg },
});
