import type { GameSimulation } from '../simulation/game-simulation.ts';
import type { Point, DraftMap, Box, Input } from '../domain/contracts.ts';
import type { AnimationSnapshot } from '../rendering/animation.ts';
import type { Tool } from '../editor/contracts.ts';
export interface GameSnapshot {
  run: Omit<GameSimulation, 'step'>;
  camera: Point;
  viewport: {
    width: number;
    height: number;
    bufferWidth: number;
    bufferHeight: number;
  };
  anim: AnimationSnapshot;
  effects: { particles: number; ghosts: number; shake: number };
}
export interface GameTestHooks {
  input: { read(): Input };
  snapshot(): GameSnapshot;
  teleport(x: number, y: number): void;
  advance(frames: number, controls?: Partial<Input>): void;
  restart(): void;
}
export interface EditorSnapshot {
  level: DraftMap;
  camera: Point;
  zoom: number;
  dirty: boolean;
  history: number;
  future: number;
  tool: Tool;
  selection: Box | null;
}
export type AppTestHooks =
  { route: 'menu' | 'play' } | { route: 'editor'; editor(): EditorSnapshot };
declare global {
  interface Window {
    __game: GameTestHooks;
    __app: AppTestHooks;
  }
}
