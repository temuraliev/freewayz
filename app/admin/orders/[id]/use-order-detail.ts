"use client";

import { useCallback, useEffect, useState } from "react";
import { admin as adminApi } from "@/lib/api-client";

interface TrackingEvent {
  date?: string;
  status?: string;
  description?: string;
  location?: string;
}

interface OrderItemView {
  title?: string;
  brand?: string;
  size?: string;
  color?: string;
  price?: number;
  quantity?: number;
}

export interface AdminOrder {
  _id: string;
  orderId: string;
  total: number;
  cost?: number | null;
  status: string;
  trackNumber?: string;
  trackUrl?: string;
  trackingStatus?: string;
  trackingEvents?: TrackingEvent[];
  track17Registered?: boolean;
  shippingMethod?: string;
  notes?: string;
  createdAt?: string;
  updatedAt?: string;
  items?: OrderItemView[];
  user?: {
    _id?: string;
    telegramId?: string;
    username?: string;
    firstName?: string;
  };
}

export interface OrderFormState {
  status: string;
  trackNumber: string;
  trackUrl: string;
  notes: string;
  cost: string;
}

function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export function useOrderDetail(id: string | undefined) {
  const [order, setOrder] = useState<AdminOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<OrderFormState>({
    status: "",
    trackNumber: "",
    trackUrl: "",
    notes: "",
    cost: "",
  });

  useEffect(() => {
    if (!id) {
      setLoading(false);
      return;
    }
    const initData = getInitData();
    adminApi.getOrder(id)
      .then((data) => {
        if (data && !('error' in data)) {
          setOrder(data as unknown as AdminOrder);
          setForm({
            status: (data.status as string) ?? "new",
            trackNumber: (data.trackNumber as string) ?? "",
            trackUrl: (data.trackUrl as string) ?? "",
            notes: (data.notes as string) ?? "",
            cost: data.cost != null ? String(data.cost) : "",
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [id]);

  const updateForm = useCallback((patch: Partial<OrderFormState>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  }, []);

  const save = useCallback(async () => {
    if (!order || !id) return;
    setSaving(true);
    try {
      const costNum = form.cost.trim() === "" ? undefined : parseFloat(form.cost);
      const initData = getInitData();
      await adminApi.patchOrder(id, {
        initData,
        status: form.status,
        trackNumber: form.trackNumber.trim() || undefined,
        trackUrl: form.trackUrl.trim() || undefined,
        notes: form.notes.trim() || undefined,
        cost: costNum != null && !Number.isNaN(costNum) ? costNum : undefined,
      });
      setOrder((prev) =>
        prev
          ? {
              ...prev,
              status: form.status,
              trackNumber: form.trackNumber,
              trackUrl: form.trackUrl,
              notes: form.notes,
              cost: costNum,
            }
          : null
      );
    } finally {
      setSaving(false);
    }
  }, [order, id, form]);

  const quickAction = useCallback(
    async (newStatus: string) => {
      if (!id) return;
      setSaving(true);
      try {
        const initData = getInitData();
        await adminApi.patchOrder(id, { initData, status: newStatus });
        setForm((prev) => ({ ...prev, status: newStatus }));
        setOrder((prev) => (prev ? { ...prev, status: newStatus } : null));
      } finally {
        setSaving(false);
      }
    },
    [id]
  );

  return { order, loading, saving, form, updateForm, save, quickAction };
}
