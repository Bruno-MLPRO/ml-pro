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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      apps_extensions: {
        Row: {
          color: string | null
          coupon: string | null
          created_at: string | null
          description: string | null
          id: string
          name: string
          price: number | null
          updated_at: string | null
          url: string | null
        }
        Insert: {
          color?: string | null
          coupon?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          price?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Update: {
          color?: string | null
          coupon?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          price?: number | null
          updated_at?: string | null
          url?: string | null
        }
        Relationships: []
      }
      bonus: {
        Row: {
          cost: number
          created_at: string | null
          description: string | null
          id: string
          name: string
          updated_at: string | null
        }
        Insert: {
          cost: number
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string | null
        }
        Update: {
          cost?: number
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      call_schedules: {
        Row: {
          created_at: string | null
          date: string
          description: string | null
          id: string
          theme: string
        }
        Insert: {
          created_at?: string | null
          date: string
          description?: string | null
          id?: string
          theme: string
        }
        Update: {
          created_at?: string | null
          date?: string
          description?: string | null
          id?: string
          theme?: string
        }
        Relationships: []
      }
      important_links: {
        Row: {
          category: string | null
          created_at: string | null
          description: string | null
          id: string
          order_index: number | null
          title: string
          url: string
        }
        Insert: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number | null
          title: string
          url: string
        }
        Update: {
          category?: string | null
          created_at?: string | null
          description?: string | null
          id?: string
          order_index?: number | null
          title?: string
          url?: string
        }
        Relationships: []
      }
      journey_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          is_default: boolean | null
          name: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      mercado_livre_accounts: {
        Row: {
          access_token: string
          connected_at: string | null
          created_at: string | null
          id: string
          is_active: boolean | null
          is_primary: boolean | null
          last_sync_at: string | null
          ml_nickname: string
          ml_user_id: string
          refresh_token: string
          student_id: string
          token_expires_at: string
          updated_at: string | null
        }
        Insert: {
          access_token: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          ml_nickname: string
          ml_user_id: string
          refresh_token: string
          student_id: string
          token_expires_at: string
          updated_at?: string | null
        }
        Update: {
          access_token?: string
          connected_at?: string | null
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          is_primary?: boolean | null
          last_sync_at?: string | null
          ml_nickname?: string
          ml_user_id?: string
          refresh_token?: string
          student_id?: string
          token_expires_at?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_accounts_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_full_stock: {
        Row: {
          available_units: number | null
          created_at: string | null
          damaged_units: number | null
          id: string
          inbound_units: number | null
          inventory_id: string
          lost_units: number | null
          ml_account_id: string
          ml_item_id: string
          reserved_units: number | null
          stock_status: string | null
          student_id: string
          synced_at: string | null
          updated_at: string | null
        }
        Insert: {
          available_units?: number | null
          created_at?: string | null
          damaged_units?: number | null
          id?: string
          inbound_units?: number | null
          inventory_id: string
          lost_units?: number | null
          ml_account_id: string
          ml_item_id: string
          reserved_units?: number | null
          stock_status?: string | null
          student_id: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Update: {
          available_units?: number | null
          created_at?: string | null
          damaged_units?: number | null
          id?: string
          inbound_units?: number | null
          inventory_id?: string
          lost_units?: number | null
          ml_account_id?: string
          ml_item_id?: string
          reserved_units?: number | null
          stock_status?: string | null
          student_id?: string
          synced_at?: string | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_full_stock_ml_account_id_fkey"
            columns: ["ml_account_id"]
            isOneToOne: false
            referencedRelation: "mercado_livre_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_metrics: {
        Row: {
          active_listings: number | null
          average_ticket: number | null
          cancellations_rate: number | null
          cancellations_value: number | null
          claims_rate: number | null
          claims_value: number | null
          created_at: string | null
          delayed_handling_rate: number | null
          delayed_handling_value: number | null
          has_decola: boolean | null
          has_full: boolean | null
          id: string
          is_mercado_lider: boolean | null
          last_updated: string | null
          mercado_lider_level: string | null
          ml_account_id: string
          negative_ratings_rate: number | null
          neutral_ratings_rate: number | null
          paused_listings: number | null
          period_end: string | null
          period_start: string | null
          positive_ratings_rate: number | null
          reputation_color: string | null
          reputation_level: string | null
          reputation_score: number | null
          reputation_transactions_total: number | null
          student_id: string
          total_listings: number | null
          total_revenue: number | null
          total_sales: number | null
          updated_at: string | null
        }
        Insert: {
          active_listings?: number | null
          average_ticket?: number | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_rate?: number | null
          claims_value?: number | null
          created_at?: string | null
          delayed_handling_rate?: number | null
          delayed_handling_value?: number | null
          has_decola?: boolean | null
          has_full?: boolean | null
          id?: string
          is_mercado_lider?: boolean | null
          last_updated?: string | null
          mercado_lider_level?: string | null
          ml_account_id: string
          negative_ratings_rate?: number | null
          neutral_ratings_rate?: number | null
          paused_listings?: number | null
          period_end?: string | null
          period_start?: string | null
          positive_ratings_rate?: number | null
          reputation_color?: string | null
          reputation_level?: string | null
          reputation_score?: number | null
          reputation_transactions_total?: number | null
          student_id: string
          total_listings?: number | null
          total_revenue?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Update: {
          active_listings?: number | null
          average_ticket?: number | null
          cancellations_rate?: number | null
          cancellations_value?: number | null
          claims_rate?: number | null
          claims_value?: number | null
          created_at?: string | null
          delayed_handling_rate?: number | null
          delayed_handling_value?: number | null
          has_decola?: boolean | null
          has_full?: boolean | null
          id?: string
          is_mercado_lider?: boolean | null
          last_updated?: string | null
          mercado_lider_level?: string | null
          ml_account_id?: string
          negative_ratings_rate?: number | null
          neutral_ratings_rate?: number | null
          paused_listings?: number | null
          period_end?: string | null
          period_start?: string | null
          positive_ratings_rate?: number | null
          reputation_color?: string | null
          reputation_level?: string | null
          reputation_score?: number | null
          reputation_transactions_total?: number | null
          student_id?: string
          total_listings?: number | null
          total_revenue?: number | null
          total_sales?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_metrics_ml_account_id_fkey"
            columns: ["ml_account_id"]
            isOneToOne: true
            referencedRelation: "mercado_livre_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_livre_metrics_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_orders: {
        Row: {
          buyer_nickname: string | null
          created_at: string | null
          date_closed: string | null
          date_created: string | null
          id: string
          ml_account_id: string
          ml_order_id: string
          paid_amount: number | null
          shipping_mode: string | null
          status: string | null
          student_id: string
          total_amount: number | null
          updated_at: string | null
        }
        Insert: {
          buyer_nickname?: string | null
          created_at?: string | null
          date_closed?: string | null
          date_created?: string | null
          id?: string
          ml_account_id: string
          ml_order_id: string
          paid_amount?: number | null
          shipping_mode?: string | null
          status?: string | null
          student_id: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Update: {
          buyer_nickname?: string | null
          created_at?: string | null
          date_closed?: string | null
          date_created?: string | null
          id?: string
          ml_account_id?: string
          ml_order_id?: string
          paid_amount?: number | null
          shipping_mode?: string | null
          status?: string | null
          student_id?: string
          total_amount?: number | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_orders_ml_account_id_fkey"
            columns: ["ml_account_id"]
            isOneToOne: false
            referencedRelation: "mercado_livre_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_livre_orders_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_products: {
        Row: {
          available_quantity: number | null
          created_at: string | null
          has_low_quality_photos: boolean | null
          id: string
          listing_type: string | null
          min_photo_dimension: number | null
          ml_account_id: string
          ml_item_id: string
          permalink: string | null
          photo_count: number | null
          price: number | null
          shipping_mode: string | null
          sold_quantity: number | null
          status: string | null
          student_id: string
          synced_at: string | null
          thumbnail: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          available_quantity?: number | null
          created_at?: string | null
          has_low_quality_photos?: boolean | null
          id?: string
          listing_type?: string | null
          min_photo_dimension?: number | null
          ml_account_id: string
          ml_item_id: string
          permalink?: string | null
          photo_count?: number | null
          price?: number | null
          shipping_mode?: string | null
          sold_quantity?: number | null
          status?: string | null
          student_id: string
          synced_at?: string | null
          thumbnail?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          available_quantity?: number | null
          created_at?: string | null
          has_low_quality_photos?: boolean | null
          id?: string
          listing_type?: string | null
          min_photo_dimension?: number | null
          ml_account_id?: string
          ml_item_id?: string
          permalink?: string | null
          photo_count?: number | null
          price?: number | null
          shipping_mode?: string | null
          sold_quantity?: number | null
          status?: string | null
          student_id?: string
          synced_at?: string | null
          thumbnail?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_products_ml_account_id_fkey"
            columns: ["ml_account_id"]
            isOneToOne: false
            referencedRelation: "mercado_livre_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mercado_livre_products_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_webhook_logs: {
        Row: {
          application_id: string | null
          created_at: string | null
          error: string | null
          id: string
          payload: Json | null
          processed: boolean | null
          processed_at: string | null
          resource: string | null
          topic: string | null
          user_id: string | null
          webhook_id: string | null
        }
        Insert: {
          application_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          resource?: string | null
          topic?: string | null
          user_id?: string | null
          webhook_id?: string | null
        }
        Update: {
          application_id?: string | null
          created_at?: string | null
          error?: string | null
          id?: string
          payload?: Json | null
          processed?: boolean | null
          processed_at?: string | null
          resource?: string | null
          topic?: string | null
          user_id?: string | null
          webhook_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_webhook_logs_webhook_id_fkey"
            columns: ["webhook_id"]
            isOneToOne: false
            referencedRelation: "mercado_livre_webhooks"
            referencedColumns: ["id"]
          },
        ]
      }
      mercado_livre_webhooks: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          ml_account_id: string
          topic: string
          webhook_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ml_account_id: string
          topic: string
          webhook_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          ml_account_id?: string
          topic?: string
          webhook_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mercado_livre_webhooks_ml_account_id_fkey"
            columns: ["ml_account_id"]
            isOneToOne: false
            referencedRelation: "mercado_livre_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      milestone_templates: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          journey_template_id: string
          order_index: number
          phase: string
          title: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          journey_template_id: string
          order_index: number
          phase: string
          title: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          journey_template_id?: string
          order_index?: number
          phase?: string
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestone_templates_journey_template_id_fkey"
            columns: ["journey_template_id"]
            isOneToOne: false
            referencedRelation: "journey_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      milestones: {
        Row: {
          completed_at: string | null
          created_at: string | null
          description: string | null
          due_date: string | null
          id: string
          journey_id: string
          notes: string | null
          order_index: number
          phase: string
          progress: number | null
          status: Database["public"]["Enums"]["milestone_status"] | null
          template_id: string | null
          title: string
          updated_at: string | null
        }
        Insert: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          journey_id: string
          notes?: string | null
          order_index: number
          phase: string
          progress?: number | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          template_id?: string | null
          title: string
          updated_at?: string | null
        }
        Update: {
          completed_at?: string | null
          created_at?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          journey_id?: string
          notes?: string | null
          order_index?: number
          phase?: string
          progress?: number | null
          status?: Database["public"]["Enums"]["milestone_status"] | null
          template_id?: string | null
          title?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "milestones_journey_id_fkey"
            columns: ["journey_id"]
            isOneToOne: false
            referencedRelation: "student_journeys"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "milestones_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "milestone_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      notices: {
        Row: {
          content: string
          created_at: string | null
          expires_at: string | null
          id: string
          is_active: boolean | null
          is_important: boolean | null
          priority: string | null
          title: string
        }
        Insert: {
          content: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_important?: boolean | null
          priority?: string | null
          title: string
        }
        Update: {
          content?: string
          created_at?: string | null
          expires_at?: string | null
          id?: string
          is_active?: boolean | null
          is_important?: boolean | null
          priority?: string | null
          title?: string
        }
        Relationships: []
      }
      plan_bonus: {
        Row: {
          bonus_id: string
          created_at: string | null
          id: string
          plan_id: string
        }
        Insert: {
          bonus_id: string
          created_at?: string | null
          id?: string
          plan_id: string
        }
        Update: {
          bonus_id?: string
          created_at?: string | null
          id?: string
          plan_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_bonus_bonus_id_fkey"
            columns: ["bonus_id"]
            isOneToOne: false
            referencedRelation: "bonus"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "plan_bonus_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["id"]
          },
        ]
      }
      plans: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          name: string
          price: number
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number
          updated_at?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          caixa: number | null
          cep: string | null
          cidade: string | null
          cnpj: string | null
          cpf: string | null
          created_at: string | null
          email: string
          endereco: string | null
          estado: string | null
          estrutura_vendedor: string | null
          full_name: string
          hub_logistico: string | null
          id: string
          mentoria_status: string | null
          phone: string | null
          possui_contador: boolean | null
          sistemas_externos: string | null
          tipo_pj: string | null
          turma: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          caixa?: number | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          email: string
          endereco?: string | null
          estado?: string | null
          estrutura_vendedor?: string | null
          full_name: string
          hub_logistico?: string | null
          id: string
          mentoria_status?: string | null
          phone?: string | null
          possui_contador?: boolean | null
          sistemas_externos?: string | null
          tipo_pj?: string | null
          turma?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          caixa?: number | null
          cep?: string | null
          cidade?: string | null
          cnpj?: string | null
          cpf?: string | null
          created_at?: string | null
          email?: string
          endereco?: string | null
          estado?: string | null
          estrutura_vendedor?: string | null
          full_name?: string
          hub_logistico?: string | null
          id?: string
          mentoria_status?: string | null
          phone?: string | null
          possui_contador?: boolean | null
          sistemas_externos?: string | null
          tipo_pj?: string | null
          turma?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      student_apps: {
        Row: {
          app_id: string
          created_at: string | null
          id: string
          student_id: string
        }
        Insert: {
          app_id: string
          created_at?: string | null
          id?: string
          student_id: string
        }
        Update: {
          app_id?: string
          created_at?: string | null
          id?: string
          student_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "student_apps_app_id_fkey"
            columns: ["app_id"]
            isOneToOne: false
            referencedRelation: "apps_extensions"
            referencedColumns: ["id"]
          },
        ]
      }
      student_journeys: {
        Row: {
          created_at: string | null
          current_phase: string | null
          enrollment_date: string | null
          id: string
          last_activity: string | null
          manager_id: string | null
          overall_progress: number | null
          student_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          current_phase?: string | null
          enrollment_date?: string | null
          id?: string
          last_activity?: string | null
          manager_id?: string | null
          overall_progress?: number | null
          student_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          current_phase?: string | null
          enrollment_date?: string | null
          id?: string
          last_activity?: string | null
          manager_id?: string | null
          overall_progress?: number | null
          student_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "student_journeys_manager_id_fkey"
            columns: ["manager_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "student_journeys_student_id_fkey"
            columns: ["student_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      initialize_student_milestones_from_templates: {
        Args: Record<PropertyKey, never>
        Returns: undefined
      }
    }
    Enums: {
      app_role: "student" | "manager"
      milestone_status: "not_started" | "in_progress" | "completed" | "blocked"
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
      app_role: ["student", "manager"],
      milestone_status: ["not_started", "in_progress", "completed", "blocked"],
    },
  },
} as const
