/**
 * Medication and supplements, as React Query sees them.
 *
 * Everything here is scoped to one user by RLS and by every query below. There
 * is no shared cache, no aggregate and no cross-user anything -- this is the
 * one part of the app where "could somebody else ever see this?" has to be
 * answerable with a flat no.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { supabase } from '@/lib/supabase';
import { todayIsoDate } from '@/features/onboarding/parseFormInput';
import { addDays } from '@/lib/date';
import type { Medication, MedicationIntake } from './medicationSchedule';

export const medicationsQueryKey = (userId: string) => ['medications', userId] as const;
export const intakesQueryKey = (userId: string) => ['medication-intakes', userId] as const;

/** How far back the history goes. */
export const INTAKE_HISTORY_DAYS = 60;

export function useMedications(userId: string | null) {
  return useQuery({
    queryKey: medicationsQueryKey(userId ?? 'anonymous'),
    enabled: !!userId,
    queryFn: async (): Promise<Medication[]> => {
      const { data, error } = await supabase
        .from('medications')
        .select('*')
        .eq('user_id', userId!)
        .order('name', { ascending: true });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export function useIntakes(userId: string | null, days = INTAKE_HISTORY_DAYS) {
  const since = addDays(todayIsoDate(), -days);

  return useQuery({
    queryKey: [...intakesQueryKey(userId ?? 'anonymous'), days] as const,
    enabled: !!userId,
    queryFn: async (): Promise<MedicationIntake[]> => {
      const { data, error } = await supabase
        .from('medication_intakes')
        .select('*')
        .eq('user_id', userId!)
        .gte('taken_on', since)
        .order('taken_on', { ascending: false });

      if (error) throw error;
      return data ?? [];
    },
  });
}

export type SaveMedicationInput = {
  userId: string;
  id: string | null;
  name: string;
  dose: string;
  /** "08:00" strings. */
  times: string[];
  /** ISO weekdays; empty means every day. */
  weekdays: number[];
  stockCount: number | null;
  stockUnit: string | null;
  notes: string;
  isActive: boolean;
};

export function useSaveMedication() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: SaveMedicationInput): Promise<Medication> => {
      const row = {
        user_id: input.userId,
        name: input.name.trim().slice(0, 120),
        dose: input.dose.trim() ? input.dose.trim().slice(0, 80) : null,
        times: [...new Set(input.times)].sort(),
        weekdays: [...new Set(input.weekdays)].sort((a, b) => a - b),
        stock_count: input.stockCount,
        stock_unit: input.stockUnit?.trim() ? input.stockUnit.trim().slice(0, 20) : null,
        notes: input.notes.trim() ? input.notes.trim().slice(0, 1000) : null,
        is_active: input.isActive,
      };

      const query = input.id
        ? supabase.from('medications').update(row).eq('id', input.id)
        : supabase.from('medications').insert(row);

      const { data, error } = await query.select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (medication) => {
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey(medication.user_id) });
    },
  });
}

export function useDeleteMedication(userId: string | null) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (id: string) => {
      // The intakes go with it through ON DELETE CASCADE. Deleting a
      // medication is meant to erase it, history included -- this is health
      // data, so "gone" has to mean gone.
      const { error } = await supabase.from('medications').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      if (!userId) return;
      queryClient.invalidateQueries({ queryKey: medicationsQueryKey(userId) });
      queryClient.invalidateQueries({ queryKey: intakesQueryKey(userId) });
    },
  });
}

export type ToggleIntakeInput = {
  userId: string;
  medicationId: string;
  /** "08:00". */
  scheduledTime: string;
  date?: string;
  /** True when it is currently ticked and should be un-ticked. */
  isTaken: boolean;
};

/**
 * Ticking a dose off, and un-ticking it again.
 *
 * The unique key is (medication, day, time), so tapping twice quickly corrects
 * rather than stacking up two rows for one dose.
 */
export function useToggleIntake() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: ToggleIntakeInput) => {
      const takenOn = input.date ?? todayIsoDate();

      if (input.isTaken) {
        const { error } = await supabase
          .from('medication_intakes')
          .delete()
          .eq('medication_id', input.medicationId)
          .eq('taken_on', takenOn)
          .eq('scheduled_time', input.scheduledTime);

        if (error) throw error;
        return input.userId;
      }

      const { error } = await supabase.from('medication_intakes').upsert(
        {
          user_id: input.userId,
          medication_id: input.medicationId,
          taken_on: takenOn,
          scheduled_time: input.scheduledTime,
          taken_at: new Date().toISOString(),
        },
        { onConflict: 'medication_id,taken_on,scheduled_time' },
      );

      if (error) throw error;
      return input.userId;
    },
    onSuccess: (userId) => {
      queryClient.invalidateQueries({ queryKey: intakesQueryKey(userId) });
    },
  });
}
