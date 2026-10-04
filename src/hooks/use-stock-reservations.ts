import { useEffect, useMemo, useRef, useState } from "react";
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
}: {
  items: CartItem[];
  hydrated: boolean;
  ownerId: string | null;
  enabled?: boolean;
}) {
  const visitIdRef = useRef("");
  if (!visitIdRef.current) visitIdRef.current = crypto.randomUUID();
  const [statuses, setStatuses] = useState<Record<string, CartReservationStatus>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const reservationItems = useMemo(
    () => items.map((item) => ({ id: item.id, quantity: item.quantity })),
    [items],
  );
  const itemSignature = JSON.stringify(reservationItems);

  useEffect(() => {
    if (!enabled || !hydrated || !ownerId) return;
    if (!reservationItems.length) {
      setStatuses({});
      setIsLoading(false);
      return;
    }

    let active = true;
    setIsLoading(true);
    void reserveCartStock({
      data: { ownerId, visitId: visitIdRef.current, items: reservationItems },
    })
      .then((results) => {
        if (!active) return;
        setStatuses(Object.fromEntries(results.map((status) => [status.id, status])));
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
  }, [enabled, hydrated, ownerId, itemSignature, reservationItems]);

  useEffect(() => {
    if (!enabled || !hydrated || !ownerId || !reservationItems.length) return;
    let active = true;
    const refresh = async () => {
      try {
        const latest = await getCartStockReservationStatus({
          data: { ownerId, visitId: visitIdRef.current, items: reservationItems },
        });
        if (!active) return;
        setStatuses(Object.fromEntries(latest.map((status) => [status.id, status])));

        const newlyAvailable = latest
          .filter((status) => status.state === "available")
          .map((status) => reservationItems.find((item) => item.id === status.id))
          .filter((item): item is { id: string; quantity: number } => Boolean(item));
        if (!newlyAvailable.length) return;

        const claimed = await reserveCartStock({
          data: { ownerId, visitId: visitIdRef.current, items: newlyAvailable },
        });
        if (!active) return;
        setStatuses((current) => ({
          ...current,
          ...Object.fromEntries(claimed.map((status) => [status.id, status])),
        }));
      } catch (error) {
        console.error("No se pudo actualizar la prioridad del carrito:", error);
      }
    };

    const pollId = window.setInterval(() => void refresh(), 5_000);
    const clockId = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => {
      active = false;
      window.clearInterval(pollId);
      window.clearInterval(clockId);
    };
  }, [enabled, hydrated, ownerId, itemSignature, reservationItems]);

  const canProceed = items.every((item) => {
    const status = statuses[item.id]?.state;
    return status === "reserved" || status === "unlimited";
  });

  return { statuses, now, isLoading, canProceed };
}
