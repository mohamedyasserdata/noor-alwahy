import Decimal from "decimal.js";

import { failure, success, type Result } from "../result";

export type Money = Readonly<{
  amount: string;
  currency: string;
}>;

export type MoneyErrorCode =
  | "invalid_amount"
  | "invalid_currency"
  | "currency_mismatch"
  | "amount_out_of_range"
  | "division_by_zero";

export type MoneyResult = Result<Money, MoneyErrorCode>;

export type MoneyRounding = "half_up" | "half_even";

const MONEY_SCALE = 2;
const CURRENCY_PATTERN = /^[A-Z]{3}$/;
const MONEY_AMOUNT_PATTERN = /^-?\d+(?:\.\d{1,2})?$/;
const FACTOR_PATTERN = /^-?\d+(?:\.\d+)?$/;

// Matches PostgreSQL numeric(12,2): ten integer digits and two fractional digits.
const MAX_ABSOLUTE_AMOUNT = "9999999999.99";

const MoneyDecimal = Decimal.clone({
  precision: 40,
  rounding: Decimal.ROUND_HALF_UP,
  toExpNeg: -40,
  toExpPos: 40,
});

const ROUNDING_MODES: Record<MoneyRounding, Decimal.Rounding> = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
};

function invalidMoney(code: MoneyErrorCode, messageKey: string): MoneyResult {
  return failure(code, messageKey);
}

function normalizeDecimal(value: Decimal, currency: string, rounding: MoneyRounding): MoneyResult {
  const rounded = value.toDecimalPlaces(MONEY_SCALE, ROUNDING_MODES[rounding]);

  if (rounded.abs().greaterThan(MAX_ABSOLUTE_AMOUNT)) {
    return invalidMoney("amount_out_of_range", "errors.money.amount_out_of_range");
  }

  return success({
    amount: rounded.isZero() ? "0.00" : rounded.toFixed(MONEY_SCALE),
    currency,
  });
}

function parseFactor(value: string) {
  if (!FACTOR_PATTERN.test(value)) {
    return null;
  }

  const decimal = new MoneyDecimal(value);
  return decimal.isFinite() ? decimal : null;
}

export function createMoney(amount: string, currency: string): MoneyResult {
  if (!CURRENCY_PATTERN.test(currency)) {
    return invalidMoney("invalid_currency", "errors.money.invalid_currency");
  }

  if (!MONEY_AMOUNT_PATTERN.test(amount)) {
    return invalidMoney("invalid_amount", "errors.money.invalid_amount");
  }

  const decimal = new MoneyDecimal(amount);

  if (!decimal.isFinite()) {
    return invalidMoney("invalid_amount", "errors.money.invalid_amount");
  }

  return normalizeDecimal(decimal, currency, "half_up");
}

function validateOperand(value: Money): MoneyResult {
  return createMoney(value.amount, value.currency);
}

function validateSameCurrency(first: Money, second: Money): MoneyErrorCode | null {
  return first.currency === second.currency ? null : "currency_mismatch";
}

function combineMoney(
  first: Money,
  second: Money,
  operation: (firstAmount: Decimal, secondAmount: Decimal) => Decimal,
): MoneyResult {
  const normalizedFirst = validateOperand(first);
  if (!normalizedFirst.ok) return normalizedFirst;

  const normalizedSecond = validateOperand(second);
  if (!normalizedSecond.ok) return normalizedSecond;

  if (validateSameCurrency(normalizedFirst.data, normalizedSecond.data)) {
    return invalidMoney("currency_mismatch", "errors.money.currency_mismatch");
  }

  return normalizeDecimal(
    operation(
      new MoneyDecimal(normalizedFirst.data.amount),
      new MoneyDecimal(normalizedSecond.data.amount),
    ),
    normalizedFirst.data.currency,
    "half_up",
  );
}

export function addMoney(first: Money, second: Money): MoneyResult {
  return combineMoney(first, second, (firstAmount, secondAmount) => firstAmount.plus(secondAmount));
}

export function subtractMoney(first: Money, second: Money): MoneyResult {
  return combineMoney(first, second, (firstAmount, secondAmount) =>
    firstAmount.minus(secondAmount),
  );
}

export function multiplyMoney(
  value: Money,
  multiplier: string,
  rounding: MoneyRounding = "half_up",
): MoneyResult {
  const normalized = validateOperand(value);
  if (!normalized.ok) return normalized;

  const factor = parseFactor(multiplier);
  if (!factor) return invalidMoney("invalid_amount", "errors.money.invalid_multiplier");

  return normalizeDecimal(
    new MoneyDecimal(normalized.data.amount).times(factor),
    normalized.data.currency,
    rounding,
  );
}

export function divideMoney(
  value: Money,
  divisor: string,
  rounding: MoneyRounding = "half_up",
): MoneyResult {
  const normalized = validateOperand(value);
  if (!normalized.ok) return normalized;

  const factor = parseFactor(divisor);
  if (!factor) return invalidMoney("invalid_amount", "errors.money.invalid_divisor");
  if (factor.isZero()) return invalidMoney("division_by_zero", "errors.money.division_by_zero");

  return normalizeDecimal(
    new MoneyDecimal(normalized.data.amount).dividedBy(factor),
    normalized.data.currency,
    rounding,
  );
}

export function sumMoney(values: readonly Money[], currency: string): MoneyResult {
  const zero = createMoney("0", currency);
  if (!zero.ok) return zero;

  let total = new MoneyDecimal(0);

  for (const value of values) {
    const normalized = validateOperand(value);
    if (!normalized.ok) return normalized;

    if (normalized.data.currency !== zero.data.currency) {
      return invalidMoney("currency_mismatch", "errors.money.currency_mismatch");
    }

    total = total.plus(normalized.data.amount);
  }

  return normalizeDecimal(total, zero.data.currency, "half_up");
}
