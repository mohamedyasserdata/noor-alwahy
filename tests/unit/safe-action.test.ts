import { describe, expect, it, vi } from "vitest";
import { z } from "zod";

import { ExpectedActionError, safeAction } from "../../lib/actions/safe-action";

const inputSchema = z.object({
  amount: z.string().regex(/^\d+\.\d{2}$/, { error: "errors.amount.format" }),
  currency: z.string().length(3, { error: "errors.currency.length" }),
});

describe("safeAction", () => {
  it("validates untrusted input before invoking the handler", async () => {
    const handler = vi.fn(() => ({ saved: true }));
    const action = safeAction(inputSchema, handler);

    await expect(action({ amount: "10", currency: "EGP" })).resolves.toEqual({
      ok: false,
      code: "validation_error",
      message_key: "errors.validation",
      fieldErrors: { amount: ["errors.amount.format"] },
    });
    expect(handler).not.toHaveBeenCalled();
  });

  it("returns typed success data for valid input", async () => {
    const action = safeAction(inputSchema, async (input) => ({
      savedAmount: `${input.amount} ${input.currency}`,
    }));

    await expect(action({ amount: "10.00", currency: "EGP" })).resolves.toEqual({
      ok: true,
      data: { savedAmount: "10.00 EGP" },
    });
  });

  it("maps expected business failures to the shared Result contract", async () => {
    const action = safeAction<typeof inputSchema, never, "price_out_of_bounds">(inputSchema, () => {
      throw new ExpectedActionError({
        code: "price_out_of_bounds",
        messageKey: "errors.pricing.out_of_bounds",
        fieldErrors: { amount: ["errors.pricing.out_of_bounds"] },
      });
    });

    await expect(action({ amount: "10.00", currency: "EGP" })).resolves.toEqual({
      ok: false,
      code: "price_out_of_bounds",
      message_key: "errors.pricing.out_of_bounds",
      fieldErrors: { amount: ["errors.pricing.out_of_bounds"] },
    });
  });

  it("rethrows unexpected failures without serializing their details to the client", async () => {
    const unexpected = new Error("private database detail");
    const action = safeAction(inputSchema, () => {
      throw unexpected;
    });

    await expect(action({ amount: "10.00", currency: "EGP" })).rejects.toBe(unexpected);
  });
});
