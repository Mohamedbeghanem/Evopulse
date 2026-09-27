/** Deep-clone a value into JSON-safe objects with a normal prototype. */
export function toPlain<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return JSON.parse(JSON.stringify(value)) as T;
}
