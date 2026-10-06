import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getCartStockReservationStatus,
  reserveCartStock,
  type CartReservationStatus,
  type CartItem,
} from "@/server/persistence";

export function useStockReservations({
  items,
  hydrated,
  ownerId,
  enabled = true,
  onExpired,
}: {
  items: CartItem[];
  hydrated: boolean;
  ownerId: string | null;
  enabled?: boolean;
  onExpired?: (ids: string[]) => void;
}) {
  const visitIdsRef = useRef<Record<string, string>>({});
  const statusesRef = useRef<Record<string, CartReservationStatus>>({});
  const expiredNotifiedRef = useRef(new Set<string>());
  const refreshInFlightRef = useRef(false);
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;
  const getVisitId = useCallback((currentOwnerId: string) => {
    const existing = visitIdsRef.current[currentOwnerId];
    if (existing) return existing;
    const storageKey = `lrg_stock_reservation_visit:${currentOwnerId}`;
    let visitId = "";
    try {
      visitId = window.sessionStorage.getItem(storageKey) ?? "";
    } catch {
      // sessionStorage might be unavailable in restricted browser contexts.
    }
    if (!visitId) {
      visitId = crypto.randomUUID();
      try {
        window.sessionStorage.setItem(storageKey, visitId);
      } catch {
        // Keep the in-memory visit ID for this mounted cart provider.
      }
    }
    visitIdsRef.current[currentOwnerId] = visitId;
    return visitId;
  }, []);

  const [statuses, setStatuses] = useState<Record<string, CartReservationStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reservationItems = useMemo(
    () => items.map((item) => ({ id: item.id, quantity: item.quantity })),
    [items],
  );
  const itemSignature = JSON.stringify(reservationItems);

  const publishStatuses = useCallback((results: CartReservationStatus[]) => {
    const nextStatuses = Object.fromEntries(results.map((status) => [status.id, status]));
    statusesRef.current = nextStatuses;
    setStatuses(nextStatuses);
    const currentIds = new Set(results.map((status) => status.id));
    expiredNotifiedRef.current.forEach((id) => {
      if (!currentIds.has(id)) expiredNotifiedRef.current.delete(id);
    });
    const expiredIds = results
      .filter((status) => status.state === "expired" && !expiredNotifiedRef.current.has(status.id))
      .map((status) => status.id);
    if (expiredIds.length) {
      expiredIds.forEach((id) => expiredNotifiedRef.current.add(id));
      onExpiredRef.current?.(expiredIds);
    }
  }, []);

  useEffect(() => {
    if (!enabled || !hydrated || !ownerId) return;
    if (!reservationItems.length) {
      statusesRef.current = {};
      expiredNotifiedRef.current.clear();
      setStatuses({});
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    void reserveCartStock({
      data: { ownerId, visitId: getVisitId(ownerId), items: reservationItems },
    })
      .then((results) => {
        if (!active) return;
        publishStatuses(results);
      })
      .catch((error: unknown) => {
        console.error("No se pudieron reservar los productos del carrito:", error);
        if (active) {
          setStatuses(
            Object.fromEntries(
              reservationItems.map((item) => [
                item.id,
                {
                  id: item.id,
                  inventoryKey: item.id,
                  state: "unavailable" as const,
                  availableQuantity: 0,
                },
              ]),
            ),
          );
        }
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [enabled, getVisitId, hydrated, itemSignature, ownerId, publishStatuses, reservationItems]);

  useEffect(() => {
    if (!enabled || !hydrated || !ownerId || !reservationItems.length) return;
    let active = true;
    const refresh = async () => {
      if (refreshInFlightRef.current) return;
      refreshInFlightRef.current = true;
      try {
        const latest = await getCartStockReservationStatus({
          data: { ownerId, visitId: getVisitId(ownerId), items: reservationItems },
        });
        if (!active) return;
        publishStatuses(latest);

        const newlyAvailable = latest
          .filter((status) => status.state === "available")
          .map((status) => reservationItems.find((item) => item.id === status.id))
          .filter((item): item is { id: string; quantity: number } => Boolean(item));
        if (!newlyAvailable.length) return;

        const claimed = await reserveCartStock({
          data: { ownerId, visitId: getVisitId(ownerId), items: newlyAvailable },
        });
        if (!active) return;
        publishStatuses([...Object.values(statusesRef.current), ...claimed]);
      } catch (error) {
        console.error("No se pudo actualizar la prioridad del carrito:", error);
      } finally {
        refreshInFlightRef.current = false;
      }
    };

    const pollId = window.setInterval(() => void refresh(), 5_000);
    const clockId = window.setInterval(() => {
      const currentTime = Date.now();
      setNow(currentTime);
      const reservationExpired = Object.values(statusesRef.current).some(
        (status) =>
          status.state === "reserved" &&
          status.expiresAt &&
          new Date(status.expiresAt).getTime() <= currentTime,
      );
      if (reservationExpired) void refresh();
    }, 1_000);
    return () => {
      active = false;
      window.clearInterval(pollId);
      window.clearInterval(clockId);
    };
  }, [enabled, getVisitId, hydrated, itemSignature, ownerId, publishStatuses, reservationItems]);

  const canProceed = items.every((item) => {
    const status = statuses[item.id]?.state;
    return status === "reserved" || status === "unlimited";
  });

  return { statuses, now, isLoading, canProceed };
}
