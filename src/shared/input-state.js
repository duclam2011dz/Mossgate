export class InputState {
  static empty() {
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
