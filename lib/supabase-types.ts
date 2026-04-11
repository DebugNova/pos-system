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
      audit_log: {
        Row: {
          action: string
          created_at: string | null
          details: string
          id: string
          metadata: Json | null
          order_id: string | null
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string | null
          details: string
          id: string
          metadata?: Json | null
          order_id?: string | null
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string | null
          details?: string
          id?: string
          metadata?: Json | null
          order_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      menu_items: {
        Row: {
          available: boolean | null
          bestseller: boolean | null
          category: string
          created_at: string | null
          id: string
          image_url: string | null
          name: string
          price: number
          updated_at: string | null
          variants: Json | null
        }
        Insert: {
          available?: boolean | null
          bestseller?: boolean | null
          category: string
          created_at?: string | null
          id: string
          image_url?: string | null
          name: string
          price: number
          updated_at?: string | null
          variants?: Json | null
        }
        Update: {
          available?: boolean | null
          bestseller?: boolean | null
          category?: string
          created_at?: string | null
          id?: string
          image_url?: string | null
          name?: string
          price?: number
          updated_at?: string | null
          variants?: Json | null
        }
        Relationships: []
      }
      modifiers: {
        Row: {
          created_at: string | null
          id: string
          name: string
          price: number
        }
        Insert: {
          created_at?: string | null
          id: string
          name: string
          price?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          name?: string
          price?: number
        }
        Relationships: []
      }
      order_items: {
        Row: {
          created_at: string | null
          id: string
          menu_item_id: string
          modifiers: Json | null
          name: string
          notes: string | null
          order_id: string
          price: number
          quantity: number
          variant: string | null
        }
        Insert: {
          created_at?: string | null
          id: string
          menu_item_id: string
          modifiers?: Json | null
          name: string
          notes?: string | null
          order_id: string
          price: number
          quantity?: number
          variant?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          menu_item_id?: string
          modifiers?: Json | null
          name?: string
          notes?: string | null
          order_id?: string
          price?: number
          quantity?: number
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      orders: {
        Row: {
          created_at: string | null
          created_by: string | null
          customer_name: string | null
          discount_amount: number | null
          discount_type: string | null
          discount_value: number | null
          grand_total: number | null
          id: string
          order_notes: string | null
          paid_at: string | null
          paid_by: string | null
          payment: Json | null
          platform: string | null
          refund: Json | null
          status: string
          subtotal: number | null
          table_id: string | null
          tax_amount: number | null
          tax_rate: number | null
          total: number
          type: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          grand_total?: number | null
          id: string
          order_notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment?: Json | null
          platform?: string | null
          refund?: Json | null
          status?: string
          subtotal?: number | null
          table_id?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          type: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          created_by?: string | null
          customer_name?: string | null
          discount_amount?: number | null
          discount_type?: string | null
          discount_value?: number | null
          grand_total?: number | null
          id?: string
          order_notes?: string | null
          paid_at?: string | null
          paid_by?: string | null
          payment?: Json | null
          platform?: string | null
          refund?: Json | null
          status?: string
          subtotal?: number | null
          table_id?: string | null
          tax_amount?: number | null
          tax_rate?: number | null
          total?: number
          type?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_table_id_fkey"
            columns: ["table_id"]
            isOneToOne: false
            referencedRelation: "tables"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          address: string | null
          auto_print_kot: boolean | null
          cafe_name: string
          created_at: string | null
          gst_enabled: boolean | null
          gst_number: string | null
          id: string
          kitchen_ready_alerts: boolean | null
          order_alerts: boolean | null
          print_customer_copy: boolean | null
          session_timeout_minutes: number | null
          tax_rate: number
          updated_at: string | null
          upi_id: string | null
        }
        Insert: {
          address?: string | null
          auto_print_kot?: boolean | null
          cafe_name?: string
          created_at?: string | null
          gst_enabled?: boolean | null
          gst_number?: string | null
          id?: string
          kitchen_ready_alerts?: boolean | null
          order_alerts?: boolean | null
          print_customer_copy?: boolean | null
          session_timeout_minutes?: number | null
          tax_rate?: number
          updated_at?: string | null
          upi_id?: string | null
        }
        Update: {
          address?: string | null
          auto_print_kot?: boolean | null
          cafe_name?: string
          created_at?: string | null
          gst_enabled?: boolean | null
          gst_number?: string | null
          id?: string
          kitchen_ready_alerts?: boolean | null
          order_alerts?: boolean | null
          print_customer_copy?: boolean | null
          session_timeout_minutes?: number | null
          tax_rate?: number
          updated_at?: string | null
          upi_id?: string | null
        }
        Relationships: []
      }
      shifts: {
        Row: {
          closing_cash: number | null
          created_at: string | null
          ended_at: string | null
          id: string
          notes: string | null
          opening_cash: number
          staff_id: string
          staff_name: string
          started_at: string
          total_orders: number | null
          total_sales: number | null
        }
        Insert: {
          closing_cash?: number | null
          created_at?: string | null
          ended_at?: string | null
          id: string
          notes?: string | null
          opening_cash?: number
          staff_id: string
          staff_name: string
          started_at: string
          total_orders?: number | null
          total_sales?: number | null
        }
        Update: {
          closing_cash?: number | null
          created_at?: string | null
          ended_at?: string | null
          id?: string
          notes?: string | null
          opening_cash?: number
          staff_id?: string
          staff_name?: string
          started_at?: string
          total_orders?: number | null
          total_sales?: number | null
        }
        Relationships: []
      }
      staff: {
        Row: {
          created_at: string | null
          id: string
          initials: string
          is_active: boolean | null
          name: string
          pin: string
          role: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          initials: string
          is_active?: boolean | null
          name: string
          pin: string
          role: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          initials?: string
          is_active?: boolean | null
          name?: string
          pin?: string
          role?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      supplementary_bill_items: {
        Row: {
          bill_id: string
          created_at: string | null
          id: string
          menu_item_id: string
          modifiers: Json | null
          name: string
          notes: string | null
          price: number
          quantity: number
          variant: string | null
        }
        Insert: {
          bill_id: string
          created_at?: string | null
          id: string
          menu_item_id: string
          modifiers?: Json | null
          name: string
          notes?: string | null
          price: number
          quantity?: number
          variant?: string | null
        }
        Update: {
          bill_id?: string
          created_at?: string | null
          id?: string
          menu_item_id?: string
          modifiers?: Json | null
          name?: string
          notes?: string | null
          price?: number
          quantity?: number
          variant?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "supplementary_bill_items_bill_id_fkey"
            columns: ["bill_id"]
            isOneToOne: false
            referencedRelation: "supplementary_bills"
            referencedColumns: ["id"]
          },
        ]
      }
      supplementary_bills: {
        Row: {
          created_at: string | null
          id: string
          order_id: string
          paid_at: string | null
          payment: Json | null
          total: number
        }
        Insert: {
          created_at?: string | null
          id?: string
          order_id: string
          paid_at?: string | null
          payment?: Json | null
          total?: number
        }
        Update: {
          created_at?: string | null
          id?: string
          order_id?: string
          paid_at?: string | null
          payment?: Json | null
          total?: number
        }
        Relationships: [
          {
            foreignKeyName: "supplementary_bills_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      tables: {
        Row: {
          capacity: number
          created_at: string | null
          id: string
          number: number
          order_id: string | null
          status: string
          updated_at: string | null
        }
        Insert: {
          capacity?: number
          created_at?: string | null
          id: string
          number: number
          order_id?: string | null
          status?: string
          updated_at?: string | null
        }
        Update: {
          capacity?: number
          created_at?: string | null
          id?: string
          number?: number
          order_id?: string | null
          status?: string
          updated_at?: string | null
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
      [_ in never]: never
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
    Enums: {},
  },
} as const
