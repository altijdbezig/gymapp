/**
 * Generated from the Supabase schema — do not edit by hand.
 *
 * Regenerate after every migration (Supabase MCP: generate_typescript_types)
 * and paste the output below this header verbatim. Keeping the generator's own
 * formatting means the next regeneration is a clean diff instead of a reformat.
 *
 * Last generated after migration 0004. Migrations 0005 to 0007 were added by
 * hand in the generator's own format, because this session had no access to the
 * Supabase project — regenerate as soon as the migrations are applied.
 */
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      body_weights: {
        Row: {
          created_at: string
          id: string
          measured_on: string
          user_id: string
          weight_kg: number
        }
        Insert: {
          created_at?: string
          id?: string
          measured_on?: string
          user_id: string
          weight_kg: number
        }
        Update: {
          created_at?: string
          id?: string
          measured_on?: string
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      daily_targets: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          bmr_kcal: number
          carbs_g: number
          clamped_to_bmr: boolean
          created_at: string
          date: string
          fat_g: number
          goal: Database["public"]["Enums"]["goal"]
          id: string
          kcal: number
          protein_g: number
          tdee_kcal: number
          user_id: string
          weight_kg: number
        }
        Insert: {
          activity_level: Database["public"]["Enums"]["activity_level"]
          bmr_kcal: number
          carbs_g: number
          clamped_to_bmr?: boolean
          created_at?: string
          date?: string
          fat_g: number
          goal: Database["public"]["Enums"]["goal"]
          id?: string
          kcal: number
          protein_g: number
          tdee_kcal: number
          user_id: string
          weight_kg: number
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"]
          bmr_kcal?: number
          carbs_g?: number
          clamped_to_bmr?: boolean
          created_at?: string
          date?: string
          fat_g?: number
          goal?: Database["public"]["Enums"]["goal"]
          id?: string
          kcal?: number
          protein_g?: number
          tdee_kcal?: number
          user_id?: string
          weight_kg?: number
        }
        Relationships: []
      }
      exercises: {
        Row: {
          aliases: string[]
          category: Database["public"]["Enums"]["exercise_category"]
          created_at: string
          created_by: string | null
          id: string
          instructions: string | null
          is_custom: boolean
          name: string
          primary_muscle: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles: Database["public"]["Enums"]["muscle_group"][]
        }
        Insert: {
          aliases?: string[]
          category: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_custom?: boolean
          name: string
          primary_muscle: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Update: {
          aliases?: string[]
          category?: Database["public"]["Enums"]["exercise_category"]
          created_at?: string
          created_by?: string | null
          id?: string
          instructions?: string | null
          is_custom?: boolean
          name?: string
          primary_muscle?: Database["public"]["Enums"]["muscle_group"]
          secondary_muscles?: Database["public"]["Enums"]["muscle_group"][]
        }
        Relationships: []
      }
      food_favorites: {
        Row: {
          created_at: string
          food_id: string
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_favorites_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_log_entries: {
        Row: {
          amount_g: number
          brand: string | null
          carbs_g: number | null
          carbs_per_100g: number
          created_at: string
          fat_g: number | null
          fat_per_100g: number
          fiber_g: number | null
          fiber_per_100g: number | null
          food_id: string | null
          id: string
          kcal: number | null
          kcal_per_100g: number
          logged_on: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          portion_count: number | null
          portion_label: string | null
          protein_g: number | null
          protein_per_100g: number
          salt_g: number | null
          salt_per_100g: number | null
          saturated_fat_g: number | null
          saturated_fat_per_100g: number | null
          sugars_g: number | null
          sugars_per_100g: number | null
          user_id: string
        }
        Insert: {
          amount_g: number
          brand?: string | null
          carbs_g?: number | null
          carbs_per_100g: number
          created_at?: string
          fat_g?: number | null
          fat_per_100g: number
          fiber_g?: number | null
          fiber_per_100g?: number | null
          food_id?: string | null
          id?: string
          kcal?: number | null
          kcal_per_100g: number
          logged_on?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          portion_count?: number | null
          portion_label?: string | null
          protein_g?: number | null
          protein_per_100g: number
          salt_g?: number | null
          salt_per_100g?: number | null
          saturated_fat_g?: number | null
          saturated_fat_per_100g?: number | null
          sugars_g?: number | null
          sugars_per_100g?: number | null
          user_id: string
        }
        Update: {
          amount_g?: number
          brand?: string | null
          carbs_g?: number | null
          carbs_per_100g?: number
          created_at?: string
          fat_g?: number | null
          fat_per_100g?: number
          fiber_g?: number | null
          fiber_per_100g?: number | null
          food_id?: string | null
          id?: string
          kcal?: number | null
          kcal_per_100g?: number
          logged_on?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          portion_count?: number | null
          portion_label?: string | null
          protein_g?: number | null
          protein_per_100g?: number
          salt_g?: number | null
          salt_per_100g?: number | null
          saturated_fat_g?: number | null
          saturated_fat_per_100g?: number | null
          sugars_g?: number | null
          sugars_per_100g?: number | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_log_entries_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      food_portions: {
        Row: {
          created_at: string
          food_id: string
          grams: number
          id: string
          is_default: boolean
          label: string
          user_id: string
        }
        Insert: {
          created_at?: string
          food_id: string
          grams: number
          id?: string
          is_default?: boolean
          label: string
          user_id: string
        }
        Update: {
          created_at?: string
          food_id?: string
          grams?: number
          id?: string
          is_default?: boolean
          label?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "food_portions_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
        ]
      }
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_per_100g: number
          created_at: string
          created_by: string | null
          fat_per_100g: number
          fiber_per_100g: number | null
          id: string
          is_public: boolean
          kcal_per_100g: number
          name: string
          protein_per_100g: number
          salt_per_100g: number | null
          saturated_fat_per_100g: number | null
          serving_size_g: number | null
          source: Database["public"]["Enums"]["food_source"]
          sugars_per_100g: number | null
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g: number
          created_at?: string
          created_by?: string | null
          fat_per_100g: number
          fiber_per_100g?: number | null
          id?: string
          is_public?: boolean
          kcal_per_100g: number
          name: string
          protein_per_100g: number
          salt_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          serving_size_g?: number | null
          source: Database["public"]["Enums"]["food_source"]
          sugars_per_100g?: number | null
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          created_by?: string | null
          fat_per_100g?: number
          fiber_per_100g?: number | null
          id?: string
          is_public?: boolean
          kcal_per_100g?: number
          name?: string
          protein_per_100g?: number
          salt_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          serving_size_g?: number | null
          source?: Database["public"]["Enums"]["food_source"]
          sugars_per_100g?: number | null
        }
        Relationships: []
      }
      meal_items: {
        Row: {
          amount_g: number
          brand: string | null
          carbs_per_100g: number
          created_at: string
          fat_per_100g: number
          fiber_per_100g: number | null
          food_id: string | null
          id: string
          kcal_per_100g: number
          meal_id: string
          name: string
          order_index: number
          protein_per_100g: number
          salt_per_100g: number | null
          saturated_fat_per_100g: number | null
          sugars_per_100g: number | null
        }
        Insert: {
          amount_g: number
          brand?: string | null
          carbs_per_100g: number
          created_at?: string
          fat_per_100g: number
          fiber_per_100g?: number | null
          food_id?: string | null
          id?: string
          kcal_per_100g: number
          meal_id: string
          name: string
          order_index?: number
          protein_per_100g: number
          salt_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          sugars_per_100g?: number | null
        }
        Update: {
          amount_g?: number
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          fat_per_100g?: number
          fiber_per_100g?: number | null
          food_id?: string | null
          id?: string
          kcal_per_100g?: number
          meal_id?: string
          name?: string
          order_index?: number
          protein_per_100g?: number
          salt_per_100g?: number | null
          saturated_fat_per_100g?: number | null
          sugars_per_100g?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "meal_items_food_id_fkey"
            columns: ["food_id"]
            isOneToOne: false
            referencedRelation: "foods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meal_items_meal_id_fkey"
            columns: ["meal_id"]
            isOneToOne: false
            referencedRelation: "meals"
            referencedColumns: ["id"]
          },
        ]
      }
      meals: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["meal_kind"]
          name: string
          notes: string | null
          servings: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["meal_kind"]
          name: string
          notes?: string | null
          servings?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["meal_kind"]
          name?: string
          notes?: string | null
          servings?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      personal_records: {
        Row: {
          best_1rm_kg: number | null
          best_1rm_on: string | null
          best_volume_kg: number | null
          best_volume_on: string | null
          best_weight_kg: number | null
          best_weight_on: string | null
          best_weight_reps: number | null
          created_at: string
          exercise_id: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          best_1rm_kg?: number | null
          best_1rm_on?: string | null
          best_volume_kg?: number | null
          best_volume_on?: string | null
          best_weight_kg?: number | null
          best_weight_on?: string | null
          best_weight_reps?: number | null
          created_at?: string
          exercise_id: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          best_1rm_kg?: number | null
          best_1rm_on?: string | null
          best_volume_kg?: number | null
          best_volume_on?: string | null
          best_weight_kg?: number | null
          best_weight_on?: string | null
          best_weight_reps?: number | null
          created_at?: string
          exercise_id?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "personal_records_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          activity_level: Database["public"]["Enums"]["activity_level"] | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          goal: Database["public"]["Enums"]["goal"] | null
          height_cm: number | null
          onboarding_completed: boolean
          sex: Database["public"]["Enums"]["sex"] | null
          updated_at: string
          user_id: string
          water_goal_ml: number
        }
        Insert: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          goal?: Database["public"]["Enums"]["goal"] | null
          height_cm?: number | null
          onboarding_completed?: boolean
          sex?: Database["public"]["Enums"]["sex"] | null
          updated_at?: string
          user_id: string
          water_goal_ml?: number
        }
        Update: {
          activity_level?: Database["public"]["Enums"]["activity_level"] | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          goal?: Database["public"]["Enums"]["goal"] | null
          height_cm?: number | null
          onboarding_completed?: boolean
          sex?: Database["public"]["Enums"]["sex"] | null
          updated_at?: string
          user_id?: string
          water_goal_ml?: number
        }
        Relationships: []
      }
      routine_folders: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          user_id?: string
        }
        Relationships: []
      }
      set_logs: {
        Row: {
          created_at: string
          distance_m: number | null
          duration_seconds: number | null
          exercise_id: string
          exercise_order: number
          id: string
          is_completed: boolean
          reps: number | null
          rpe: number | null
          session_id: string
          set_index: number
          set_type: Database["public"]["Enums"]["set_type"]
          superset_group: number | null
          weight_kg: number | null
        }
        Insert: {
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_id: string
          exercise_order?: number
          id?: string
          is_completed?: boolean
          reps?: number | null
          rpe?: number | null
          session_id: string
          set_index: number
          set_type?: Database["public"]["Enums"]["set_type"]
          superset_group?: number | null
          weight_kg?: number | null
        }
        Update: {
          created_at?: string
          distance_m?: number | null
          duration_seconds?: number | null
          exercise_id?: string
          exercise_order?: number
          id?: string
          is_completed?: boolean
          reps?: number | null
          rpe?: number | null
          session_id?: string
          set_index?: number
          set_type?: Database["public"]["Enums"]["set_type"]
          superset_group?: number | null
          weight_kg?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "set_logs_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "set_logs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "workout_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      water_entries: {
        Row: {
          created_at: string
          id: string
          logged_on: string
          ml: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          logged_on?: string
          ml: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          logged_on?: string
          ml?: number
          user_id?: string
        }
        Relationships: []
      }
      week_schedule: {
        Row: {
          created_at: string
          id: string
          user_id: string
          weekday: number
          workout_day_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          user_id: string
          weekday: number
          workout_day_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          user_id?: string
          weekday?: number
          workout_day_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "week_schedule_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_day_exercises: {
        Row: {
          created_at: string
          exercise_id: string
          id: string
          note: string | null
          order_index: number
          rep_max: number | null
          rep_min: number | null
          rest_seconds: number
          superset_group: number | null
          target_sets: number
          workout_day_id: string
        }
        Insert: {
          created_at?: string
          exercise_id: string
          id?: string
          note?: string | null
          order_index?: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number
          superset_group?: number | null
          target_sets?: number
          workout_day_id: string
        }
        Update: {
          created_at?: string
          exercise_id?: string
          id?: string
          note?: string | null
          order_index?: number
          rep_max?: number | null
          rep_min?: number | null
          rest_seconds?: number
          superset_group?: number | null
          target_sets?: number
          workout_day_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_day_exercises_exercise_id_fkey"
            columns: ["exercise_id"]
            isOneToOne: false
            referencedRelation: "exercises"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workout_day_exercises_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_days: {
        Row: {
          created_at: string
          id: string
          name: string
          order_index: number
          plan_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          order_index?: number
          plan_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          order_index?: number
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_days_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "workout_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_plans: {
        Row: {
          created_at: string
          folder_id: string | null
          id: string
          name: string
          notes: string | null
          order_index: number
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          folder_id?: string | null
          id?: string
          name: string
          notes?: string | null
          order_index?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          folder_id?: string | null
          id?: string
          name?: string
          notes?: string | null
          order_index?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workout_plans_folder_id_fkey"
            columns: ["folder_id"]
            isOneToOne: false
            referencedRelation: "routine_folders"
            referencedColumns: ["id"]
          },
        ]
      }
      workout_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          is_comeback: boolean
          name: string
          notes: string | null
          performed_on: string
          started_at: string
          user_id: string
          workout_day_id: string | null
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_comeback?: boolean
          name: string
          notes?: string | null
          performed_on?: string
          started_at?: string
          user_id: string
          workout_day_id?: string | null
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          is_comeback?: boolean
          name?: string
          notes?: string | null
          performed_on?: string
          started_at?: string
          user_id?: string
          workout_day_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workout_sessions_workout_day_id_fkey"
            columns: ["workout_day_id"]
            isOneToOne: false
            referencedRelation: "workout_days"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      activity_level:
        | "sedentary"
        | "light"
        | "moderate"
        | "active"
        | "very_active"
      exercise_category:
        | "barbell"
        | "dumbbell"
        | "machine"
        | "cable"
        | "bodyweight"
        | "cardio"
        | "other"
      food_source: "off" | "custom"
      goal: "cut" | "maintenance" | "bulk"
      meal_kind: "meal" | "recipe"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
      muscle_group:
        | "chest"
        | "back"
        | "lats"
        | "traps"
        | "shoulders"
        | "biceps"
        | "triceps"
        | "forearms"
        | "quads"
        | "hamstrings"
        | "glutes"
        | "calves"
        | "abs"
        | "obliques"
        | "lower_back"
        | "neck"
        | "full_body"
        | "cardio"
      set_type: "normal" | "warmup" | "drop" | "failure"
      sex: "male" | "female"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      activity_level: [
        "sedentary",
        "light",
        "moderate",
        "active",
        "very_active",
      ],
      exercise_category: [
        "barbell",
        "dumbbell",
        "machine",
        "cable",
        "bodyweight",
        "cardio",
        "other",
      ],
      food_source: ["off", "custom"],
      goal: ["cut", "maintenance", "bulk"],
      meal_kind: ["meal", "recipe"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      muscle_group: [
        "chest",
        "back",
        "lats",
        "traps",
        "shoulders",
        "biceps",
        "triceps",
        "forearms",
        "quads",
        "hamstrings",
        "glutes",
        "calves",
        "abs",
        "obliques",
        "lower_back",
        "neck",
        "full_body",
        "cardio",
      ],
      set_type: ["normal", "warmup", "drop", "failure"],
      sex: ["male", "female"],
    },
  },
} as const
