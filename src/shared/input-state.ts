import type { Input } from '../domain/contracts.ts';
export class InputState {
  static empty(this: void): Input {
    return {
      axis: 0,
      jumpPressed: false,
      jumpHeld: false,
      dashPressed: false,
      sneak: false,
      down: false,
    };
  }
}
export const emptyInput = InputState.empty;
