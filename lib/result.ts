export type FieldErrors = Record<string, string[]>;

export type Success<T> = {
  ok: true;
  data: T;
};

export type Failure<TCode extends string = string> = {
  ok: false;
  code: TCode;
  message_key: string;
  fieldErrors?: FieldErrors;
};

export type Result<T, TCode extends string = string> = Success<T> | Failure<TCode>;

export function success<T>(data: T): Success<T> {
  return { ok: true, data };
}

export function failure<TCode extends string>(
  code: TCode,
  messageKey: string,
  fieldErrors?: FieldErrors,
): Failure<TCode> {
  return fieldErrors
    ? { ok: false, code, message_key: messageKey, fieldErrors }
    : { ok: false, code, message_key: messageKey };
}
