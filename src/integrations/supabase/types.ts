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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          factory_id: string | null
          id: string
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string | null
          factory_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string | null
          factory_id?: string | null
          id?: string
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      blocker_impact_options: {
        Row: {
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      blocker_owner_options: {
        Row: {
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      blocker_types: {
        Row: {
          code: string
          created_at: string | null
          default_impact: Database["public"]["Enums"]["blocker_impact"] | null
          default_owner: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          name: string
        }
        Insert: {
          code: string
          created_at?: string | null
          default_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          default_owner?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          name: string
        }
        Update: {
          code?: string
          created_at?: string | null
          default_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          default_owner?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "blocker_types_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      daily_insights: {
        Row: {
          created_at: string | null
          factory_id: string
          id: string
          insight_date: string
          insights_data: Json
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          id?: string
          insight_date?: string
          insights_data?: Json
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          id?: string
          insight_date?: string
          insights_data?: Json
        }
        Relationships: [
          {
            foreignKeyName: "daily_insights_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      email_schedules: {
        Row: {
          created_at: string | null
          day_of_week: number | null
          email: string
          factory_id: string
          id: string
          is_active: boolean | null
          last_sent_at: string | null
          schedule_type: string
          send_time: string | null
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          day_of_week?: number | null
          email: string
          factory_id: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          schedule_type: string
          send_time?: string | null
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          day_of_week?: number | null
          email?: string
          factory_id?: string
          id?: string
          is_active?: boolean | null
          last_sent_at?: string | null
          schedule_type?: string
          send_time?: string | null
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "email_schedules_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      factory_accounts: {
        Row: {
          created_at: string | null
          cutoff_time: string | null
          id: string
          is_active: boolean | null
          logo_url: string | null
          max_lines: number | null
          name: string
          slug: string
          subscription_tier:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          cutoff_time?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_lines?: number | null
          name: string
          slug: string
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          cutoff_time?: string | null
          id?: string
          is_active?: boolean | null
          logo_url?: string | null
          max_lines?: number | null
          name?: string
          slug?: string
          subscription_tier?:
            | Database["public"]["Enums"]["subscription_tier"]
            | null
          timezone?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      floors: {
        Row: {
          code: string
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          name: string
          unit_id: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          name: string
          unit_id: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          unit_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "floors_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "floors_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      lines: {
        Row: {
          created_at: string | null
          factory_id: string
          floor_id: string | null
          id: string
          is_active: boolean | null
          line_id: string
          name: string | null
          target_efficiency: number | null
          target_per_day: number | null
          target_per_hour: number | null
          unit_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          floor_id?: string | null
          id?: string
          is_active?: boolean | null
          line_id: string
          name?: string | null
          target_efficiency?: number | null
          target_per_day?: number | null
          target_per_hour?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          floor_id?: string | null
          id?: string
          is_active?: boolean | null
          line_id?: string
          name?: string | null
          target_efficiency?: number | null
          target_per_day?: number | null
          target_per_hour?: number | null
          unit_id?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lines_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_floor_id_fkey"
            columns: ["floor_id"]
            isOneToOne: false
            referencedRelation: "floors"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lines_unit_id_fkey"
            columns: ["unit_id"]
            isOneToOne: false
            referencedRelation: "units"
            referencedColumns: ["id"]
          },
        ]
      }
      next_milestone_options: {
        Row: {
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          created_at: string | null
          email_enabled: boolean | null
          factory_id: string
          id: string
          in_app_enabled: boolean | null
          notification_type: string
          updated_at: string | null
          user_id: string
        }
        Insert: {
          created_at?: string | null
          email_enabled?: boolean | null
          factory_id: string
          id?: string
          in_app_enabled?: boolean | null
          notification_type: string
          updated_at?: string | null
          user_id: string
        }
        Update: {
          created_at?: string | null
          email_enabled?: boolean | null
          factory_id?: string
          id?: string
          in_app_enabled?: boolean | null
          notification_type?: string
          updated_at?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          created_at: string | null
          data: Json | null
          factory_id: string
          id: string
          is_read: boolean | null
          message: string | null
          title: string
          type: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          data?: Json | null
          factory_id: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          title: string
          type: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          data?: Json | null
          factory_id?: string
          id?: string
          is_read?: boolean | null
          message?: string | null
          title?: string
          type?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notifications_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      production_updates_finishing: {
        Row: {
          average_production: number | null
          blocker_description: string | null
          blocker_impact: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner: string | null
          blocker_status: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id: string | null
          buyer_name: string | null
          created_at: string | null
          day_carton: number | null
          day_hour: number | null
          day_over_time: number | null
          day_poly: number | null
          day_qc_pass: number | null
          factory_id: string
          factory_name: string | null
          floor_name: string | null
          has_blocker: boolean | null
          id: string
          item_name: string | null
          line_id: string
          m_power: number | null
          manpower: number | null
          notes: string | null
          order_quantity: number | null
          ot_hours: number | null
          ot_manpower: number | null
          packed_qty: number | null
          per_hour_target: number | null
          photo_urls: string[] | null
          production_date: string
          qc_fail_qty: number | null
          qc_pass_qty: number
          remarks: string | null
          shift: string | null
          shipped_qty: number | null
          stage_id: string | null
          stage_progress: number | null
          style_no: string | null
          submitted_at: string | null
          submitted_by: string | null
          total_carton: number | null
          total_hour: number | null
          total_over_time: number | null
          total_poly: number | null
          total_qc_pass: number | null
          unit_name: string | null
          work_order_id: string | null
        }
        Insert: {
          average_production?: number | null
          blocker_description?: string | null
          blocker_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner?: string | null
          blocker_status?: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id?: string | null
          buyer_name?: string | null
          created_at?: string | null
          day_carton?: number | null
          day_hour?: number | null
          day_over_time?: number | null
          day_poly?: number | null
          day_qc_pass?: number | null
          factory_id: string
          factory_name?: string | null
          floor_name?: string | null
          has_blocker?: boolean | null
          id?: string
          item_name?: string | null
          line_id: string
          m_power?: number | null
          manpower?: number | null
          notes?: string | null
          order_quantity?: number | null
          ot_hours?: number | null
          ot_manpower?: number | null
          packed_qty?: number | null
          per_hour_target?: number | null
          photo_urls?: string[] | null
          production_date?: string
          qc_fail_qty?: number | null
          qc_pass_qty?: number
          remarks?: string | null
          shift?: string | null
          shipped_qty?: number | null
          stage_id?: string | null
          stage_progress?: number | null
          style_no?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_carton?: number | null
          total_hour?: number | null
          total_over_time?: number | null
          total_poly?: number | null
          total_qc_pass?: number | null
          unit_name?: string | null
          work_order_id?: string | null
        }
        Update: {
          average_production?: number | null
          blocker_description?: string | null
          blocker_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner?: string | null
          blocker_status?: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id?: string | null
          buyer_name?: string | null
          created_at?: string | null
          day_carton?: number | null
          day_hour?: number | null
          day_over_time?: number | null
          day_poly?: number | null
          day_qc_pass?: number | null
          factory_id?: string
          factory_name?: string | null
          floor_name?: string | null
          has_blocker?: boolean | null
          id?: string
          item_name?: string | null
          line_id?: string
          m_power?: number | null
          manpower?: number | null
          notes?: string | null
          order_quantity?: number | null
          ot_hours?: number | null
          ot_manpower?: number | null
          packed_qty?: number | null
          per_hour_target?: number | null
          photo_urls?: string[] | null
          production_date?: string
          qc_fail_qty?: number | null
          qc_pass_qty?: number
          remarks?: string | null
          shift?: string | null
          shipped_qty?: number | null
          stage_id?: string | null
          stage_progress?: number | null
          style_no?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          total_carton?: number | null
          total_hour?: number | null
          total_over_time?: number | null
          total_poly?: number | null
          total_qc_pass?: number | null
          unit_name?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_updates_finishing_blocker_type_id_fkey"
            columns: ["blocker_type_id"]
            isOneToOne: false
            referencedRelation: "blocker_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_finishing_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_finishing_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_finishing_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_finishing_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      production_updates_sewing: {
        Row: {
          action_taken_today: string | null
          blocker_description: string | null
          blocker_impact: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner: string | null
          blocker_resolution_date: string | null
          blocker_status: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id: string | null
          buyer_name: string | null
          color: string | null
          created_at: string | null
          cumulative_good_total: number | null
          estimated_ex_factory: string | null
          factory_id: string
          factory_name: string | null
          floor_name: string | null
          has_blocker: boolean | null
          id: string
          item_name: string | null
          line_id: string
          manpower: number | null
          next_milestone: string | null
          notes: string | null
          order_qty: number | null
          ot_hours: number | null
          ot_manpower: number | null
          output_qty: number
          per_hour_target: number | null
          photo_urls: string[] | null
          po_number: string | null
          production_date: string
          reject_qty: number | null
          rework_qty: number | null
          shift: string | null
          smv: number | null
          stage_id: string | null
          stage_progress: number | null
          style_code: string | null
          submitted_at: string | null
          submitted_by: string | null
          target_qty: number | null
          unit_name: string | null
          work_order_id: string | null
        }
        Insert: {
          action_taken_today?: string | null
          blocker_description?: string | null
          blocker_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner?: string | null
          blocker_resolution_date?: string | null
          blocker_status?: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id?: string | null
          buyer_name?: string | null
          color?: string | null
          created_at?: string | null
          cumulative_good_total?: number | null
          estimated_ex_factory?: string | null
          factory_id: string
          factory_name?: string | null
          floor_name?: string | null
          has_blocker?: boolean | null
          id?: string
          item_name?: string | null
          line_id: string
          manpower?: number | null
          next_milestone?: string | null
          notes?: string | null
          order_qty?: number | null
          ot_hours?: number | null
          ot_manpower?: number | null
          output_qty?: number
          per_hour_target?: number | null
          photo_urls?: string[] | null
          po_number?: string | null
          production_date?: string
          reject_qty?: number | null
          rework_qty?: number | null
          shift?: string | null
          smv?: number | null
          stage_id?: string | null
          stage_progress?: number | null
          style_code?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          target_qty?: number | null
          unit_name?: string | null
          work_order_id?: string | null
        }
        Update: {
          action_taken_today?: string | null
          blocker_description?: string | null
          blocker_impact?: Database["public"]["Enums"]["blocker_impact"] | null
          blocker_owner?: string | null
          blocker_resolution_date?: string | null
          blocker_status?: Database["public"]["Enums"]["blocker_status"] | null
          blocker_type_id?: string | null
          buyer_name?: string | null
          color?: string | null
          created_at?: string | null
          cumulative_good_total?: number | null
          estimated_ex_factory?: string | null
          factory_id?: string
          factory_name?: string | null
          floor_name?: string | null
          has_blocker?: boolean | null
          id?: string
          item_name?: string | null
          line_id?: string
          manpower?: number | null
          next_milestone?: string | null
          notes?: string | null
          order_qty?: number | null
          ot_hours?: number | null
          ot_manpower?: number | null
          output_qty?: number
          per_hour_target?: number | null
          photo_urls?: string[] | null
          po_number?: string | null
          production_date?: string
          reject_qty?: number | null
          rework_qty?: number | null
          shift?: string | null
          smv?: number | null
          stage_id?: string | null
          stage_progress?: number | null
          style_code?: string | null
          submitted_at?: string | null
          submitted_by?: string | null
          target_qty?: number | null
          unit_name?: string | null
          work_order_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "production_updates_sewing_blocker_type_id_fkey"
            columns: ["blocker_type_id"]
            isOneToOne: false
            referencedRelation: "blocker_types"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_sewing_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_sewing_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_sewing_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "stages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "production_updates_sewing_work_order_id_fkey"
            columns: ["work_order_id"]
            isOneToOne: false
            referencedRelation: "work_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          assigned_floor_id: string | null
          assigned_unit_id: string | null
          avatar_url: string | null
          created_at: string | null
          email: string
          factory_id: string | null
          full_name: string
          id: string
          is_active: boolean | null
          phone: string | null
          updated_at: string | null
        }
        Insert: {
          assigned_floor_id?: string | null
          assigned_unit_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email: string
          factory_id?: string | null
          full_name: string
          id: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Update: {
          assigned_floor_id?: string | null
          assigned_unit_id?: string | null
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          factory_id?: string | null
          full_name?: string
          id?: string
          is_active?: boolean | null
          phone?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "profiles_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      stage_progress_options: {
        Row: {
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          label: string
          sort_order: number | null
        }
        Insert: {
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          label: string
          sort_order?: number | null
        }
        Update: {
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          label?: string
          sort_order?: number | null
        }
        Relationships: []
      }
      stages: {
        Row: {
          code: string
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          name: string
          sequence: number | null
        }
        Insert: {
          code: string
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          name: string
          sequence?: number | null
        }
        Update: {
          code?: string
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          sequence?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "stages_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      units: {
        Row: {
          code: string
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          code: string
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          code?: string
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "units_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          factory_id: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          factory_id?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          factory_id?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      work_orders: {
        Row: {
          actual_ex_factory: string | null
          buyer: string
          color: string | null
          created_at: string | null
          factory_id: string
          id: string
          is_active: boolean | null
          item: string | null
          line_id: string | null
          order_qty: number
          planned_ex_factory: string | null
          po_number: string
          smv: number | null
          status: string | null
          style: string
          target_per_day: number | null
          target_per_hour: number | null
          updated_at: string | null
        }
        Insert: {
          actual_ex_factory?: string | null
          buyer: string
          color?: string | null
          created_at?: string | null
          factory_id: string
          id?: string
          is_active?: boolean | null
          item?: string | null
          line_id?: string | null
          order_qty?: number
          planned_ex_factory?: string | null
          po_number: string
          smv?: number | null
          status?: string | null
          style: string
          target_per_day?: number | null
          target_per_hour?: number | null
          updated_at?: string | null
        }
        Update: {
          actual_ex_factory?: string | null
          buyer?: string
          color?: string | null
          created_at?: string | null
          factory_id?: string
          id?: string
          is_active?: boolean | null
          item?: string | null
          line_id?: string | null
          order_qty?: number
          planned_ex_factory?: string | null
          po_number?: string
          smv?: number | null
          status?: string | null
          style?: string
          target_per_day?: number | null
          target_per_hour?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "work_orders_factory_id_fkey"
            columns: ["factory_id"]
            isOneToOne: false
            referencedRelation: "factory_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "work_orders_line_id_fkey"
            columns: ["line_id"]
            isOneToOne: false
            referencedRelation: "lines"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_factory_id: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin_or_higher: { Args: { _user_id: string }; Returns: boolean }
      is_superadmin: { Args: { _user_id: string }; Returns: boolean }
      user_belongs_to_factory: {
        Args: { _factory_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "worker" | "supervisor" | "admin" | "owner" | "superadmin"
      blocker_impact: "low" | "medium" | "high" | "critical"
      blocker_status: "open" | "in_progress" | "resolved"
      subscription_tier: "starter" | "professional" | "enterprise" | "unlimited"
      update_type: "sewing" | "finishing"
      work_order_status: "not_started" | "in_progress" | "completed" | "on_hold"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      app_role: ["worker", "supervisor", "admin", "owner", "superadmin"],
      blocker_impact: ["low", "medium", "high", "critical"],
      blocker_status: ["open", "in_progress", "resolved"],
      subscription_tier: ["starter", "professional", "enterprise", "unlimited"],
      update_type: ["sewing", "finishing"],
      work_order_status: ["not_started", "in_progress", "completed", "on_hold"],
    },
  },
} as const
