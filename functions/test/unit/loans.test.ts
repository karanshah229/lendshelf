import { describe, expect, it } from "vitest";
import {
  addDays,
  daysUntil,
  assertActor,
  canTransition,
  isOpenStatus,
  isRequestExpired,
  loanRole,
  nextStatus,
  reminderKind,
  resolveDueDate,
  TRANSITIONS,
  type LoanAction,
} from "../../src/lib/loans.js";
import { msg } from "../../src/lib/messages.js";
import { LOAN_STATUSES } from "../../src/model.js";

const now = new Date("2026-11-21T03:30:00Z"); // 09:00 IST
const HOUR = 3600_000;

describe("loan state machine", () => {
  it("allows exactly the SPEC transitions", () => {
    expect(nextStatus("requested", "accept")).toBe("active");
    expect(nextStatus("requested", "decline")).toBe("declined");
    expect(nextStatus("requested", "cancel")).toBe("cancelled");
    expect(nextStatus("requested", "expire")).toBe("expired");
    expect(nextStatus("active", "markReturned")).toBe("returnPending");
    expect(nextStatus("active", "confirmReturn")).toBe("returned");
    expect(nextStatus("returnPending", "confirmReturn")).toBe("returned");
    expect(nextStatus("active", "updateDueDate")).toBe("active");
    // UX v1.1 (B2, B3, B5)
    expect(nextStatus("active", "notCollected")).toBe("cancelled");
    expect(nextStatus("returnPending", "markNotReturned")).toBe("active");
    expect(nextStatus("active", "ownerLeave")).toBe("ownerLeft");
    expect(nextStatus("returnPending", "ownerLeave")).toBe("ownerLeft");
  });

  it("notCollected is for active loans only; ownerLeft is terminal", () => {
    expect(() => nextStatus("returnPending", "notCollected")).toThrow(/close this loan as not collected/);
    expect(() => nextStatus("requested", "notCollected")).toThrowError(expect.objectContaining({ code: "failed-precondition" }));
    expect(() => nextStatus("active", "markNotReturned")).toThrow(/an active loan/);
    for (const action of Object.keys(TRANSITIONS) as LoanAction[]) {
      expect(canTransition("ownerLeft", action)).toBe(false);
    }
    expect(() => nextStatus("ownerLeft", "markReturned")).toThrow(/owner left LendShelf/);
  });

  it("rejects everything else with failed-precondition", () => {
    let allowed = 0;
    for (const status of LOAN_STATUSES) {
      for (const action of Object.keys(TRANSITIONS) as LoanAction[]) {
        if (canTransition(status, action)) {
          allowed++;
          continue;
        }
        expect(() => nextStatus(status, action)).toThrowError(expect.objectContaining({ code: "failed-precondition" }));
      }
    }
    expect(allowed).toBe(12);
  });

  it("gives a readable message", () => {
    expect(() => nextStatus("returned", "markReturned")).toThrow(/already returned/);
    expect(() => nextStatus("active", "cancel")).toThrow(/cancel this request/);
  });

  it("open statuses", () => {
    expect(LOAN_STATUSES.filter(isOpenStatus)).toEqual(["requested", "active", "returnPending"]);
  });
});

describe("actors", () => {
  const loan = { ownerId: "o", borrowerUid: "b" };
  it("finds the caller's role", () => {
    expect(loanRole(loan, "o")).toBe("owner");
    expect(loanRole(loan, "b")).toBe("borrower");
    expect(loanRole(loan, "x")).toBeNull();
    expect(loanRole({ ownerId: "o", borrowerUid: null }, "x")).toBeNull();
  });

  it("enforces who may act", () => {
    expect(() => assertActor(loan, "o", "accept")).not.toThrow();
    expect(() => assertActor(loan, "b", "accept")).toThrow(/Only the owner/);
    expect(() => assertActor(loan, "b", "markReturned")).not.toThrow();
    expect(() => assertActor(loan, "o", "markReturned")).toThrow(/Only the borrower/);
    expect(() => assertActor(loan, "o", "cancel")).toThrow(/Only the borrower/);
    expect(() => assertActor(loan, "o", "notCollected")).not.toThrow();
    expect(() => assertActor(loan, "b", "notCollected")).toThrow(/Only the owner/);
    expect(() => assertActor(loan, "o", "markNotReturned")).not.toThrow();
    expect(() => assertActor(loan, "b", "markNotReturned")).toThrow(/Only the owner/);
    expect(() => assertActor(loan, "x", "confirmReturn")).toThrowError(
      expect.objectContaining({ code: "permission-denied" }),
    );
  });
});

describe("due dates", () => {
  it("defaults to 21 days", () => {
    expect(resolveDueDate(undefined, now)).toEqual(addDays(now, 21));
    expect(resolveDueDate(null, now)).toEqual(addDays(now, 21));
  });

  it("accepts ISO dates, including today as a date-only value", () => {
    expect(resolveDueDate("2026-12-12", now).toISOString()).toBe("2026-12-12T00:00:00.000Z");
    expect(resolveDueDate("2026-11-21", now).toISOString()).toBe("2026-11-21T00:00:00.000Z");
  });

  it("rejects bad, past and far-future dates", () => {
    expect(() => resolveDueDate("next tuesday", now)).toThrowError(expect.objectContaining({ code: "invalid-argument" }));
    expect(() => resolveDueDate("2026-11-01", now)).toThrow(/past/);
    expect(() => resolveDueDate("2028-01-01", now)).toThrow(/within a year/);
  });
});

describe("expiry and reminders", () => {
  it("requests expire after 7 days", () => {
    expect(isRequestExpired(addDays(now, -6.9), now)).toBe(false);
    expect(isRequestExpired(addDays(now, -7), now)).toBe(true);
  });

  it("due-soon fires once, in the 24-48h window", () => {
    expect(reminderKind(new Date(now.getTime() + 47 * HOUR), now)).toBe("dueSoon");
    expect(reminderKind(new Date(now.getTime() + 48 * HOUR), now)).toBe("dueSoon");
    expect(reminderKind(new Date(now.getTime() + 49 * HOUR), now)).toBeNull();
    expect(reminderKind(new Date(now.getTime() + 24 * HOUR), now)).toBeNull();
    expect(reminderKind(new Date(now.getTime() + 5 * HOUR), now)).toBeNull();
  });

  it("overdue fires on day 0 and weekly after", () => {
    expect(reminderKind(new Date(now.getTime() - 1 * HOUR), now)).toBe("overdue");
    expect(reminderKind(addDays(now, -1), now)).toBeNull();
    expect(reminderKind(addDays(now, -3), now)).toBeNull();
    expect(reminderKind(new Date(addDays(now, -7).getTime() - HOUR), now)).toBe("overdue");
    expect(reminderKind(new Date(addDays(now, -14).getTime() - HOUR), now)).toBe("overdue");
  });
});

describe("due-soon wording", () => {
  it("counts whole calendar days in India time", () => {
    // now = 21 Nov 09:00 IST
    expect(daysUntil(new Date("2026-11-22T18:00:00Z"), now)).toBe(1); // 22 Nov 23:30 IST
    expect(daysUntil(new Date("2026-11-23T00:00:00Z"), now)).toBe(2); // 23 Nov 05:30 IST
    expect(daysUntil(new Date("2026-11-21T12:00:00Z"), now)).toBe(0);
  });

  it("says tomorrow for 1 day and 'in N days' otherwise", () => {
    const tomorrow = msg.dueSoon("Dune", "L1", new Date("2026-11-22T18:00:00Z"), now);
    expect(tomorrow.body).toBe("Dune is due back tomorrow (22 Nov).");
    const twoDays = msg.dueSoon("Dune", "L1", new Date("2026-11-23T00:00:00Z"), now);
    expect(twoDays.body).toBe("Dune is due back in 2 days (23 Nov).");
    expect(twoDays.data).toEqual({ type: "dueSoon", loanId: "L1" });
  });
});

describe("UX v1.1 push texts", () => {
  it("decline reasons each have their own text and carry the reason", () => {
    expect(msg.requestDeclined("Ravi Menon", "Animal Farm", "L1").body).toBe("Ravi Menon can't lend Animal Farm right now.");
    expect(msg.requestDeclined("Ravi Menon", "Animal Farm", "L1").data).toEqual({ type: "requestDeclined", loanId: "L1" });
    expect(msg.requestDeclined("Ravi Menon", "Animal Farm", "L1", "readingIt").body).toBe("Ravi Menon is reading Animal Farm right now.");
    expect(msg.requestDeclined("Ravi Menon", "Animal Farm", "L1", "notLending").body).toBe(
      "Ravi Menon isn't lending Animal Farm at the moment.",
    );
    const lent = msg.requestDeclined("Ravi Menon", "Animal Farm", "L1", "lentToSomeoneElse");
    expect(lent.body).toBe("Animal Farm went to someone else. We'll tell you when it's back.");
    expect(lent.data).toEqual({ type: "requestDeclined", loanId: "L1", reason: "lentToSomeoneElse" });
  });

  it("availableAgain, notBackYet, dueChanged, ownerLeft", () => {
    expect(msg.availableAgain("Animal Farm", "I1")).toEqual({
      title: "Available again",
      body: "Animal Farm is available again.",
      data: { type: "availableAgain", itemId: "I1" },
    });
    expect(msg.notBackYet("Ravi Menon", "Animal Farm", "L1")).toMatchObject({
      body: "Ravi Menon hasn't got Animal Farm back yet.",
      data: { type: "notBackYet", loanId: "L1" },
    });
    expect(msg.dueChanged("Ravi Menon", "Animal Farm", "L1", new Date("2026-12-19T00:00:00Z"))).toMatchObject({
      body: "Ravi Menon changed the due date for Animal Farm to 19 Dec.",
      data: { type: "dueChanged", loanId: "L1" },
    });
    const left = msg.ownerLeft("Ravi Menon", "Animal Farm", "L1");
    expect(left.title).toBe("Ravi Menon left LendShelf");
    expect(left.body).toBe("If you still have Animal Farm, message them on WhatsApp if you still have their number.");
    expect(left.data).toEqual({ type: "ownerLeft", loanId: "L1" });
  });
});
