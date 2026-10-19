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
    };
    Functions: {
      accept_teacher_code_of_conduct: { Args: Record<PropertyKey, never>; Returns: string };
      archive_student: { Args: { p_student_id: string }; Returns: undefined };
      auth_role: {
        Args: Record<PropertyKey, never>;
        Returns: Database["public"]["Enums"]["user_role"];
      };
      confirm_student_import: { Args: { p_batch_id: string }; Returns: number };
      generate_sessions: {
        Args: { p_horizon_days?: number; p_window_start?: string };
        Returns: number;
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
      record_student_export: { Args: { p_count: number }; Returns: undefined };
      remove_student_guardian: {
        Args: { p_guardian_id: string; p_student_id: string };
        Returns: undefined;
      };
      set_account_active: {
        Args: { p_is_active: boolean; p_profile_id: string };
        Returns: undefined;
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
