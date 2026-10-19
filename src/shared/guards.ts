export class Guards {
  static record(this: void, value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  static number(this: void, value: unknown): value is number {
    return typeof value === 'number' && Number.isFinite(value);
  }
  static tuple2(this: void, value: unknown): value is [number, number] {
    return (
      Array.isArray(value) && value.length === 2 && value.every(Guards.number)
    );
  }
  static tuple4(
    this: void,
    value: unknown,
  ): value is [number, number, number, number] {
    return (
      Array.isArray(value) && value.length === 4 && value.every(Guards.number)
    );
  }
  static tuple5(
    this: void,
    value: unknown,
  ): value is [number, number, number, number, number] {
    return (
      Array.isArray(value) && value.length === 5 && value.every(Guards.number)
    );
  }
  static error(this: void, error: unknown): string {
    return error instanceof Error ? error.message : String(error);
  }
}
