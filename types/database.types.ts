export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      app_settings: {
        Row: {
          created_at: string;
          key: string;
          updated_at: string;
          updated_by: string | null;
          value: NonNullable<Json>;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          key: string;
          updated_at?: string;
          updated_by?: string | null;
          value: NonNullable<Json>;
        };
        Update: {
          created_at?: string;
          key?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: NonNullable<Json>;
        };
        Relationships: [
          {
            foreignKeyName: "app_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          after: Json | null;
          before: Json | null;
          created_at: string;
          id: number;
          ip: unknown;
          record_id: string | null;
          table_name: string | null;
          updated_at: string;
          user_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          action: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: number;
          ip?: unknown;
          record_id?: string | null;
          table_name?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          action?: string;
          after?: Json | null;
          before?: Json | null;
          created_at?: string;
          id?: number;
          ip?: unknown;
          record_id?: string | null;
          table_name?: string | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      contact_links: {
        Row: {
          created_at: string;
          id: string;
          is_visible: boolean;
          label_ar: string;
          label_en: string | null;
          sort_order: number;
          type: string;
          updated_at: string;
          url: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          label_ar: string;
          label_en?: string | null;
          sort_order?: number;
          type: string;
          updated_at?: string;
          url: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_visible?: boolean;
          label_ar?: string;
          label_en?: string | null;
          sort_order?: number;
          type?: string;
          updated_at?: string;
          url?: string;
        };
        Relationships: [];
      };
      profile_private: {
        Row: {
          address: string | null;
          contact_email: string | null;
          created_at: string;
          phone: string | null;
          profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          address?: string | null;
          contact_email?: string | null;
          created_at?: string;
          phone?: string | null;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          address?: string | null;
          contact_email?: string | null;
          created_at?: string;
          phone?: string | null;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "profile_private_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          country_code: string | null;
          created_at: string;
          display_name: string | null;
          full_name: string;
          id: string;
          is_active: boolean;
          preferred_locale: string;
          role: Database["public"]["Enums"]["user_role"];
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avatar_url?: string | null;
          country_code?: string | null;
          created_at?: string;
          display_name?: string | null;
          full_name: string;
          id: string;
          is_active?: boolean;
          preferred_locale?: string;
          role: Database["public"]["Enums"]["user_role"];
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          country_code?: string | null;
          created_at?: string;
          display_name?: string | null;
          full_name?: string;
          id?: string;
          is_active?: boolean;
          preferred_locale?: string;
          role?: Database["public"]["Enums"]["user_role"];
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      set_account_active: {
        Args: { p_is_active: boolean; p_profile_id: string };
        Returns: undefined;
      };
      update_public_app_settings: {
        Args: { p_academy_profile: Json; p_support_hours: Json };
        Returns: undefined;
      };
    };
    Enums: {
      application_status:
        "new" | "contacted" | "trial_booked" | "accepted" | "rejected" | "postponed";
      assignment_status: "active" | "paused" | "ended";
      attendance_status:
        | "present"
        | "late"
        | "student_absent"
        | "student_excused"
        | "teacher_absent"
        | "cancelled_teacher"
        | "cancelled_admin";
      billing_period: "monthly" | "quarterly" | "yearly";
      gender_t: "male" | "female";
      invoice_status: "draft" | "issued" | "partially_paid" | "paid" | "overdue" | "void";
      payment_kind: "payment" | "refund";
      payment_status: "pending_confirmation" | "confirmed" | "rejected";
      payout_status: "accruing" | "due" | "approved" | "paid";
      progress_status: "not_started" | "in_progress" | "mastered" | "needs_review";
      report_status: "draft" | "approved" | "admin_review" | "visible";
      session_kind: "regular" | "trial" | "makeup" | "extra";
      session_status: "scheduled" | "held" | "missed" | "cancelled" | "rescheduled";
      session_type_t:
        "new_memo" | "near_review" | "far_review" | "recitation" | "noorani" | "matn_theory";
      student_status: "active" | "dropped" | "graduated" | "suspended" | "archived";
      subscription_status: "trial" | "active" | "paused" | "expired" | "cancelled";
      user_role: "admin" | "teacher" | "student" | "parent";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      application_status: ["new", "contacted", "trial_booked", "accepted", "rejected", "postponed"],
      assignment_status: ["active", "paused", "ended"],
      attendance_status: [
        "present",
        "late",
        "student_absent",
        "student_excused",
        "teacher_absent",
        "cancelled_teacher",
        "cancelled_admin",
      ],
      billing_period: ["monthly", "quarterly", "yearly"],
      gender_t: ["male", "female"],
      invoice_status: ["draft", "issued", "partially_paid", "paid", "overdue", "void"],
      payment_kind: ["payment", "refund"],
      payment_status: ["pending_confirmation", "confirmed", "rejected"],
      payout_status: ["accruing", "due", "approved", "paid"],
      progress_status: ["not_started", "in_progress", "mastered", "needs_review"],
      report_status: ["draft", "approved", "admin_review", "visible"],
      session_kind: ["regular", "trial", "makeup", "extra"],
      session_status: ["scheduled", "held", "missed", "cancelled", "rescheduled"],
      session_type_t: [
        "new_memo",
        "near_review",
        "far_review",
        "recitation",
        "noorani",
        "matn_theory",
      ],
      student_status: ["active", "dropped", "graduated", "suspended", "archived"],
      subscription_status: ["trial", "active", "paused", "expired", "cancelled"],
      user_role: ["admin", "teacher", "student", "parent"],
    },
  },
} as const;
