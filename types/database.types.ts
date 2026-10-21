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
      applications: {
        Row: {
          consent_at: string;
          consent_version: string;
          contact_email: string | null;
          contact_hash: string;
          contact_phone: string | null;
          converted_student_id: string | null;
          country_code: string | null;
          created_at: string;
          guardian_name: string | null;
          id: string;
          internal_notes: string | null;
          lookup_hash: string;
          notes: string | null;
          order_no: string;
          package_id: string | null;
          preferred_teacher_gender: Database["public"]["Enums"]["gender_t"] | null;
          preferred_times: NonNullable<Json>;
          request_ip_hash: string;
          self_level: string;
          source: string;
          status: Database["public"]["Enums"]["application_status"];
          student_age: number;
          student_gender: Database["public"]["Enums"]["gender_t"];
          student_name: string;
          timezone: string;
          track_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          consent_at?: string;
          consent_version: string;
          contact_email?: string | null;
          contact_hash: string;
          contact_phone?: string | null;
          converted_student_id?: string | null;
          country_code?: string | null;
          created_at?: string;
          guardian_name?: string | null;
          id?: string;
          internal_notes?: string | null;
          lookup_hash: string;
          notes?: string | null;
          order_no: string;
          package_id?: string | null;
          preferred_teacher_gender?: Database["public"]["Enums"]["gender_t"] | null;
          preferred_times: NonNullable<Json>;
          request_ip_hash: string;
          self_level: string;
          source?: string;
          status?: Database["public"]["Enums"]["application_status"];
          student_age: number;
          student_gender: Database["public"]["Enums"]["gender_t"];
          student_name: string;
          timezone: string;
          track_id?: string | null;
          updated_at?: string;
        };
        Update: {
          consent_at?: string;
          consent_version?: string;
          contact_email?: string | null;
          contact_hash?: string;
          contact_phone?: string | null;
          converted_student_id?: string | null;
          country_code?: string | null;
          created_at?: string;
          guardian_name?: string | null;
          id?: string;
          internal_notes?: string | null;
          lookup_hash?: string;
          notes?: string | null;
          order_no?: string;
          package_id?: string | null;
          preferred_teacher_gender?: Database["public"]["Enums"]["gender_t"] | null;
          preferred_times?: NonNullable<Json>;
          request_ip_hash?: string;
          self_level?: string;
          source?: string;
          status?: Database["public"]["Enums"]["application_status"];
          student_age?: number;
          student_gender?: Database["public"]["Enums"]["gender_t"];
          student_name?: string;
          timezone?: string;
          track_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "applications_converted_student_id_fkey";
            columns: ["converted_student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "applications_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "applications_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      attendance: {
        Row: {
          locked_at: string | null;
          minutes: number | null;
          recorded_at: string;
          recorded_by: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_joined_at: string | null;
          student_notice_at: string | null;
          teacher_joined_at: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          locked_at?: string | null;
          minutes?: number | null;
          recorded_at?: string;
          recorded_by: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_joined_at?: string | null;
          student_notice_at?: string | null;
          teacher_joined_at?: string | null;
          updated_at?: string;
        };
        Update: {
          locked_at?: string | null;
          minutes?: number | null;
          recorded_at?: string;
          recorded_by?: string;
          session_id?: string;
          status?: Database["public"]["Enums"]["attendance_status"];
          student_joined_at?: string | null;
          student_notice_at?: string | null;
          teacher_joined_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "attendance_recorded_by_fkey";
            columns: ["recorded_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "attendance_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
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
      calendar_feed_tokens: {
        Row: {
          created_at: string;
          revoked_at: string | null;
          token_hash: string;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          revoked_at?: string | null;
          token_hash: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          revoked_at?: string | null;
          token_hash?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "calendar_feed_tokens_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
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
      countries: {
        Row: {
          code: string;
          created_at: string;
          currency: string;
          default_timezone: string | null;
          is_enabled: boolean;
          name_ar: string;
          name_en: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          currency: string;
          default_timezone?: string | null;
          is_enabled?: boolean;
          name_ar: string;
          name_en?: string | null;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          currency?: string;
          default_timezone?: string | null;
          is_enabled?: boolean;
          name_ar?: string;
          name_en?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      coupons: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          currency: string | null;
          ends_at: string | null;
          id: string;
          is_active: boolean;
          kind: string;
          max_redemptions: number | null;
          package_id: string | null;
          redeemed_count: number;
          starts_at: string | null;
          updated_at: string;
          value: number;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind: string;
          max_redemptions?: number | null;
          package_id?: string | null;
          redeemed_count?: number;
          starts_at?: string | null;
          updated_at?: string;
          value: number;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          ends_at?: string | null;
          id?: string;
          is_active?: boolean;
          kind?: string;
          max_redemptions?: number | null;
          package_id?: string | null;
          redeemed_count?: number;
          starts_at?: string | null;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "coupons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "coupons_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
        ];
      };
      eval_criteria: {
        Row: {
          applies_to: Database["public"]["Enums"]["session_type_t"][];
          code: string;
          name_ar: string;
          name_en: string;
          sort_order: number;
        };
        ComputedFields: never;
        Insert: {
          applies_to: Database["public"]["Enums"]["session_type_t"][];
          code: string;
          name_ar: string;
          name_en: string;
          sort_order?: number;
        };
        Update: {
          applies_to?: Database["public"]["Enums"]["session_type_t"][];
          code?: string;
          name_ar?: string;
          name_en?: string;
          sort_order?: number;
        };
        Relationships: [];
      };
      eval_settings: {
        Row: {
          d_forgot: number;
          d_major: number;
          d_minor: number;
          d_prompt: number;
          rating_thresholds: NonNullable<Json>;
          session_type: Database["public"]["Enums"]["session_type_t"];
        };
        ComputedFields: never;
        Insert: {
          d_forgot?: number;
          d_major?: number;
          d_minor?: number;
          d_prompt?: number;
          rating_thresholds?: NonNullable<Json>;
          session_type: Database["public"]["Enums"]["session_type_t"];
        };
        Update: {
          d_forgot?: number;
          d_major?: number;
          d_minor?: number;
          d_prompt?: number;
          rating_thresholds?: NonNullable<Json>;
          session_type?: Database["public"]["Enums"]["session_type_t"];
        };
        Relationships: [];
      };
      eval_weights: {
        Row: {
          criterion_code: string;
          session_type: Database["public"]["Enums"]["session_type_t"];
          weight: number;
        };
        ComputedFields: never;
        Insert: {
          criterion_code: string;
          session_type: Database["public"]["Enums"]["session_type_t"];
          weight: number;
        };
        Update: {
          criterion_code?: string;
          session_type?: Database["public"]["Enums"]["session_type_t"];
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "eval_weights_criterion_code_fkey";
            columns: ["criterion_code"];
            isOneToOne: false;
            referencedRelation: "eval_criteria";
            referencedColumns: ["code"];
          },
        ];
      };
      guardians: {
        Row: {
          created_at: string;
          id: string;
          profile_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          profile_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          profile_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "guardians_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      job_runs: {
        Row: {
          affected_rows: number | null;
          details: NonNullable<Json>;
          finished_at: string | null;
          id: number;
          job_name: string;
          result: string;
          started_at: string;
        };
        ComputedFields: never;
        Insert: {
          affected_rows?: number | null;
          details?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          job_name: string;
          result?: string;
          started_at?: string;
        };
        Update: {
          affected_rows?: number | null;
          details?: NonNullable<Json>;
          finished_at?: string | null;
          id?: never;
          job_name?: string;
          result?: string;
          started_at?: string;
        };
        Relationships: [];
      };
      levels: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string | null;
          sort_order: number;
          track_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en?: string | null;
          sort_order?: number;
          track_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string | null;
          sort_order?: number;
          track_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "levels_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      makeup_entitlements: {
        Row: {
          created_at: string;
          expires_at: string;
          id: string;
          outside_period_cap: boolean;
          source_session_id: string;
          student_id: string;
          subscription_id: string;
          updated_at: string;
          used_by_session_id: string | null;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          expires_at: string;
          id?: string;
          outside_period_cap?: boolean;
          source_session_id: string;
          student_id: string;
          subscription_id: string;
          updated_at?: string;
          used_by_session_id?: string | null;
        };
        Update: {
          created_at?: string;
          expires_at?: string;
          id?: string;
          outside_period_cap?: boolean;
          source_session_id?: string;
          student_id?: string;
          subscription_id?: string;
          updated_at?: string;
          used_by_session_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "makeup_entitlements_source_session_id_fkey";
            columns: ["source_session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "makeup_entitlements_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "makeup_entitlements_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "makeup_entitlements_used_by_session_id_fkey";
            columns: ["used_by_session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      memorization_plans: {
        Row: {
          created_at: string;
          created_by: string;
          ends_on: string | null;
          id: string;
          monthly_target_pages: number;
          starts_on: string;
          student_id: string;
          updated_at: string;
          updated_by: string;
          weekly_target_pages: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string;
          ends_on?: string | null;
          id?: string;
          monthly_target_pages: number;
          starts_on?: string;
          student_id: string;
          updated_at?: string;
          updated_by?: string;
          weekly_target_pages: number;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          ends_on?: string | null;
          id?: string;
          monthly_target_pages?: number;
          starts_on?: string;
          student_id?: string;
          updated_at?: string;
          updated_by?: string;
          weekly_target_pages?: number;
        };
        Relationships: [
          {
            foreignKeyName: "memorization_plans_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memorization_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "memorization_plans_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      memorization_progress: {
        Row: {
          avg_score: number | null;
          created_at: string;
          first_memorized_at: string | null;
          last_reviewed_at: string | null;
          next_review_due: string | null;
          page: number;
          review_count: number;
          review_stage: number;
          status: Database["public"]["Enums"]["progress_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          avg_score?: number | null;
          created_at?: string;
          first_memorized_at?: string | null;
          last_reviewed_at?: string | null;
          next_review_due?: string | null;
          page: number;
          review_count?: number;
          review_stage?: number;
          status?: Database["public"]["Enums"]["progress_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          avg_score?: number | null;
          created_at?: string;
          first_memorized_at?: string | null;
          last_reviewed_at?: string | null;
          next_review_due?: string | null;
          page?: number;
          review_count?: number;
          review_stage?: number;
          status?: Database["public"]["Enums"]["progress_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "memorization_progress_page_fkey";
            columns: ["page"];
            isOneToOne: false;
            referencedRelation: "quran_pages";
            referencedColumns: ["page"];
          },
          {
            foreignKeyName: "memorization_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_outbox: {
        Row: {
          attempts: number;
          channel: string;
          created_at: string;
          id: string;
          last_error: string | null;
          next_attempt_at: string;
          notification_id: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          attempts?: number;
          channel: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          notification_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          attempts?: number;
          channel?: string;
          created_at?: string;
          id?: string;
          last_error?: string | null;
          next_attempt_at?: string;
          notification_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_outbox_notification_id_fkey";
            columns: ["notification_id"];
            isOneToOne: false;
            referencedRelation: "notifications";
            referencedColumns: ["id"];
          },
        ];
      };
      notification_prefs: {
        Row: {
          prefs: NonNullable<Json>;
          updated_at: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          prefs?: NonNullable<Json>;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          prefs?: NonNullable<Json>;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notification_prefs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          payload: NonNullable<Json>;
          read_at: string | null;
          type: string;
          user_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          type: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          payload?: NonNullable<Json>;
          read_at?: string | null;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      package_import_batches: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          package_count: number;
          payload: NonNullable<Json>;
          price_count: number;
          source_name: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          package_count: number;
          payload: NonNullable<Json>;
          price_count: number;
          source_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          package_count?: number;
          payload?: NonNullable<Json>;
          price_count?: number;
          source_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      package_prices: {
        Row: {
          amount: number;
          country_code: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          id: string;
          is_active: boolean;
          max_amount: number | null;
          min_amount: number | null;
          package_id: string;
          updated_at: string;
          valid_from: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          country_code: string;
          created_at?: string;
          created_by?: string | null;
          currency: string;
          id?: string;
          is_active?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          package_id: string;
          updated_at?: string;
          valid_from?: string;
        };
        Update: {
          amount?: number;
          country_code?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          id?: string;
          is_active?: boolean;
          max_amount?: number | null;
          min_amount?: number | null;
          package_id?: string;
          updated_at?: string;
          valid_from?: string;
        };
        Relationships: [
          {
            foreignKeyName: "package_prices_country_code_fkey";
            columns: ["country_code"];
            isOneToOne: false;
            referencedRelation: "countries";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "package_prices_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "package_prices_package_id_fkey";
            columns: ["package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
        ];
      };
      packages: {
        Row: {
          audience: string | null;
          billing_period: Database["public"]["Enums"]["billing_period"];
          created_at: string;
          created_by: string | null;
          description_ar: string | null;
          description_en: string | null;
          duration_min: number;
          features: NonNullable<Json>;
          id: string;
          is_active: boolean;
          is_published: boolean;
          name_ar: string;
          name_en: string | null;
          policy: NonNullable<Json>;
          sessions_per_week: number;
          slug: string;
          sort_order: number;
          teacher_gender: Database["public"]["Enums"]["gender_t"] | null;
          track_id: string | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          audience?: string | null;
          billing_period?: Database["public"]["Enums"]["billing_period"];
          created_at?: string;
          created_by?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          duration_min?: number;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          is_published?: boolean;
          name_ar: string;
          name_en?: string | null;
          policy?: NonNullable<Json>;
          sessions_per_week: number;
          slug: string;
          sort_order?: number;
          teacher_gender?: Database["public"]["Enums"]["gender_t"] | null;
          track_id?: string | null;
          updated_at?: string;
        };
        Update: {
          audience?: string | null;
          billing_period?: Database["public"]["Enums"]["billing_period"];
          created_at?: string;
          created_by?: string | null;
          description_ar?: string | null;
          description_en?: string | null;
          duration_min?: number;
          features?: NonNullable<Json>;
          id?: string;
          is_active?: boolean;
          is_published?: boolean;
          name_ar?: string;
          name_en?: string | null;
          policy?: NonNullable<Json>;
          sessions_per_week?: number;
          slug?: string;
          sort_order?: number;
          teacher_gender?: Database["public"]["Enums"]["gender_t"] | null;
          track_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "packages_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "packages_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      placement_tests: {
        Row: {
          application_id: string;
          created_at: string;
          evaluator_id: string;
          id: string;
          memorization_score: number | null;
          notes: string | null;
          recitation_score: number | null;
          recommended_package_id: string | null;
          recommended_track_id: string | null;
          tajweed_score: number | null;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          application_id: string;
          created_at?: string;
          evaluator_id: string;
          id?: string;
          memorization_score?: number | null;
          notes?: string | null;
          recitation_score?: number | null;
          recommended_package_id?: string | null;
          recommended_track_id?: string | null;
          tajweed_score?: number | null;
          updated_at?: string;
        };
        Update: {
          application_id?: string;
          created_at?: string;
          evaluator_id?: string;
          id?: string;
          memorization_score?: number | null;
          notes?: string | null;
          recitation_score?: number | null;
          recommended_package_id?: string | null;
          recommended_track_id?: string | null;
          tajweed_score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "placement_tests_application_id_fkey";
            columns: ["application_id"];
            isOneToOne: false;
            referencedRelation: "applications";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_tests_evaluator_id_fkey";
            columns: ["evaluator_id"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_tests_recommended_package_id_fkey";
            columns: ["recommended_package_id"];
            isOneToOne: false;
            referencedRelation: "packages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "placement_tests_recommended_track_id_fkey";
            columns: ["recommended_track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
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
      quran_ayahs: {
        Row: {
          ayah_no: number;
          hizb_quarter: number;
          id: number;
          juz: number;
          page: number;
          surah_id: number;
          text_uthmani: string;
        };
        ComputedFields: never;
        Insert: {
          ayah_no: number;
          hizb_quarter: number;
          id: number;
          juz: number;
          page: number;
          surah_id: number;
          text_uthmani: string;
        };
        Update: {
          ayah_no?: number;
          hizb_quarter?: number;
          id?: number;
          juz?: number;
          page?: number;
          surah_id?: number;
          text_uthmani?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quran_ayahs_surah_id_fkey";
            columns: ["surah_id"];
            isOneToOne: false;
            referencedRelation: "quran_surahs";
            referencedColumns: ["id"];
          },
        ];
      };
      quran_dataset_meta: {
        Row: {
          checksum_sha256: string;
          id: number;
          imported_at: string;
          license: string;
          metadata_checksum_sha256: string;
          metadata_version: string;
          source: string;
          source_url: string;
          version: string;
        };
        ComputedFields: never;
        Insert: {
          checksum_sha256: string;
          id?: number;
          imported_at?: string;
          license: string;
          metadata_checksum_sha256: string;
          metadata_version: string;
          source: string;
          source_url: string;
          version: string;
        };
        Update: {
          checksum_sha256?: string;
          id?: number;
          imported_at?: string;
          license?: string;
          metadata_checksum_sha256?: string;
          metadata_version?: string;
          source?: string;
          source_url?: string;
          version?: string;
        };
        Relationships: [];
      };
      quran_pages: {
        Row: {
          first_ayah_id: number;
          juz: number;
          last_ayah_id: number;
          lines_count: number | null;
          page: number;
        };
        ComputedFields: never;
        Insert: {
          first_ayah_id: number;
          juz: number;
          last_ayah_id: number;
          lines_count?: number | null;
          page: number;
        };
        Update: {
          first_ayah_id?: number;
          juz?: number;
          last_ayah_id?: number;
          lines_count?: number | null;
          page?: number;
        };
        Relationships: [
          {
            foreignKeyName: "quran_pages_first_ayah_id_fkey";
            columns: ["first_ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_pages_last_ayah_id_fkey";
            columns: ["last_ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
        ];
      };
      quran_surahs: {
        Row: {
          ayah_count: number;
          id: number;
          name_ar: string;
          name_en: string;
          revelation: string;
        };
        ComputedFields: never;
        Insert: {
          ayah_count: number;
          id: number;
          name_ar: string;
          name_en: string;
          revelation: string;
        };
        Update: {
          ayah_count?: number;
          id?: number;
          name_ar?: string;
          name_en?: string;
          revelation?: string;
        };
        Relationships: [];
      };
      reports: {
        Row: {
          approved_at: string | null;
          body: NonNullable<Json>;
          content_template_version_id: string | null;
          created_at: string;
          id: string;
          made_visible_at: string | null;
          pdf_path: string | null;
          period_end: string;
          period_start: string;
          period_type: string;
          status: Database["public"]["Enums"]["report_status"];
          student_id: string;
          teacher_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          approved_at?: string | null;
          body: NonNullable<Json>;
          content_template_version_id?: string | null;
          created_at?: string;
          id?: string;
          made_visible_at?: string | null;
          pdf_path?: string | null;
          period_end: string;
          period_start: string;
          period_type: string;
          status?: Database["public"]["Enums"]["report_status"];
          student_id: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          body?: NonNullable<Json>;
          content_template_version_id?: string | null;
          created_at?: string;
          id?: string;
          made_visible_at?: string | null;
          pdf_path?: string | null;
          period_end?: string;
          period_start?: string;
          period_type?: string;
          status?: Database["public"]["Enums"]["report_status"];
          student_id?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "reports_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "reports_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      schedule_slots: {
        Row: {
          ambiguous_time_resolution: string | null;
          anchor_timezone: string;
          assignment_id: string;
          created_at: string;
          duration_min: number;
          id: string;
          is_active: boolean;
          local_start_time: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          ambiguous_time_resolution?: string | null;
          anchor_timezone: string;
          assignment_id: string;
          created_at?: string;
          duration_min: number;
          id?: string;
          is_active?: boolean;
          local_start_time: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          ambiguous_time_resolution?: string | null;
          anchor_timezone?: string;
          assignment_id?: string;
          created_at?: string;
          duration_min?: number;
          id?: string;
          is_active?: boolean;
          local_start_time?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "schedule_slots_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "teacher_assignments";
            referencedColumns: ["id"];
          },
        ];
      };
      session_alerts: {
        Row: {
          created_at: string;
          dedupe_key: string;
          detected_at: string;
          id: string;
          metadata: NonNullable<Json>;
          session_id: string;
          student_id: string;
          teacher_id: string;
          type: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          dedupe_key: string;
          detected_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          session_id: string;
          student_id: string;
          teacher_id: string;
          type: string;
        };
        Update: {
          created_at?: string;
          dedupe_key?: string;
          detected_at?: string;
          id?: string;
          metadata?: NonNullable<Json>;
          session_id?: string;
          student_id?: string;
          teacher_id?: string;
          type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_alerts_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_alerts_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_alerts_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      session_credit_ledger: {
        Row: {
          created_at: string;
          created_by: string | null;
          delta: number;
          id: string;
          note: string | null;
          reason: Database["public"]["Enums"]["credit_reason"];
          session_id: string | null;
          subscription_id: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          delta: number;
          id?: string;
          note?: string | null;
          reason: Database["public"]["Enums"]["credit_reason"];
          session_id?: string | null;
          subscription_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          delta?: number;
          id?: string;
          note?: string | null;
          reason?: Database["public"]["Enums"]["credit_reason"];
          session_id?: string | null;
          subscription_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "session_credit_ledger_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_credit_ledger_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_credit_ledger_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      session_evaluations: {
        Row: {
          created_at: string;
          created_by: string;
          decision: string | null;
          errors_major: number;
          errors_minor: number;
          family_note: string | null;
          forgot_count: number;
          from_ayah_id: number | null;
          homework: Json | null;
          id: string;
          is_locked: boolean;
          lines_count: number | null;
          locked_at: string | null;
          pages: number | null;
          prompts_count: number;
          rating: number;
          scores: NonNullable<Json>;
          session_id: string;
          session_type: Database["public"]["Enums"]["session_type_t"];
          settings_snapshot: NonNullable<Json>;
          to_ayah_id: number | null;
          total_score: number;
          updated_at: string;
          weak_tags: string[];
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by: string;
          decision?: string | null;
          errors_major?: number;
          errors_minor?: number;
          family_note?: string | null;
          forgot_count?: number;
          from_ayah_id?: number | null;
          homework?: Json | null;
          id?: string;
          is_locked?: boolean;
          lines_count?: number | null;
          locked_at?: string | null;
          pages?: number | null;
          prompts_count?: number;
          rating?: number;
          scores: NonNullable<Json>;
          session_id: string;
          session_type: Database["public"]["Enums"]["session_type_t"];
          settings_snapshot?: NonNullable<Json>;
          to_ayah_id?: number | null;
          total_score?: number;
          updated_at?: string;
          weak_tags?: string[];
        };
        Update: {
          created_at?: string;
          created_by?: string;
          decision?: string | null;
          errors_major?: number;
          errors_minor?: number;
          family_note?: string | null;
          forgot_count?: number;
          from_ayah_id?: number | null;
          homework?: Json | null;
          id?: string;
          is_locked?: boolean;
          lines_count?: number | null;
          locked_at?: string | null;
          pages?: number | null;
          prompts_count?: number;
          rating?: number;
          scores?: NonNullable<Json>;
          session_id?: string;
          session_type?: Database["public"]["Enums"]["session_type_t"];
          settings_snapshot?: NonNullable<Json>;
          to_ayah_id?: number | null;
          total_score?: number;
          updated_at?: string;
          weak_tags?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "session_evaluations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_evaluations_from_ayah_id_fkey";
            columns: ["from_ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_evaluations_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "session_evaluations_to_ayah_id_fkey";
            columns: ["to_ayah_id"];
            isOneToOne: false;
            referencedRelation: "quran_ayahs";
            referencedColumns: ["id"];
          },
        ];
      };
      sessions: {
        Row: {
          assignment_id: string | null;
          created_at: string;
          duration_min: number;
          ended_at: string | null;
          ends_at: string;
          id: string;
          kind: Database["public"]["Enums"]["session_kind"];
          makeup_of: string | null;
          original_teacher_id: string | null;
          rescheduled_from: string | null;
          scheduled_at: string;
          slot_id: string | null;
          started_at: string | null;
          status: Database["public"]["Enums"]["session_status"];
          student_id: string;
          teacher_id: string;
          updated_at: string;
          zoom_meeting_id: string | null;
          zoom_override_url: string | null;
          zoom_passcode: string | null;
        };
        ComputedFields: never;
        Insert: {
          assignment_id?: string | null;
          created_at?: string;
          duration_min: number;
          ended_at?: string | null;
          ends_at: string;
          id?: string;
          kind?: Database["public"]["Enums"]["session_kind"];
          makeup_of?: string | null;
          original_teacher_id?: string | null;
          rescheduled_from?: string | null;
          scheduled_at: string;
          slot_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          student_id: string;
          teacher_id: string;
          updated_at?: string;
          zoom_meeting_id?: string | null;
          zoom_override_url?: string | null;
          zoom_passcode?: string | null;
        };
        Update: {
          assignment_id?: string | null;
          created_at?: string;
          duration_min?: number;
          ended_at?: string | null;
          ends_at?: string;
          id?: string;
          kind?: Database["public"]["Enums"]["session_kind"];
          makeup_of?: string | null;
          original_teacher_id?: string | null;
          rescheduled_from?: string | null;
          scheduled_at?: string;
          slot_id?: string | null;
          started_at?: string | null;
          status?: Database["public"]["Enums"]["session_status"];
          student_id?: string;
          teacher_id?: string;
          updated_at?: string;
          zoom_meeting_id?: string | null;
          zoom_override_url?: string | null;
          zoom_passcode?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sessions_assignment_id_fkey";
            columns: ["assignment_id"];
            isOneToOne: false;
            referencedRelation: "teacher_assignments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_makeup_of_fkey";
            columns: ["makeup_of"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_original_teacher_id_fkey";
            columns: ["original_teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_rescheduled_from_fkey";
            columns: ["rescheduled_from"];
            isOneToOne: false;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_slot_id_fkey";
            columns: ["slot_id"];
            isOneToOne: false;
            referencedRelation: "schedule_slots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sessions_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      student_guardians: {
        Row: {
          created_at: string;
          guardian_id: string;
          is_payer: boolean;
          is_primary: boolean;
          relation: string | null;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          guardian_id: string;
          is_payer?: boolean;
          is_primary?: boolean;
          relation?: string | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          guardian_id?: string;
          is_payer?: boolean;
          is_primary?: boolean;
          relation?: string | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_guardians_guardian_id_fkey";
            columns: ["guardian_id"];
            isOneToOne: false;
            referencedRelation: "guardians";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "student_guardians_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      student_import_batches: {
        Row: {
          confirmed_at: string | null;
          created_at: string;
          created_by: string;
          id: string;
          payload: NonNullable<Json>;
          row_count: number;
          source_name: string;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by: string;
          id?: string;
          payload: NonNullable<Json>;
          row_count: number;
          source_name: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          confirmed_at?: string | null;
          created_at?: string;
          created_by?: string;
          id?: string;
          payload?: NonNullable<Json>;
          row_count?: number;
          source_name?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_import_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      student_private_notes: {
        Row: {
          created_at: string;
          health_notes: string | null;
          share_with_teacher: boolean;
          special_notes: string | null;
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          health_notes?: string | null;
          share_with_teacher?: boolean;
          special_notes?: string | null;
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          health_notes?: string | null;
          share_with_teacher?: boolean;
          special_notes?: string | null;
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "student_private_notes_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      students: {
        Row: {
          birth_date: string | null;
          country_code: string | null;
          created_at: string;
          full_name: string;
          gender: Database["public"]["Enums"]["gender_t"];
          id: string;
          joined_at: string;
          level_id: string | null;
          profile_id: string | null;
          status: Database["public"]["Enums"]["student_status"];
          student_no: string;
          timezone: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          birth_date?: string | null;
          country_code?: string | null;
          created_at?: string;
          full_name: string;
          gender: Database["public"]["Enums"]["gender_t"];
          id?: string;
          joined_at?: string;
          level_id?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["student_status"];
          student_no?: string;
          timezone?: string;
          updated_at?: string;
        };
        Update: {
          birth_date?: string | null;
          country_code?: string | null;
          created_at?: string;
          full_name?: string;
          gender?: Database["public"]["Enums"]["gender_t"];
          id?: string;
          joined_at?: string;
          level_id?: string | null;
          profile_id?: string | null;
          status?: Database["public"]["Enums"]["student_status"];
          student_no?: string;
          timezone?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "students_level_id_fkey";
            columns: ["level_id"];
            isOneToOne: false;
            referencedRelation: "levels";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "students_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      subscriptions: {
        Row: {
          created_at: string;
          current_period_end: string;
          current_period_start: string;
          id: string;
          paused_until: string | null;
          policy_snapshot: NonNullable<Json>;
          sessions_per_period: number;
          start_date: string;
          status: Database["public"]["Enums"]["subscription_status"];
          student_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          current_period_end: string;
          current_period_start: string;
          id?: string;
          paused_until?: string | null;
          policy_snapshot?: NonNullable<Json>;
          sessions_per_period: number;
          start_date: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          student_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          current_period_end?: string;
          current_period_start?: string;
          id?: string;
          paused_until?: string | null;
          policy_snapshot?: NonNullable<Json>;
          sessions_per_period?: number;
          start_date?: string;
          status?: Database["public"]["Enums"]["subscription_status"];
          student_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "subscriptions_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_assignments: {
        Row: {
          assigned_by: string;
          created_at: string;
          end_date: string | null;
          id: string;
          reason: string;
          start_date: string;
          status: Database["public"]["Enums"]["assignment_status"];
          student_id: string;
          teacher_id: string;
          track_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          assigned_by: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          reason: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["assignment_status"];
          student_id: string;
          teacher_id: string;
          track_id: string;
          updated_at?: string;
        };
        Update: {
          assigned_by?: string;
          created_at?: string;
          end_date?: string | null;
          id?: string;
          reason?: string;
          start_date?: string;
          status?: Database["public"]["Enums"]["assignment_status"];
          student_id?: string;
          teacher_id?: string;
          track_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_assignments_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_availability: {
        Row: {
          created_at: string;
          end_time: string;
          id: string;
          start_time: string;
          status: string;
          teacher_id: string;
          updated_at: string;
          weekday: number;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          end_time: string;
          id?: string;
          start_time: string;
          status?: string;
          teacher_id: string;
          updated_at?: string;
          weekday: number;
        };
        Update: {
          created_at?: string;
          end_time?: string;
          id?: string;
          start_time?: string;
          status?: string;
          teacher_id?: string;
          updated_at?: string;
          weekday?: number;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_availability_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_payout_items: {
        Row: {
          amount: number;
          created_at: string;
          currency: string;
          id: string;
          kind: string;
          rate_snapshot: number;
          session_id: string;
          teacher_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          amount: number;
          created_at?: string;
          currency: string;
          id?: string;
          kind: string;
          rate_snapshot: number;
          session_id: string;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          currency?: string;
          id?: string;
          kind?: string;
          rate_snapshot?: number;
          session_id?: string;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_payout_items_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: true;
            referencedRelation: "sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_payout_items_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          currency: string;
          duration_min: number | null;
          id: string;
          rate_per_session: number;
          teacher_id: string;
          track_id: string | null;
          updated_at: string;
          valid_from: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          created_by?: string | null;
          currency: string;
          duration_min?: number | null;
          id?: string;
          rate_per_session: number;
          teacher_id: string;
          track_id?: string | null;
          updated_at?: string;
          valid_from: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          duration_min?: number | null;
          id?: string;
          rate_per_session?: number;
          teacher_id?: string;
          track_id?: string | null;
          updated_at?: string;
          valid_from?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_rates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_rates_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_rates_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_tracks: {
        Row: {
          created_at: string;
          teacher_id: string;
          track_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          teacher_id: string;
          track_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          teacher_id?: string;
          track_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_tracks_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: false;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "teacher_tracks_track_id_fkey";
            columns: ["track_id"];
            isOneToOne: false;
            referencedRelation: "tracks";
            referencedColumns: ["id"];
          },
        ];
      };
      teacher_zoom_settings: {
        Row: {
          created_at: string;
          join_url: string;
          meeting_id: string | null;
          passcode: string | null;
          teacher_id: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          created_at?: string;
          join_url: string;
          meeting_id?: string | null;
          passcode?: string | null;
          teacher_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          join_url?: string;
          meeting_id?: string | null;
          passcode?: string | null;
          teacher_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teacher_zoom_settings_teacher_id_fkey";
            columns: ["teacher_id"];
            isOneToOne: true;
            referencedRelation: "teachers";
            referencedColumns: ["id"];
          },
        ];
      };
      teachers: {
        Row: {
          code_of_conduct_accepted_at: string | null;
          created_at: string;
          gender: Database["public"]["Enums"]["gender_t"];
          id: string;
          identity_verified_at: string | null;
          ijazah_info: NonNullable<Json>;
          max_students: number;
          profile_id: string;
          specialization: string | null;
          status: string;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code_of_conduct_accepted_at?: string | null;
          created_at?: string;
          gender: Database["public"]["Enums"]["gender_t"];
          id?: string;
          identity_verified_at?: string | null;
          ijazah_info?: NonNullable<Json>;
          max_students?: number;
          profile_id: string;
          specialization?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          code_of_conduct_accepted_at?: string | null;
          created_at?: string;
          gender?: Database["public"]["Enums"]["gender_t"];
          id?: string;
          identity_verified_at?: string | null;
          ijazah_info?: NonNullable<Json>;
          max_students?: number;
          profile_id?: string;
          specialization?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teachers_profile_id_fkey";
            columns: ["profile_id"];
            isOneToOne: true;
            referencedRelation: "profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      tracks: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          is_active: boolean;
          name_ar: string;
          name_en: string | null;
          sort_order: number;
          updated_at: string;
        };
        ComputedFields: never;
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar: string;
          name_en?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          name_ar?: string;
          name_en?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      subscription_balance: {
        Row: {
          sessions_remaining: number | null;
          subscription_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "session_credit_ledger_subscription_id_fkey";
            columns: ["subscription_id"];
            isOneToOne: false;
            referencedRelation: "subscriptions";
            referencedColumns: ["id"];
          },
        ];
      };
      v_juz_progress: {
        Row: {
          avg_score: number | null;
          in_progress_pages: number | null;
          juz: number | null;
          last_reviewed_at: string | null;
          mastered_pages: number | null;
          needs_review_pages: number | null;
          student_id: string | null;
          tracked_pages: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "memorization_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      v_memorization_plan_adherence: {
        Row: {
          ends_on: string | null;
          local_today: string | null;
          month_starts_on: string | null;
          monthly_achieved_pages: number | null;
          monthly_adherence_percent: number | null;
          monthly_target_pages: number | null;
          plan_id: string | null;
          starts_on: string | null;
          student_id: string | null;
          updated_at: string | null;
          week_starts_on: string | null;
          weekly_achieved_pages: number | null;
          weekly_adherence_percent: number | null;
          weekly_target_pages: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "memorization_plans_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: true;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      v_review_queue: {
        Row: {
          days_overdue: number | null;
          interval_days: number | null;
          is_overdue: boolean | null;
          next_review_due: string | null;
          page: number | null;
          queue_position: number | null;
          review_stage: number | null;
          status: Database["public"]["Enums"]["progress_status"] | null;
          student_id: string | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "memorization_progress_page_fkey";
            columns: ["page"];
            isOneToOne: false;
            referencedRelation: "quran_pages";
            referencedColumns: ["page"];
          },
          {
            foreignKeyName: "memorization_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
        ];
      };
      v_surah_progress: {
        Row: {
          avg_score: number | null;
          in_progress_pages: number | null;
          last_reviewed_at: string | null;
          mastered_pages: number | null;
          needs_review_pages: number | null;
          student_id: string | null;
          surah_id: number | null;
          tracked_pages: number | null;
        };
        ComputedFields: never;
        Relationships: [
          {
            foreignKeyName: "memorization_progress_student_id_fkey";
            columns: ["student_id"];
            isOneToOne: false;
            referencedRelation: "students";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quran_ayahs_surah_id_fkey";
            columns: ["surah_id"];
            isOneToOne: false;
            referencedRelation: "quran_surahs";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_teacher_code_of_conduct: { Args: Record<PropertyKey, never>; Returns: string };
      archive_student: { Args: { p_student_id: string }; Returns: undefined };
      assign_session_substitute: {
        Args: { p_scope: string; p_session_id: string; p_substitute_teacher_id: string };
        Returns: number;
      };
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      clone_package: { Args: { p_package: string }; Returns: string };
      confirm_package_import: { Args: { p_batch_id: string }; Returns: number };
      confirm_student_import: { Args: { p_batch_id: string }; Returns: number };
      convert_application_to_student: { Args: { p_application: string }; Returns: string };
      create_makeup_session: {
        Args: { p_entitlement_id: string; p_scheduled_at: string; p_teacher_id?: string };
        Returns: string;
      };
      generate_sessions: {
        Args: { p_horizon_days?: number; p_window_start?: string };
        Returns: number;
      };
      get_attendance_report: {
        Args: { p_anchor?: string; p_period: string };
        Returns: {
          absent_count: number;
          adherence_percent: number;
          attended_count: number;
          entity_id: string;
          entity_name: string;
          entity_type: string;
          scheduled_count: number;
        }[];
      };
      get_calendar_feed: {
        Args: { p_token_hash: string };
        Returns: {
          ends_at: string;
          owner_locale: string;
          owner_name: string;
          owner_timezone: string;
          scheduled_at: string;
          session_id: string;
          status: string;
          student_name: string;
          teacher_name: string;
          track_name_ar: string;
          track_name_en: string;
        }[];
      };
      get_my_calendar_feed: {
        Args: Record<PropertyKey, never>;
        Returns: {
          ends_at: string;
          owner_locale: string;
          owner_name: string;
          owner_timezone: string;
          scheduled_at: string;
          session_id: string;
          status: string;
          student_name: string;
          teacher_name: string;
          track_name_ar: string;
          track_name_en: string;
        }[];
      };
      get_session_join: {
        Args: { p_session_id: string };
        Returns: {
          ends_at: string;
          join_url: string;
          meeting_id: string;
          passcode: string;
          scheduled_at: string;
          session_id: string;
        }[];
      };
      get_shared_student_notes: {
        Args: { p_student: string };
        Returns: {
          health_notes: string;
          special_notes: string;
          student_id: string;
        }[];
      };
      get_student_private_notes: {
        Args: { p_student: string };
        Returns: {
          health_notes: string;
          share_with_teacher: boolean;
          special_notes: string;
          student_id: string;
        }[];
      };
      get_visible_schedule: {
        Args: Record<PropertyKey, never>;
        Returns: {
          anchor_timezone: string;
          assignment_id: string;
          duration_min: number;
          is_active: boolean;
          local_start_time: string;
          slot_id: string;
          student_name: string;
          teacher_name: string;
          track_name_ar: string;
          track_name_en: string;
          weekday: number;
        }[];
      };
      is_admin: { Args: Record<PropertyKey, never>; Returns: boolean };
      manage_teacher_assignment: {
        Args: {
          p_action?: string;
          p_reason: string;
          p_student: string;
          p_teacher: string;
          p_track: string;
        };
        Returns: string;
      };
      record_attendance: {
        Args: {
          p_minutes?: number;
          p_session_id: string;
          p_status: Database["public"]["Enums"]["attendance_status"];
          p_student_joined_at?: string;
          p_student_notice_at?: string;
          p_teacher_joined_at?: string;
        };
        Returns: {
          locked_at: string | null;
          minutes: number | null;
          recorded_at: string;
          recorded_by: string;
          session_id: string;
          status: Database["public"]["Enums"]["attendance_status"];
          student_joined_at: string | null;
          student_notice_at: string | null;
          teacher_joined_at: string | null;
          updated_at: string;
        };
        SetofOptions: {
          from: "*";
          to: "attendance";
          isOneToOne: true;
          isSetofReturn: false;
        };
      };
      record_student_export: { Args: { p_count: number }; Returns: undefined };
      remove_student_guardian: {
        Args: { p_guardian_id: string; p_student_id: string };
        Returns: undefined;
      };
      reorder_packages: { Args: { p_package_ids: string[] }; Returns: undefined };
      reschedule_session: {
        Args: { p_scheduled_at: string; p_session_id: string };
        Returns: string;
      };
      resolve_price: {
        Args: { p_at?: string; p_country: string; p_package: string };
        Returns: {
          amount: number;
          country_code: string;
          currency: string;
        }[];
      };
      revoke_calendar_feed_token: { Args: Record<PropertyKey, never>; Returns: string };
      rotate_calendar_feed_token: { Args: { p_token_hash: string }; Returns: string };
      save_package: { Args: { p_payload: Json }; Returns: string };
      set_account_active: {
        Args: { p_is_active: boolean; p_profile_id: string };
        Returns: undefined;
      };
      submit_application: {
        Args: { p_contact_hash: string; p_ip_hash: string; p_lookup_hash: string; p_payload: Json };
        Returns: string;
      };
      suggest_teachers: {
        Args: { p_student: string; p_track: string };
        Returns: {
          approved_slots: number;
          current_load: number;
          max_students: number;
          near_capacity: boolean;
          remaining_capacity: number;
          teacher_id: string;
          teacher_name: string;
          timezone: string;
        }[];
      };
      update_evaluation_settings: {
        Args: {
          p_d_forgot: number;
          p_d_major: number;
          p_d_minor: number;
          p_d_prompt: number;
          p_rating_thresholds: Json;
          p_session_type: Database["public"]["Enums"]["session_type_t"];
          p_weights: Json;
        };
        Returns: undefined;
      };
      update_public_app_settings: {
        Args: { p_academy_profile: Json; p_support_hours: Json };
        Returns: undefined;
      };
      upsert_student: { Args: { p_payload: Json }; Returns: string };
      upsert_student_guardian: {
        Args: {
          p_is_payer: boolean;
          p_is_primary: boolean;
          p_parent_profile_id: string;
          p_relation: string;
          p_student_id: string;
        };
        Returns: string;
      };
      upsert_teacher: { Args: { p_payload: Json }; Returns: string };
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
      credit_reason: "grant" | "consume" | "refund" | "adjust" | "expire" | "proration";
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
      credit_reason: ["grant", "consume", "refund", "adjust", "expire", "proration"],
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
