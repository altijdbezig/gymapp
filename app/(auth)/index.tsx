import { Link, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { authErrorMessage, validateEmail, validatePassword } from '@/features/auth/authErrors';
import { APP_NAME } from '@/config/app';
import { useThemedStyles } from '@/theme/ThemeProvider';
import { spacing, type Palette } from '@/theme/theme';

/** Sign in — the first screen you see when you are not logged in. */
export default function SignInScreen() {
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { signIn } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [emailError, setEmailError] = useState<string>();
  const [passwordError, setPasswordError] = useState<string>();
  const [formError, setFormError] = useState<string>();
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit() {
    // isSubmitting already disables the button; this guard also covers the
    // double tap that lands before React has re-rendered.
    if (isSubmitting) return;

    const nextEmailError = validateEmail(email);
    const nextPasswordError = validatePassword(password);
    setEmailError(nextEmailError);
    setPasswordError(nextPasswordError);
    setFormError(undefined);
    if (nextEmailError || nextPasswordError) return;

    setIsSubmitting(true);
    try {
      await signIn(email, password);
      // No navigation here: the session changes, the root layout notices and
      // opens the right part of the app by itself.
    } catch (error) {
      const message = authErrorMessage(error);
      setFormError(message);

      // An unconfirmed address is the one error with a next step, so we take
      // the user straight to the screen that can resend the mail.
      if (message.includes('nog niet bevestigd')) {
        router.push({ pathname: '/(auth)/check-email', params: { email: email.trim() } });
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <Screen>
      <View style={styles.header}>
        <Text variant="title">{APP_NAME}</Text>
        <Text muted>Log in om verder te gaan met je training en voeding.</Text>
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
          secure
          autoCapitalize="none"
          autoComplete="current-password"
          textContentType="password"
          editable={!isSubmitting}
          onSubmitEditing={handleSubmit}
          returnKeyType="go"
        />

        {formError ? (
          <Text variant="caption" style={styles.formError}>
            {formError}
          </Text>
        ) : null}

        <Button title="Inloggen" onPress={handleSubmit} loading={isSubmitting} />

        <Link href="/(auth)/forgot-password" style={styles.link}>
          <Text variant="label" style={styles.linkText}>
            Wachtwoord vergeten?
          </Text>
        </Link>
      </Card>

      <View style={styles.footer}>
        <Text muted>Nog geen account?</Text>
        <Link href="/(auth)/sign-up">
          <Text variant="label" style={styles.linkText}>
            Account aanmaken
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
  link: { alignSelf: 'center', paddingVertical: spacing.xs },
  linkText: { color: colors.primary },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: spacing.lg,
  },
});
