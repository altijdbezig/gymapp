/**
 * Generated from the Supabase schema — do not edit by hand.
 *
 * Regenerate after every migration (Supabase MCP: generate_typescript_types)
 * and paste the output below this header verbatim. Keeping the generator's own
 * formatting means the next regeneration is a clean diff instead of a reformat.
 *
 * Last generated after migration 0004.
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
      food_log_entries: {
        Row: {
          amount_g: number
          brand: string | null
          carbs_g: number | null
          carbs_per_100g: number
          created_at: string
          fat_g: number | null
          fat_per_100g: number
          food_id: string | null
          id: string
          kcal: number | null
          kcal_per_100g: number
          logged_on: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          protein_g: number | null
          protein_per_100g: number
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
          food_id?: string | null
          id?: string
          kcal?: number | null
          kcal_per_100g: number
          logged_on?: string
          meal_type: Database["public"]["Enums"]["meal_type"]
          name: string
          protein_g?: number | null
          protein_per_100g: number
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
          food_id?: string | null
          id?: string
          kcal?: number | null
          kcal_per_100g?: number
          logged_on?: string
          meal_type?: Database["public"]["Enums"]["meal_type"]
          name?: string
          protein_g?: number | null
          protein_per_100g?: number
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
      foods: {
        Row: {
          barcode: string | null
          brand: string | null
          carbs_per_100g: number
          created_at: string
          created_by: string | null
          fat_per_100g: number
          id: string
          is_public: boolean
          kcal_per_100g: number
          name: string
          protein_per_100g: number
          serving_size_g: number | null
          source: Database["public"]["Enums"]["food_source"]
        }
        Insert: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g: number
          created_at?: string
          created_by?: string | null
          fat_per_100g: number
          id?: string
          is_public?: boolean
          kcal_per_100g: number
          name: string
          protein_per_100g: number
          serving_size_g?: number | null
          source: Database["public"]["Enums"]["food_source"]
        }
        Update: {
          barcode?: string | null
          brand?: string | null
          carbs_per_100g?: number
          created_at?: string
          created_by?: string | null
          fat_per_100g?: number
          id?: string
          is_public?: boolean
          kcal_per_100g?: number
          name?: string
          protein_per_100g?: number
          serving_size_g?: number | null
          source?: Database["public"]["Enums"]["food_source"]
        }
        Relationships: []
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
        }
        Relationships: []
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
      food_source: "off" | "custom"
      goal: "cut" | "maintenance" | "bulk"
      meal_type: "breakfast" | "lunch" | "dinner" | "snack"
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
      food_source: ["off", "custom"],
      goal: ["cut", "maintenance", "bulk"],
      meal_type: ["breakfast", "lunch", "dinner", "snack"],
      sex: ["male", "female"],
    },
  },
} as const
