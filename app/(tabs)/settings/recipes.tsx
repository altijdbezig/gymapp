import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip, ChipRow } from '@/components/Chip';
import { Input } from '@/components/Input';
import { Screen } from '@/components/Screen';
import { ScreenHeader } from '@/components/ScreenHeader';
import { Text } from '@/components/Text';
import { useAuth } from '@/features/auth/AuthProvider';
import { useProfile, useUpdateProfile } from '@/features/auth/useProfile';
import {
  DIET_LABELS,
  DIFFICULTY_LABELS,
  type Diet,
  type Difficulty,
} from '@/features/recipes/recipeMatching';
import { colors, spacing } from '@/theme/theme';

const PREP_OPTIONS = [10, 15, 20, 30, 45, 60, 90] as const;
const LIMIT_OPTIONS = [0, 1, 3, 5, 10, 20] as const;

/** Common enough to be worth a chip; anything else is typed in. */
const COMMON_ALLERGIES = [
  'gluten',
  'lactose',
  'noten',
  'pinda',
  'ei',
  'soja',
  'vis',
  'schaaldieren',
  'selderij',
  'mosterd',
] as const;

const CUISINES = [
  'Hollands',
  'Italiaans',
  'Aziatisch',
  'Mediterraans',
  'Mexicaans',
  'Indiaas',
  'Turks',
  'Surinaams',
] as const;

/**
 * What the recipe generator should take into account, and how often it may run.
 *
 * The daily limit is here rather than hidden in code because it is the thing
 * that decides what this feature costs. Zero switches generating off entirely
 * while leaving every recipe that already exists searchable and free.
 */
export default function RecipeSettingsScreen() {
  const { session } = useAuth();
  const userId = session?.user.id ?? null;

  const profileQuery = useProfile(userId);
  const updateProfile = useUpdateProfile(userId);
  const profile = profileQuery.data;

  const [newAllergy, setNewAllergy] = useState('');

  if (profileQuery.isLoading || !profile) {
    return (
      <Screen>
        <ScreenHeader title="Recepten" />
        <ActivityIndicator color={colors.primary} />
      </Screen>
    );
  }

  function toggleAllergy(allergy: string) {
    const current = profile!.allergies;
    const next = current.includes(allergy)
      ? current.filter((entry) => entry !== allergy)
      : [...current, allergy];

    updateProfile.mutate({ allergies: next });
  }

  function toggleCuisine(cuisine: string) {
    const current = profile!.cuisines;
    const next = current.includes(cuisine)
      ? current.filter((entry) => entry !== cuisine)
      : [...current, cuisine];

    updateProfile.mutate({ cuisines: next });
  }

  return (
    <Screen>
      <ScreenHeader
        title="Recepten"
        subtitle="Waar de app rekening mee houdt als hij een recept maakt."
      />

      <Card style={styles.card}>
        <Text variant="heading">Dieet</Text>
        <ChipRow>
          {(Object.keys(DIET_LABELS) as Diet[]).map((diet) => (
            <Chip
              key={diet}
              label={DIET_LABELS[diet]}
              selected={profile.diet === diet}
              onPress={() => updateProfile.mutate({ diet })}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Allergieën</Text>
        <Text variant="caption" muted>
          Recepten met een van deze ingrediënten worden niet getoond en niet gemaakt.
        </Text>

        <ChipRow>
          {COMMON_ALLERGIES.map((allergy) => (
            <Chip
              key={allergy}
              label={allergy}
              selected={profile.allergies.includes(allergy)}
              onPress={() => toggleAllergy(allergy)}
            />
          ))}
        </ChipRow>

        {profile.allergies.filter(
          (allergy) => !(COMMON_ALLERGIES as readonly string[]).includes(allergy),
        ).length > 0 ? (
          <View style={styles.customList}>
            {profile.allergies
              .filter((allergy) => !(COMMON_ALLERGIES as readonly string[]).includes(allergy))
              .map((allergy) => (
                <Pressable
                  key={allergy}
                  accessibilityRole="button"
                  accessibilityLabel={`${allergy} verwijderen`}
                  onPress={() => toggleAllergy(allergy)}
                >
                  <Chip label={`${allergy} ✕`} selected onPress={() => toggleAllergy(allergy)} />
                </Pressable>
              ))}
          </View>
        ) : null}

        <Input
          label="Anders"
          value={newAllergy}
          onChangeText={setNewAllergy}
          placeholder="Bijvoorbeeld: kaneel"
        />
        <Button
          title="Toevoegen"
          variant="secondary"
          onPress={() => {
            const trimmed = newAllergy.trim().toLowerCase();
            if (!trimmed || profile.allergies.includes(trimmed)) return;

            updateProfile.mutate({ allergies: [...profile.allergies, trimmed] });
            setNewAllergy('');
          }}
        />
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Keuken</Text>
        <Text variant="caption" muted>
          Optioneel. Laat leeg als het niet uitmaakt.
        </Text>
        <ChipRow>
          {CUISINES.map((cuisine) => (
            <Chip
              key={cuisine}
              label={cuisine}
              selected={profile.cuisines.includes(cuisine)}
              onPress={() => toggleCuisine(cuisine)}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Kooktijd en moeilijkheid</Text>
        <ChipRow>
          {PREP_OPTIONS.map((minutes) => (
            <Chip
              key={minutes}
              label={`${minutes} min`}
              selected={profile.max_prep_minutes === minutes}
              onPress={() => updateProfile.mutate({ max_prep_minutes: minutes })}
            />
          ))}
        </ChipRow>
        <ChipRow>
          {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((difficulty) => (
            <Chip
              key={difficulty}
              label={DIFFICULTY_LABELS[difficulty]}
              selected={profile.max_difficulty === difficulty}
              onPress={() => updateProfile.mutate({ max_difficulty: difficulty })}
            />
          ))}
        </ChipRow>
      </Card>

      <Card style={styles.card}>
        <Text variant="heading">Hoeveel recepten per dag</Text>
        <Text variant="caption" muted>
          Een nieuw recept laten maken kost geld. Recepten die er al staan zijn gratis en tellen
          niet mee. Op 0 zet je het maken helemaal uit.
        </Text>
        <ChipRow>
          {LIMIT_OPTIONS.map((limit) => (
            <Chip
              key={limit}
              label={limit === 0 ? 'Uit' : String(limit)}
              selected={profile.ai_recipe_limit_per_day === limit}
              onPress={() => updateProfile.mutate({ ai_recipe_limit_per_day: limit })}
            />
          ))}
        </ChipRow>
      </Card>

      <Text variant="caption" muted style={styles.note}>
        Recepten worden gemaakt door een AI en de voedingswaarden zijn een schatting. Het is geen
        voedingsadvies. De sleutel voor de AI staat op de server, nooit in de app.
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: { gap: spacing.sm, marginBottom: spacing.md },
  customList: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { marginTop: spacing.md, marginBottom: spacing.xl },
});
