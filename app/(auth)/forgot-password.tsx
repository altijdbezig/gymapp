import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage, validateEmail } from '@/features/auth/authErrors';
import { colors, spacing } from '@/theme/theme';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { sendPasswordReset } = useAuth();

  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;

    const nextEmailError = validateEmail(email);
    setEmailError(nextEmailError);
    setFormError(undefined);
    if (nextEmailError) return;

    setIsSubmitting(true);
    try {
      await sendPasswordReset(email);
      setIsSent(true);
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isSent) {
    return (
      <Screen>
        <View style={styles.header}>
          <Text variant="title">Mail verstuurd</Text>
          <Text muted>
            Als er een account bij {email.trim()} hoort, ligt er nu een link in de mailbox
            waarmee je een nieuw wachtwoord kunt instellen.
          </Text>
        </View>
        <Button title="Terug naar inloggen" onPress={() => router.replace('/(auth)')} />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Wachtwoord vergeten</Text>
        <Text muted>
          Vul je e-mailadres in. We sturen je een link waarmee je een nieuw wachtwoord kunt
          kiezen.
        </Text>
      </View>

      <Card style={styles.form}>
        <Input
          label="E-mailadres"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="jij@voorbeeld.nl"
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
          returnKeyType="send"
        />

        {formError ? (
          <Text variant="caption" style={styles.formError}>
            {formError}
          </Text>
        ) : null}

        <Button title="Stuur de link" onPress={handleSubmit} loading={isSubmitting} />
        <Button title="Terug" variant="secondary" onPress={() => router.back()} />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.lg },
  form: { gap: spacing.md },
  formError: { color: colors.danger },
});
