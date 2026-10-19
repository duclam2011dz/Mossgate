export class Viewport {
  static createViewport(this: void, width: number, height: number, dpr = 1) {
    const cssWidth = Math.max(1, width),
      cssHeight = Math.max(1, height);
    const density = Math.min(4, (cssHeight * Math.max(1, dpr)) / 180);
    const view = { width: (180 * cssWidth) / cssHeight, height: 180 };
    return {
      ...view,
      bufferWidth: Math.max(1, Math.round(view.width * density)),
      bufferHeight: Math.max(1, Math.round(view.height * density)),
    };
  }
}
export const createViewport = Viewport.createViewport;
