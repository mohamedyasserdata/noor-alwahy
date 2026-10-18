import { describe, expect, it } from "vitest";

import {
  addMoney,
  createMoney,
  divideMoney,
  multiplyMoney,
  subtractMoney,
  sumMoney,
} from "../../lib/money";

describe("money", () => {
  it("normalizes database-compatible decimal strings without using binary floats", () => {
    expect(createMoney("12", "EGP")).toEqual({
      ok: true,
      data: { amount: "12.00", currency: "EGP" },
    });
    expect(
      addMoney({ amount: "0.10", currency: "EGP" }, { amount: "0.20", currency: "EGP" }),
    ).toEqual({
      ok: true,
      data: { amount: "0.30", currency: "EGP" },
    });
  });

  it("rejects invalid scale, notation, currency, and numeric(12,2) overflow", () => {
    expect(createMoney("1.001", "EGP")).toMatchObject({
      ok: false,
      code: "invalid_amount",
    });
    expect(createMoney("1e3", "EGP")).toMatchObject({
      ok: false,
      code: "invalid_amount",
    });
    expect(createMoney("1.00", "egp")).toMatchObject({
      ok: false,
      code: "invalid_currency",
    });
    expect(createMoney("10000000000.00", "EGP")).toMatchObject({
      ok: false,
      code: "amount_out_of_range",
    });
  });

  it("never combines different currencies", () => {
    expect(
      addMoney({ amount: "10.00", currency: "EGP" }, { amount: "5.00", currency: "SAR" }),
    ).toEqual({
      ok: false,
      code: "currency_mismatch",
      message_key: "errors.money.currency_mismatch",
    });
    expect(
      sumMoney(
        [
          { amount: "10.00", currency: "EGP" },
          { amount: "5.00", currency: "AED" },
        ],
        "EGP",
      ),
    ).toMatchObject({ ok: false, code: "currency_mismatch" });
  });

  it("adds, subtracts, and sums exact decimal amounts", () => {
    expect(
      subtractMoney({ amount: "10.10", currency: "AED" }, { amount: "0.20", currency: "AED" }),
    ).toEqual({
      ok: true,
      data: { amount: "9.90", currency: "AED" },
    });
    expect(
      sumMoney(
        [
          { amount: "0.10", currency: "SAR" },
          { amount: "0.20", currency: "SAR" },
          { amount: "1.05", currency: "SAR" },
        ],
        "SAR",
      ),
    ).toEqual({
      ok: true,
      data: { amount: "1.35", currency: "SAR" },
    });
    expect(sumMoney([], "USD")).toEqual({
      ok: true,
      data: { amount: "0.00", currency: "USD" },
    });
  });

  it("uses an explicit two-decimal rounding policy for multiplication and division", () => {
    expect(multiplyMoney({ amount: "1.01", currency: "EGP" }, "0.5", "half_up")).toEqual({
      ok: true,
      data: { amount: "0.51", currency: "EGP" },
    });
    expect(multiplyMoney({ amount: "1.01", currency: "EGP" }, "0.5", "half_even")).toEqual({
      ok: true,
      data: { amount: "0.50", currency: "EGP" },
    });
    expect(divideMoney({ amount: "10.00", currency: "EGP" }, "3")).toEqual({
      ok: true,
      data: { amount: "3.33", currency: "EGP" },
    });
    expect(divideMoney({ amount: "10.00", currency: "EGP" }, "0")).toMatchObject({
      ok: false,
      code: "division_by_zero",
    });
  });
});
