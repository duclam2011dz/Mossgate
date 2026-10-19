export type TileId =
  0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12 | 13 | 14;
export type TileKind = 'empty' | 'solid' | 'hazard' | 'oneway';
export interface Point {
  x: number;
  y: number;
}
export type PointTuple = [number, number];
export interface Box extends Point {
  w: number;
  h: number;
}
export interface TileProperties {
  speed: number;
  acceleration: number;
  friction: number;
  springForce: number;
  conveyor: number;
  hazard: boolean;
  breakable: boolean;
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  effectsColor: string;
  effectsIntensity: number;
  safeTime: number;
  warningTime: number;
  activeTime: number;
  delay: number;
  downtime: number;
  phase: number;
}
export type PropertyPatch = Partial<TileProperties>;
export type PropertyName = keyof TileProperties;
export interface Checkpoint {
  id: string;
  type: 'checkpoint';
  position: PointTuple;
}
export interface Saw {
  id: string;
  type: 'saw';
  path: PointTuple[];
  speed: number;
  radius: number;
  mode: 'loop' | 'ping-pong';
  phase: number;
}
export type Entity = Saw | Checkpoint;
export interface DraftMap {
  width: number;
  height: number;
  tiles: TileId[][];
  spawn: Point | null;
  portal: Box | null;
  deathY: number;
  tileDefaults?: Record<string, PropertyPatch>;
  cellOverrides?: Record<string, PropertyPatch>;
  entities?: Entity[];
  propertyRevision?: number;
}
export interface PlayableMap extends DraftMap {
  spawn: Point;
  portal: Box;
}
export type RectangleTuple = [number, number, number, number, TileId];
export interface WireMap {
  version: 1 | 2 | 3;
  size: PointTuple;
  spawn: PointTuple | null;
  portal: [number, number, number, number] | null;
  deathY: number;
  rects: RectangleTuple[];
  tileDefaults?: Record<string, PropertyPatch>;
  cellOverrides?: [number, number, PropertyPatch][];
  entities?: Entity[];
}
export interface Input {
  axis: number;
  jumpPressed: boolean;
  jumpHeld: boolean;
  dashPressed: boolean;
  sneak: boolean;
  down: boolean;
}
export interface CrumbleState {
  start: number;
  missing: boolean;
  returnAt?: number;
}
export type EventType =
  | 'break'
  | 'death'
  | 'jump'
  | 'dash'
  | 'land'
  | 'spring'
  | 'step'
  | 'checkpoint'
  | 'complete';
export type GameplayEvent = {
  [K in EventType]: {
    type: K;
    id: number;
    x: number;
    y: number;
    facing?: number;
    key?: number;
    properties?: Readonly<TileProperties>;
  };
}[EventType];
export interface TileContact extends Box {
  props: Readonly<TileProperties>;
  id: TileId;
  key: number;
  col: number;
  row: number;
}
export interface CollisionRuntime {
  broken: Set<number>;
  crumble: Map<number, CrumbleState>;
  trapTime: number;
  events: GameplayEvent[];
}
