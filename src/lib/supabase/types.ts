// Hand-authored to match supabase/migrations/20260331000000_initial_schema.sql.
// Structured to exactly match the output of `supabase gen types typescript` so
// that Database["public"] satisfies the GenericSchema constraint in SupabaseClient.

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type StaffStatus   = "pending" | "active" | "suspended";
export type TableShape    = "square" | "rectangle" | "round";
export type TableStatus   = "available" | "occupied" | "reserved";
export type OrderType     = "dine-in" | "takeaway";
export type OrderStatus   = "pending" | "in-progress" | "completed" | "cancelled";
export type PaymentMethod = "cash" | "card" | "grabpay" | "paynow" | "wechatpay";
export type KdsStatus     = "pending" | "preparing" | "ready";

export type Database = {
  public: {
    Tables: {
      admins: {
        Row: {
          id:             string;
          email:          string;
          name:           string | null;
          business_name:  string | null;
          business_code:  string;
          openai_api_key: string | null;
          tax_rate:       number;
          created_at:     string;
        };
        Insert: {
          id:              string;
          email:           string;
          name?:           string | null;
          business_name?:  string | null;
          business_code?:  string;       // DB generates one if omitted
          openai_api_key?: string | null;
          tax_rate?:       number;       // defaults to 0
          created_at?:     string;
        };
        Update: {
          id?:             string;
          email?:          string;
          name?:           string | null;
          business_name?:  string | null;
          business_code?:  string;
          openai_api_key?: string | null;
          tax_rate?:       number;
          created_at?:     string;
        };
        Relationships: [];
      };
      staff: {
        Row: {
          id:         string;
          admin_id:   string;
          name:       string;
          email:      string;
          status:     Database["public"]["Enums"]["staff_status"];
          created_at: string;
        };
        Insert: {
          id:          string;
          admin_id:    string;
          name:        string;
          email:       string;
          status?:     Database["public"]["Enums"]["staff_status"];
          created_at?: string;
        };
        Update: {
          id?:         string;
          admin_id?:   string;
          name?:       string;
          email?:      string;
          status?:     Database["public"]["Enums"]["staff_status"];
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "staff_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      shifts: {
        Row: {
          id:         string;
          admin_id:   string;
          staff_id:   string;
          clock_in:   string;
          clock_out:  string | null;
          created_at: string;
        };
        Insert: {
          id?:         string;
          admin_id:    string;
          staff_id:    string;
          clock_in?:   string;
          clock_out?:  string | null;
          created_at?: string;
        };
        Update: {
          id?:         string;
          admin_id?:   string;
          staff_id?:   string;
          clock_in?:   string;
          clock_out?:  string | null;
          created_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "shifts_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "shifts_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
        ];
      };
      tables: {
        Row: {
          id:              string;
          admin_id:        string;
          name:            string;
          capacity:        number | null;
          shape:           Database["public"]["Enums"]["table_shape"];
          area_name:       string | null;
          row_position:    number;
          column_position: number;
          status:          Database["public"]["Enums"]["table_status"];
          created_at:      string;
        };
        Insert: {
          id?:              string;
          admin_id:         string;
          name:             string;
          capacity?:        number | null;
          shape?:           Database["public"]["Enums"]["table_shape"];
          area_name?:       string | null;
          row_position?:    number;
          column_position?: number;
          status?:          Database["public"]["Enums"]["table_status"];
          created_at?:      string;
        };
        Update: {
          id?:              string;
          admin_id?:        string;
          name?:            string;
          capacity?:        number | null;
          shape?:           Database["public"]["Enums"]["table_shape"];
          area_name?:       string | null;
          row_position?:    number;
          column_position?: number;
          status?:          Database["public"]["Enums"]["table_status"];
          created_at?:      string;
        };
        Relationships: [
          {
            foreignKeyName: "tables_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      categories: {
        Row: {
          id:         string;
          admin_id:   string;
          name:       string;
          sort_order: number;
          created_at: string;
        };
        Insert: {
          id?:          string;
          admin_id:     string;
          name:         string;
          sort_order?:  number;
          created_at?:  string;
        };
        Update: {
          id?:          string;
          admin_id?:    string;
          name?:        string;
          sort_order?:  number;
          created_at?:  string;
        };
        Relationships: [
          {
            foreignKeyName: "categories_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          id:           string;
          admin_id:     string;
          category_id:  string;
          name:         string;
          description:  string | null;
          price:        number;
          cost_price:   number | null;
          image_url:    string | null;
          stock:        number;
          is_available: boolean;
          created_at:   string;
        };
        Insert: {
          id?:           string;
          admin_id:      string;
          category_id:   string;
          name:          string;
          description?:  string | null;
          price:         number;
          cost_price?:   number | null;
          image_url?:    string | null;
          stock?:        number;
          is_available?: boolean;
          created_at?:   string;
        };
        Update: {
          id?:           string;
          admin_id?:     string;
          category_id?:  string;
          name?:         string;
          description?:  string | null;
          price?:        number;
          cost_price?:   number | null;
          image_url?:    string | null;
          stock?:        number;
          is_available?: boolean;
          created_at?:   string;
        };
        Relationships: [
          {
            foreignKeyName: "products_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "categories";
            referencedColumns: ["id"];
          },
        ];
      };
      orders: {
        Row: {
          id:           string;
          admin_id:     string;
          staff_id:     string | null;
          table_id:     string | null;
          type:         Database["public"]["Enums"]["order_type"];
          status:       Database["public"]["Enums"]["order_status"];
          subtotal:     number;
          tax_amount:   number;
          total_amount: number;
          notes:        string | null;
          created_at:   string;
          completed_at: string | null;
        };
        Insert: {
          id?:           string;
          admin_id:      string;
          staff_id?:     string | null;
          table_id?:     string | null;
          type:          Database["public"]["Enums"]["order_type"];
          status?:       Database["public"]["Enums"]["order_status"];
          subtotal?:     number;       // defaults to 0
          tax_amount?:   number;       // defaults to 0
          total_amount?: number;
          notes?:        string | null;
          created_at?:   string;
          completed_at?: string | null;
        };
        Update: {
          id?:           string;
          admin_id?:     string;
          staff_id?:     string | null;
          table_id?:     string | null;
          type?:         Database["public"]["Enums"]["order_type"];
          status?:       Database["public"]["Enums"]["order_status"];
          subtotal?:     number;
          tax_amount?:   number;
          total_amount?: number;
          notes?:        string | null;
          created_at?:   string;
          completed_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "orders_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_staff_id_fkey";
            columns: ["staff_id"];
            isOneToOne: false;
            referencedRelation: "staff";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "orders_table_id_fkey";
            columns: ["table_id"];
            isOneToOne: false;
            referencedRelation: "tables";
            referencedColumns: ["id"];
          },
        ];
      };
      order_items: {
        Row: {
          id:         string;
          order_id:   string;
          product_id: string;
          quantity:   number;
          unit_price: number;
          unit_cost:  number | null;
          created_at: string;
        };
        Insert: {
          id?:         string;
          order_id:    string;
          product_id:  string;
          quantity:    number;
          unit_price:  number;
          unit_cost?:  number | null;
          created_at?: string;
        };
        Update: {
          id?:          string;
          order_id?:    string;
          product_id?:  string;
          quantity?:    number;
          unit_price?:  number;
          unit_cost?:   number | null;
          created_at?:  string;
        };
        Relationships: [
          {
            foreignKeyName: "order_items_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      payments: {
        Row: {
          id:         string;
          order_id:   string;
          admin_id:   string;
          amount:     number;
          method:     Database["public"]["Enums"]["payment_method"];
          created_at: string;
        };
        Insert: {
          id?:         string;
          order_id:    string;
          admin_id:    string;
          amount:      number;
          method:      Database["public"]["Enums"]["payment_method"];
          created_at?: string;
        };
        Update: {
          id?:          string;
          order_id?:    string;
          admin_id?:    string;
          amount?:      number;
          method?:      Database["public"]["Enums"]["payment_method"];
          created_at?:  string;
        };
        Relationships: [
          {
            foreignKeyName: "payments_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "payments_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
      kds_tickets: {
        Row: {
          id:         string;
          order_id:   string;
          admin_id:   string;
          status:     Database["public"]["Enums"]["kds_status"];
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?:         string;
          order_id:    string;
          admin_id:    string;
          status?:     Database["public"]["Enums"]["kds_status"];
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?:          string;
          order_id?:    string;
          admin_id?:    string;
          status?:      Database["public"]["Enums"]["kds_status"];
          created_at?:  string;
          updated_at?:  string;
        };
        Relationships: [
          {
            foreignKeyName: "kds_tickets_admin_id_fkey";
            columns: ["admin_id"];
            isOneToOne: false;
            referencedRelation: "admins";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "kds_tickets_order_id_fkey";
            columns: ["order_id"];
            isOneToOne: false;
            referencedRelation: "orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      business_code_exists: {
        Args: { p_business_code: string };
        Returns: boolean;
      };
      get_my_admin_id: {
        Args: Record<PropertyKey, never>;
        Returns: string;
      };
      is_admin: {
        Args: Record<PropertyKey, never>;
        Returns: boolean;
      };
      complete_order: {
        Args: { p_order_id: string };
        Returns: undefined;
      };
      register_staff: {
        Args: { p_business_code: string; p_name: string; p_email: string };
        Returns: undefined;
      };
    };
    Enums: {
      table_shape:    "square" | "rectangle" | "round";
      staff_status:   "pending" | "active" | "suspended";
      table_status:   "available" | "occupied" | "reserved";
      order_type:     "dine-in" | "takeaway";
      order_status:   "pending" | "in-progress" | "completed" | "cancelled";
      payment_method: "cash" | "card" | "grabpay" | "paynow" | "wechatpay";
      kds_status:     "pending" | "preparing" | "ready";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
