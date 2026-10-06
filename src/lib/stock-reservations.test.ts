import { describe, expect, it } from "vitest";
import {
  assessStockReservation,
  formatReservationCountdown,
  STOCK_RESERVATION_TTL_MS,
  type ReservationRecord,
} from "./stock-reservations";

const now = Date.parse("2026-10-04T12:00:00.000Z");
const lease = (ownerId: string, expiresInMs: number, overrides: Partial<ReservationRecord> = {}): ReservationRecord => ({
  ownerId,
  visitId: `${ownerId}-visit`,
  quantity: 1,
  expiresAt: new Date(now + expiresInMs).toISOString(),
  ...overrides,
});

const assess = (ownerId: string, records: ReservationRecord[], stock = 1, visitId = `${ownerId}-visit`) =>
  assessStockReservation({
    stock,
    stockUnlimited: false,
    ownerId,
    visitId,
    requestedQuantity: 1,
    records,
    now,
  });

describe("stock reservation leases", () => {
  it("grants five minutes to the first cart visitor and keeps their original expiration", () => {
    const initial = assess("guest:first", []);
    expect(initial.state).toBe("available");
    expect(STOCK_RESERVATION_TTL_MS).toBe(300_000);

    const ownReservation = lease("guest:first", 120_000);
    expect(assess("guest:first", [ownReservation])).toMatchObject({
      state: "reserved",
      expiresAt: ownReservation.expiresAt,
    });
  });

  it("shows the other customer's remaining priority and allows a waiter after expiration", () => {
    const activeReservation = lease("user:first", 30_000);
    expect(assess("guest:second", [activeReservation])).toMatchObject({
      state: "waiting",
      expiresAt: activeReservation.expiresAt,
      availableQuantity: 0,
    });
    expect(assess("guest:second", [lease("user:first", -1)])).toMatchObject({
      state: "available",
      availableQuantity: 1,
    });
  });

  it("does not renew a reservation after the same visit expires", () => {
    const expired = lease("user:first", -1, { visitId: "same-cart-visit" });
    expect(assess("user:first", [expired], 1, "same-cart-visit")).toMatchObject({
      state: "expired",
      expiresAt: expired.expiresAt,
    });
  });

  it("does not renew an expired reservation after a reload or route visit changes", () => {
    const expired = lease("user:first", -1, { visitId: "previous-browser-visit" });
    expect(assess("user:first", [expired], 1, "new-browser-visit")).toMatchObject({
      state: "expired",
      expiresAt: expired.expiresAt,
    });
  });

  it("reports sold stock, but supports reserving multiple available units", () => {
    expect(assess("guest:second", [], 0).state).toBe("sold");
    expect(assess("guest:second", [lease("guest:first", 30_000)], 3)).toMatchObject({
      state: "available",
      availableQuantity: 2,
    });
  });

  it("renders a stable mm:ss countdown", () => {
    expect(formatReservationCountdown(new Date(now + 65_100).toISOString(), now)).toBe("01:06");
    expect(formatReservationCountdown(new Date(now - 1).toISOString(), now)).toBe("00:00");
  });
});
