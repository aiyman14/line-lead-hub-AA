import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

export interface BuyerWorkOrder {
  id: string;
  po_number: string;
  buyer: string;
  style: string;
  item: string | null;
  color: string | null;
  order_qty: number;
  status: string | null;
  planned_ex_factory: string | null;
  is_active: boolean;
}

export function useBuyerPOAccess() {
  const { user } = useAuth();
  const [workOrderIds, setWorkOrderIds] = useState<string[]>([]);
  const [workOrders, setWorkOrders] = useState<BuyerWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    async function fetchAccess() {
      setLoading(true);
      const { data, error } = await supabase
        .from("buyer_po_access")
        .select(
          "work_order_id, work_orders(id, po_number, buyer, style, item, color, order_qty, status, planned_ex_factory, is_active)"
        )
        .eq("user_id", user!.id);

      if (cancelled) return;

      if (error) {
        console.error("[useBuyerPOAccess] Error:", error.message);
        setLoading(false);
        return;
      }

      const ids: string[] = [];
      const wos: BuyerWorkOrder[] = [];

      for (const row of data || []) {
        ids.push(row.work_order_id);
        // work_orders comes back as an object (single join)
        const wo = row.work_orders as unknown as BuyerWorkOrder | null;
        if (wo) wos.push(wo);
      }

      setWorkOrderIds(ids);
      setWorkOrders(wos);
      setLoading(false);
    }

    fetchAccess();
    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  return { workOrderIds, workOrders, loading };
}
