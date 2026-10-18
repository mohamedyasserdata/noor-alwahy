import { z } from "zod";

import { failure, success, type Failure, type FieldErrors, type Result } from "../result";

export type ValidationErrorCode = "validation_error";

type ExpectedActionErrorOptions<TCode extends string> = {
  code: TCode;
  messageKey: string;
  fieldErrors?: FieldErrors;
};

/**
 * Signals an expected business failure inside a safe action. Never put exception messages,
 * database details, secrets, or personal data in these client-visible fields.
 */
export class ExpectedActionError<TCode extends string = string> extends Error {
  readonly code: TCode;
  readonly messageKey: string;
  readonly fieldErrors?: FieldErrors;

  constructor({ code, messageKey, fieldErrors }: ExpectedActionErrorOptions<TCode>) {
    super(code);
    this.name = "ExpectedActionError";
    this.code = code;
    this.messageKey = messageKey;
    this.fieldErrors = fieldErrors;
  }

  toFailure(): Failure<TCode> {
    return failure(this.code, this.messageKey, this.fieldErrors);
  }
}

function normalizeFieldErrors(error: z.ZodError): FieldErrors | undefined {
  const fieldErrors: FieldErrors = {};

  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field !== "string") continue;

    (fieldErrors[field] ??= []).push(issue.message);
  }

  return Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined;
}

function isExpectedActionError<TCode extends string>(
  error: unknown,
): error is ExpectedActionError<TCode> {
  return error instanceof ExpectedActionError;
}

/**
 * Adds Zod validation and the shared Result contract to a Server Action implementation.
 * The handler must still authenticate and authorize every request. Unknown exceptions are
 * deliberately rethrown so Next.js error boundaries and server-side monitoring can handle them.
 */
export function safeAction<TSchema extends z.ZodType, TData, TCode extends string = never>(
  schema: TSchema,
  handler: (input: z.output<TSchema>) => TData | Promise<TData>,
) {
  return async (input: z.input<TSchema>): Promise<Result<TData, TCode | ValidationErrorCode>> => {
    const parsed = await schema.safeParseAsync(input);

    if (!parsed.success) {
      return failure("validation_error", "errors.validation", normalizeFieldErrors(parsed.error));
    }

    try {
      return success(await handler(parsed.data));
    } catch (error) {
      if (isExpectedActionError<TCode>(error)) {
        return error.toFailure();
      }

      throw error;
    }
  };
}
