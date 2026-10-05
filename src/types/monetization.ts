/**
 * Estructuras de monetización. El MVP solo genera CplEvent;
 * FeaturedPlacement y Order/Commission quedan preparados para el roadmap.
 */

/** CPL — la institución paga por lead generado. */
export interface CplEvent {
  id: string;
  institution_id: string;
  course_id: string;
  lead_id: string;
  lead_score: number;
  timestamp: string;
  source: string;
  /** Tarifa acordada por lead (moneda de facturación). */
  cpl_amount: number;
  currency: 'PEN' | 'USD';
}

/** Featured Listing — posición patrocinada. */
export interface FeaturedPlacement {
  course_id: string;
  institution_id: string;
  slot: 'search_top' | 'category_top' | 'home_featured';
  starts_at: string;
  ends_at: string;
}

/** Comisión por venta (checkout futuro). */
export interface Order {
  order_id: string;
  course_id: string;
  institution_id: string;
  lead_id: string | null;
  sale_amount: number;
  currency: 'PEN' | 'USD';
  commission_percentage: number;
  commission_amount: number;
  created_at: string;
}
