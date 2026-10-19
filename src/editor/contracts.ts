import type { Point, Box } from '../domain/contracts.ts';
import type { Clipboard } from './model.ts';
export type PaintTool =
  'brush' | 'erase' | 'fill' | 'rectangle' | 'select' | 'spawn' | 'portal';
export type Tool = PaintTool | 'inspect' | 'saw' | 'checkpoint';
export type Gesture =
  | { type: PaintTool; start: Point; last: Point; end: Point }
  | { type: 'move'; start: Point; source: Box }
  | { type: 'waypoint'; id: string; index: number };
export interface Floating {
  data: Clipboard;
  x: number;
  y: number;
  source?: Box;
}
export interface Anchor {
  left: number;
  right: number;
  top: number;
  bottom: number;
}
export type InspectorTarget =
  | {
      kind: 'tile';
      id: number;
      scope: 'cell' | 'type';
      x: number;
      y: number;
      entity?: never;
    }
  | {
      kind: 'entity';
      entity: string;
      id?: never;
      scope?: never;
      x?: never;
      y?: never;
    };
