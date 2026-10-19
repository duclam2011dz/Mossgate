export class Dom {
  static require<T extends Element>(
    root: ParentNode,
    selector: string,
    kind: { new (): T },
  ): T {
    const element = root.querySelector(selector);
    if (!(element instanceof kind)) throw new Error(`Missing ${selector}`);
    return element;
  }
  static context(
    this: void,
    canvas: HTMLCanvasElement,
  ): CanvasRenderingContext2D {
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Canvas 2D is unavailable.');
    return context;
  }
}
