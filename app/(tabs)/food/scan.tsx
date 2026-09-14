import { CameraView, useCameraPermissions } from 'expo-camera';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Platform, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Screen } from '@/components/Screen';
import { Text } from '@/components/Text';
import { useBarcodeLookup } from '@/features/nutrition/useFoodLog';
import { useTheme, useThemedStyles } from '@/theme/ThemeProvider';
import { radius, spacing, type Palette } from '@/theme/theme';

/** The formats food packaging actually uses. */
const BARCODE_TYPES = ['ean13', 'ean8', 'upc_a', 'upc_e', 'code128'] as const;

/**
 * Barcode scanning. Native only: expo-camera's scanner does not run in a
 * browser, so the web build sends people to search and manual entry instead.
 */
export default function ScanScreen() {
  const { palette } = useTheme();
  const styles = useThemedStyles(makeStyles);
  const router = useRouter();
  const { date } = useLocalSearchParams<{ date?: string }>();
  const [permission, requestPermission] = useCameraPermissions();
  const [barcode, setBarcode] = useState<string | null>(null);

  // A camera fires onBarcodeScanned many times a second. Without this guard a
  // single scan would kick off dozens of lookups.
  const hasScanned = useRef(false);

  const lookup = useBarcodeLookup(barcode);

  useEffect(() => {
    if (lookup.data?.food) {
      router.replace({
        pathname: '/(tabs)/food/amount',
        // The day you were looking at travels along, so scanning from
        // yesterday's diary logs onto yesterday.
        params: { foodId: lookup.data.food.id, ...(date ? { date } : {}) },
      });
    }
  }, [lookup.data, router, date]);

  function handleScanAgain() {
    hasScanned.current = false;
    setBarcode(null);
  }

  if (Platform.OS === 'web') {
    return (
      <Screen>
        <Text variant="title">Scannen kan niet op web</Text>
        <Text muted style={styles.spaced}>
          De barcodescanner werkt alleen in de app op je telefoon. Zoek het product op of voer het
          zelf in.
        </Text>
        <View style={styles.actions}>
          <Button title="Product zoeken" onPress={() => router.replace('/(tabs)/food/search')} />
          <Button
            title="Zelf invoeren"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/food/manual')}
          />
        </View>
      </Screen>
    );
  }

  if (!permission) {
    return (
      <Screen>
        <ActivityIndicator color={palette.primary} style={styles.loading} />
      </Screen>
    );
  }

  if (!permission.granted) {
    return (
      <Screen>
        <Text variant="title">Camera nodig</Text>
        <Text muted style={styles.spaced}>
          {permission.canAskAgain
            ? 'GymApp gebruikt je camera alleen om barcodes te lezen. Er worden geen foto’s bewaard of verstuurd.'
            : 'Je hebt cameratoegang geweigerd. Zet die aan in de instellingen van je telefoon, of voer het product zelf in.'}
        </Text>
        <View style={styles.actions}>
          {permission.canAskAgain ? (
            <Button title="Camera toestaan" onPress={requestPermission} />
          ) : null}
          <Button
            title="Zelf invoeren"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/food/manual')}
          />
          <Button title="Terug" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  // A barcode was read and we are looking it up.
  if (barcode) {
    return (
      <Screen>
        <Text variant="title">Barcode {barcode}</Text>

        {lookup.isLoading ? (
          <Card style={styles.spaced}>
            <ActivityIndicator color={palette.primary} />
            <Text muted style={styles.centered}>
              Product opzoeken…
            </Text>
          </Card>
        ) : null}

        {lookup.isError ? (
          <Card style={styles.spaced}>
            <Text variant="heading">Opzoeken mislukt</Text>
            <Text muted>Controleer je internetverbinding en probeer het opnieuw.</Text>
          </Card>
        ) : null}

        {lookup.data && !lookup.data.food ? (
          <Card style={styles.spaced}>
            <Text variant="heading">Product onbekend</Text>
            <Text muted>
              {lookup.data.refusal ??
                'Open Food Facts kent deze barcode niet. Voer het product zelf in — dat hoef je maar één keer te doen.'}
            </Text>
          </Card>
        ) : null}

        <View style={styles.actions}>
          <Button title="Opnieuw scannen" onPress={handleScanAgain} />
          <Button
            title="Zelf invoeren"
            variant="secondary"
            onPress={() => router.replace('/(tabs)/food/manual')}
          />
          <Button title="Terug" variant="secondary" onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  return (
    <View style={styles.cameraScreen}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: [...BARCODE_TYPES] }}
        onBarcodeScanned={({ data }) => {
          if (hasScanned.current) return;
          hasScanned.current = true;
          setBarcode(data);
        }}
      />

      <View style={styles.overlay} pointerEvents="box-none">
        <View style={styles.frame} />
        <Card style={styles.hint}>
          <Text variant="label">Richt op de barcode</Text>
          <Text variant="caption" muted>
            Houd de streepjescode in het kader. Hij wordt vanzelf herkend.
          </Text>
          <Button title="Annuleren" variant="secondary" onPress={() => router.back()} />
        </Card>
      </View>
    </View>
  );
}

const makeStyles = (colors: Palette) =>
  StyleSheet.create({
  loading: { marginTop: spacing.xxl },
  spaced: { marginTop: spacing.md, gap: spacing.sm },
  centered: { textAlign: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.lg },
  cameraScreen: { flex: 1, backgroundColor: '#000' },
  overlay: {
    flex: 1,
    justifyContent: 'space-between',
    padding: spacing.lg,
    paddingTop: spacing.xxl,
  },
  frame: {
    alignSelf: 'center',
    width: '80%',
    aspectRatio: 1.6,
    borderWidth: 2,
    borderColor: colors.textInverse,
    borderRadius: radius.md,
  },
  hint: { gap: spacing.sm },
});
