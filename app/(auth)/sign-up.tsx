import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import {
  authErrorMessage,
  MIN_PASSWORD_LENGTH,
  validateEmail,
  validatePassword,
  validatePasswordRepeat,
} from '@/features/auth/authErrors';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

export default function SignUpScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { signUp } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [repeat, setRepeat] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [repeatError, setRepeatError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    if (isSubmitting) return;

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    const nextRepeatError = validatePasswordRepeat(password, repeat);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setRepeatError(nextRepeatError);
    setFormError(undefined);
    if (nextEmailError || nextPasswordError || nextRepeatError) return;

    setIsSubmitting(true);
    try {
      await signUp(email, password);
      // E-mail confirmation is on in Supabase, so there is no session yet.
      // The account only becomes usable after the link in the mail is clicked.
      router.replace({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
    } catch (error) {
      setFormError(authErrorMessage(error));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">Account aanmaken</Text>
        <Text muted>Je gegevens blijven van jou. We sturen je alleen een bevestigingsmail.</Text>
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
        />

        <Input
          label="Wachtwoord"
          value={password}
          onChangeText={setPassword}
          error={passwordError}
          hint={`Minstens ${MIN_PASSWORD_LENGTH} tekens.`}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!isSubmitting}
        />

        <Input
          label="Wachtwoord herhalen"
          value={repeat}
          onChangeText={setRepeat}
          error={repeatError}
          secure
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {formError ? (
          <Text variant="caption" style={styles.formError}>
            {formError}
          </Text>
        ) : null}

        <Button title="Account aanmaken" onPress={handleSubmit} loading={isSubmitting} />
      </Card>

      <View style={styles.footer}>
        <Text muted>Heb je al een account?</Text>
        <Link href="/(auth)">
          <Text variant="label" style={styles.linkText}>
            Inloggen
          </Text>
        </Link>
      </View>
    </Screen>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  header: { gap: spacing.xs, marginTop: spacing.xl, marginBottom: spacing.lg },
  form: { gap: spacing.md },
  formError: { color: colors.danger },
  linkText: { color: colors.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
