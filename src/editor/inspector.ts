import { entityFits, translateEntity } from '../domain/entity-geometry.ts';
import {
  enemyStats,
  enemyOverrideLimits,
} from '../domain/enemy-definitions.ts';
import type { EnemyOverrides } from '../domain/contracts.ts';
import { tiles } from '../domain/tiles.ts';
import {
  baseProperties,
  fieldsFor,
  properties,
  validatePatch,
  sparsePatch,
  invalidateProperties,
} from '../domain/properties.ts';
import { validateEntities } from '../domain/entities.ts';
import type {
  Entity,
  TileProperties,
  PropertyName,
  PropertyPatch,
  Point,
} from '../domain/contracts.ts';
import type { EditorModel } from './model.ts';
import type { InspectorTarget, Anchor } from './contracts.ts';
import type { Assets } from '../infrastructure/assets.ts';
import { Dom } from '../infrastructure/dom.ts';
import { Guards } from '../shared/guards.ts';
interface InspectorOptions {
  root: HTMLElement;
  assets: Assets;
  getModel: () => EditorModel;
  project: (x: number, y: number) => Anchor;
  onChange: (changed?: boolean) => void;
  signal: AbortSignal;
}
export class TileInspector {
  readonly root: HTMLElement;
  readonly assets: Assets;
  readonly getModel: () => EditorModel;
  readonly project: InspectorOptions['project'];
  readonly onChange: InspectorOptions['onChange'];
  readonly signal: AbortSignal;
  readonly host = document.createElement('aside');
  selectionTarget: InspectorTarget | null = null;
  expanded = false;
  hasPendingChanges = false;
  reset = false;
  draft: TileProperties = baseProperties(0);
  entityDraft: Entity | null = null;
  returnFocus: HTMLElement | null = null;
  constructor({
    root,
    assets,
    getModel,
    project,
    onChange,
    signal,
  }: InspectorOptions) {
    this.root = root;
    this.assets = assets;
    this.getModel = getModel;
    this.project = project;
    this.onChange = onChange;
    this.signal = signal;
    this.host.className = 'inspector';
    this.host.hidden = true;
    this.host.setAttribute('aria-label', 'Tile inspector');
    Dom.require(root, '.editor', HTMLElement).append(this.host);
    this.host.addEventListener(
      'input',
      (e) => {
        if (
          !(e.target instanceof HTMLInputElement) ||
          e.target.matches('[aria-label="Property scope"]')
        )
          return;
        this.hasPendingChanges = true;
        this.reset = false;
        this.collect();
      },
      { signal },
    );
    this.host.addEventListener(
      'change',
      async (e) => {
        if (!(e.target instanceof HTMLSelectElement)) return;
        if (e.target.matches('[aria-label="Property scope"]')) {
          const scope = e.target.value;
          if (
            (scope === 'cell' || scope === 'type') &&
            (await this.ask()) &&
            this.selectionTarget?.kind === 'tile'
          ) {
            this.selectionTarget.scope = scope;
            this.load();
          }
          this.render();
        } else if (e.target.matches('[data-facing]')) {
          this.collect();
          this.hasPendingChanges = true;
        } else if (e.target.matches('[data-direction]')) {
          this.collect();
          this.draft.conveyor =
            Math.abs(this.draft.conveyor) * Number(e.target.value);
          this.hasPendingChanges = true;
          this.render();
        }
      },
      { signal },
    );
    this.host.addEventListener(
      'click',
      (e) => {
        if (!(e.target instanceof Element)) return;
        const target = e.target;
        if (target.closest('[data-close]')) this.close();
        else if (target.closest('[data-apply]')) this.apply();
        else if (target.closest('[data-cancel]')) {
          this.load();
          this.render();
        } else if (target.closest('[data-reset]')) {
          this.draft = this.inherited();
          this.hasPendingChanges = true;
          this.reset = true;
          this.render();
        } else if (target.closest('[data-expand]')) {
          this.collect();
          this.expanded = !this.expanded;
          this.render();
          Dom.require(this.host, '[data-expand]', HTMLButtonElement).focus();
        } else if (target.closest('[data-duplicate]') && this.entityDraft) {
          if (this.hasPendingChanges) {
            this.error('Apply or cancel changes before duplicating.');
            return;
          }
          const model = this.getModel(),
            entity = translateEntity(this.entityDraft, 16, 0);
          let n = 1;
          const prefix = entity.id.slice(0, 48);
          while (
            model.level.entities?.some((e) => e.id === `${prefix}-copy-${n}`)
          )
            n++;
          entity.id = `${prefix}-copy-${n}`;
          if (!entityFits(entity, model.level.width, model.level.height)) {
            this.error('The complete entity must fit inside the map.');
            return;
          }
          try {
            const list = validateEntities(
              [...(model.level.entities ?? []), entity],
              model.level.width,
              model.level.height,
            );
            model.begin();
            model.level.entities = list;
            model.commit();
            this.onChange();
          } catch (error) {
            this.error(Guards.error(error));
          }
        } else if (target.closest('[data-add-enemy-point]')) {
          this.collect();
          const draft = this.entityDraft;
          if (
            draft?.type === 'enemy' &&
            enemyStats(draft).flying &&
            draft.patrol.length < 16
          ) {
            const last = draft.patrol.at(-1);
            if (last) draft.patrol.push([...last]);
            this.hasPendingChanges = true;
            this.render();
          }
        } else if (target.closest('[data-remove-enemy-point]')) {
          this.collect();
          const draft = this.entityDraft;
          if (draft?.type === 'enemy' && draft.patrol.length > 2) {
            draft.patrol.splice(
              Number(
                target.closest<HTMLElement>('[data-remove-enemy-point]')
                  ?.dataset.removeEnemyPoint,
              ),
              1,
            );
            this.hasPendingChanges = true;
            this.render();
          }
        } else if (target.closest('[data-add-point]')) {
          this.collect();
          const draft = this.entityDraft;
          if (draft?.type === 'saw' && draft.path.length < 32) {
            const last = draft.path.at(-1);
            if (last) {
              draft.path.push([
                Math.min(this.getLevel().width * 16 - 16, last[0] + 16),
                last[1],
              ]);
              this.hasPendingChanges = true;
              this.render();
            }
          }
        } else if (target.closest('[data-remove]')) {
          this.collect();
          const draft = this.entityDraft;
          if (draft?.type === 'saw' && draft.path.length > 2) {
            draft.path.splice(
              Number(
                target.closest<HTMLElement>('[data-remove]')?.dataset.remove,
              ),
              1,
            );
            this.hasPendingChanges = true;
            this.render();
          }
        } else if (
          target.closest('[data-delete]') &&
          this.selectionTarget?.kind === 'entity'
        ) {
          const id = this.selectionTarget.entity,
            model = this.getModel();
          model.begin();
          model.level.entities = (model.level.entities ?? []).filter(
            (e) => e.id !== id,
          );
          model.commit();
          this.close();
          this.onChange();
        }
      },
      { signal },
    );
    this.host.addEventListener(
      'keydown',
      (e) => {
        e.stopPropagation();
        if (e.code === 'Escape') {
          e.preventDefault();
          this.close();
        }
      },
      { signal },
    );
  }
  getLevel = () => this.getModel().level;
  guard = () => this.ask();
  get pending() {
    return this.hasPendingChanges;
  }
  get target() {
    return this.selectionTarget;
  }
  get previewEntity(): Entity | null {
    if (this.selectionTarget?.kind !== 'entity' || !this.hasPendingChanges)
      return null;
    try {
      return (
        validateEntities(
          [this.entityDraft],
          this.getLevel().width,
          this.getLevel().height,
        )[0] ?? null
      );
    } catch {
      return null;
    }
  }
  async openTile(id: number, cell: Point, source?: HTMLElement) {
    if (!id || !tiles[id] || !(await this.ask())) return false;
    this.returnFocus =
      source ?? Dom.require(this.root, '#editor-canvas', HTMLCanvasElement);
    this.selectionTarget = { kind: 'tile', id, scope: 'cell', ...cell };
    this.load();
    this.render();
    Dom.require(this.host, 'select', HTMLSelectElement).focus();
    return true;
  }
  async openEntity(id: string) {
    if (!(await this.ask())) return;
    this.selectionTarget = { kind: 'entity', entity: id };
    this.returnFocus = Dom.require(
      this.root,
      '#editor-canvas',
      HTMLCanvasElement,
    );
    this.load();
    this.render();
    this.host.querySelector<HTMLElement>('input,select,button')?.focus();
  }
  refresh() {
    if (this.selectionTarget && !this.hasPendingChanges) {
      this.load();
      this.render();
    }
  }
  dispose() {
    this.host.remove();
  }
  inherited(): TileProperties {
    const target = this.selectionTarget;
    if (target?.kind !== 'tile') return baseProperties(0);
    return target.scope === 'type'
      ? baseProperties(target.id)
      : {
          ...baseProperties(target.id),
          ...this.getLevel().tileDefaults?.[target.id],
        };
  }
  currentPatch(): PropertyPatch {
    const target = this.selectionTarget;
    if (target?.kind !== 'tile') return {};
    return (
      (target.scope === 'type'
        ? this.getLevel().tileDefaults?.[target.id]
        : this.getLevel().cellOverrides?.[`${target.x},${target.y}`]) ?? {}
    );
  }
  load() {
    this.reset = false;
    this.hasPendingChanges = false;
    const target = this.selectionTarget;
    if (target?.kind === 'entity') {
      const entity = this.getLevel().entities?.find(
        (e) => e.id === target.entity,
      );
      this.entityDraft = entity ? structuredClone(entity) : null;
    } else {
      this.entityDraft = null;
      this.draft = { ...this.inherited(), ...this.currentPatch() };
    }
  }
  collect() {
    for (const input of this.host.querySelectorAll<HTMLInputElement>(
      '[data-field]',
    )) {
      const name = input.dataset.field;
      if (!name) continue;
      if (this.selectionTarget?.kind === 'tile') {
        if (!Object.hasOwn(properties, name)) continue;
        const value =
          input.type === 'checkbox'
            ? input.checked
            : input.type === 'color'
              ? input.value
              : Number(input.value);
        // The field name is from the property descriptor whitelist; Apply validates values atomically.
        this.draft = { ...this.draft, [name]: value };
      } else if (this.entityDraft?.type === 'saw') {
        if (name === 'speed' || name === 'radius' || name === 'phase')
          this.entityDraft[name] = Number(input.value);
      }
    }
    const entity = this.entityDraft;
    if (entity?.type === 'saw') {
      const rows = [...this.host.querySelectorAll('[data-waypoint]')];
      if (rows.length)
        entity.path = rows.map((row) => [
          Number(Dom.require(row, '[data-x]', HTMLInputElement).value),
          Number(Dom.require(row, '[data-y]', HTMLInputElement).value),
        ]);
      const mode =
        this.host.querySelector<HTMLSelectElement>('[data-mode]')?.value;
      if (mode === 'loop' || mode === 'ping-pong') entity.mode = mode;
    } else if (entity?.type === 'enemy') {
      const row = this.host.querySelector('[data-spawn]');
      if (row)
        entity.spawn = [
          Number(Dom.require(row, '[data-x]', HTMLInputElement).value),
          Number(Dom.require(row, '[data-y]', HTMLInputElement).value),
        ];
      entity.facing =
        this.host.querySelector<HTMLSelectElement>('[data-facing]')?.value ===
        '-1'
          ? -1
          : 1;
      entity.patrol = [...this.host.querySelectorAll('[data-enemy-point]')].map(
        (point) => [
          Number(Dom.require(point, '[data-x]', HTMLInputElement).value),
          Number(Dom.require(point, '[data-y]', HTMLInputElement).value),
        ],
      );
      const overrides: EnemyOverrides = {};
      for (const input of this.host.querySelectorAll<HTMLInputElement>(
        '[data-enemy-field]',
      )) {
        const key = input.dataset.enemyField;
        if (key && Object.hasOwn(enemyOverrideLimits, key))
          overrides[key as keyof EnemyOverrides] = Number(input.value);
      }
      entity.overrides = overrides;
    } else if (entity?.type === 'checkpoint') {
      const row = this.host.querySelector('[data-position]');
      if (row)
        entity.position = [
          Number(Dom.require(row, '[data-x]', HTMLInputElement).value),
          Number(Dom.require(row, '[data-y]', HTMLInputElement).value),
        ];
    }
  }
  error(message: string) {
    Dom.require(this.host, '[role="status"]', HTMLElement).textContent =
      message;
  }
  apply = () => {
    const target = this.selectionTarget;
    if (!target) return true;
    this.collect();
    const model = this.getModel(),
      level = model.level;
    try {
      if (target.kind === 'entity') {
        const list = validateEntities(
          (level.entities ?? []).map((e) =>
            e.id === target.entity ? this.entityDraft : e,
          ),
          level.width,
          level.height,
        );
        model.begin();
        level.entities = list;
      } else {
        const patch = this.reset
          ? {}
          : sparsePatch(
              target.id,
              Object.fromEntries(
                fieldsFor(target.id).map((name) => [name, this.draft[name]]),
              ),
              this.inherited(),
            );
        validatePatch(target.id, patch, this.inherited());
        if (target.scope === 'type')
          for (const [key, cellPatch] of Object.entries(
            level.cellOverrides ?? {},
          )) {
            const [x = -1, y = -1] = key.split(',').map(Number);
            if (level.tiles[y]?.[x] === target.id)
              validatePatch(target.id, cellPatch, {
                ...baseProperties(target.id),
                ...patch,
              });
          }
        model.begin();
        const key =
            target.scope === 'type'
              ? String(target.id)
              : `${target.x},${target.y}`,
          field = target.scope === 'type' ? 'tileDefaults' : 'cellOverrides';
        const patches = (level[field] ??= {});
        if (Object.keys(patch).length) patches[key] = patch;
        else delete patches[key];
      }
      invalidateProperties(level);
      model.commit();
      this.load();
      this.render();
      this.onChange();
      return true;
    } catch (error) {
      this.error(Guards.error(error));
      return false;
    }
  };
  ask(): Promise<boolean> {
    if (!this.hasPendingChanges) return Promise.resolve(true);
    return new Promise<boolean>((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'decision';
      dialog.innerHTML =
        '<h2>Unapplied changes</h2><p>Apply your changes before continuing?</p><div><button data-choice="apply">Apply</button><button data-choice="discard">Discard</button><button data-choice="cancel">Cancel</button></div>';
      this.root.append(dialog);
      const done = (choice: string) => {
        if (choice === 'apply' && !this.apply()) return;
        this.hasPendingChanges = choice === 'cancel';
        dialog.close();
        dialog.remove();
        resolve(choice !== 'cancel');
      };
      dialog.addEventListener('click', (e) => {
        const choice =
          e.target instanceof Element
            ? e.target.closest<HTMLElement>('[data-choice]')?.dataset.choice
            : undefined;
        if (choice) done(choice);
      });
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        done('cancel');
      });
      dialog.showModal();
      Dom.require(dialog, 'button', HTMLButtonElement).focus();
    });
  }
  close = () => {
    this.host.hidden = true;
    Dom.require(this.root, '.editor', HTMLElement).classList.remove(
      'has-inspector',
    );
    this.selectionTarget = null;
    this.hasPendingChanges = false;
    this.expanded = false;
    this.returnFocus?.focus({ preventScroll: true });
    this.onChange(false);
  };
  position = () => {
    const target = this.selectionTarget;
    if (!target || (this.host.hidden && this.expanded)) return;
    if (this.expanded) {
      this.host.hidden = false;
      this.host.style.left = '';
      this.host.style.top = '';
      return;
    }
    let rect: Anchor;
    if (target.kind === 'entity') {
      const entity = this.getLevel().entities?.find(
          (e) => e.id === target.entity,
        ),
        p =
          entity?.type === 'saw'
            ? entity.path[0]
            : entity?.type === 'enemy'
              ? entity.spawn
              : entity?.position;
      if (!p) {
        this.close();
        return;
      }
      rect = this.project(p[0] / 16, p[1] / 16);
    } else rect = this.project(target.x, target.y);
    const workspace = Dom.require(
      this.root,
      '.workspace',
      HTMLElement,
    ).getBoundingClientRect();
    if (
      rect.right < workspace.left ||
      rect.left > workspace.right ||
      rect.bottom < workspace.top ||
      rect.top > workspace.bottom
    ) {
      this.host.hidden = true;
      return;
    }
    this.host.hidden = false;
    const width = this.host.offsetWidth,
      height = this.host.offsetHeight;
    let x = rect.right + 10;
    if (x + width > innerWidth - 10) x = rect.left - width - 10;
    this.host.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, x))}px`;
    this.host.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, rect.top))}px`;
  };
  field = (name: PropertyName) => {
    const target = this.selectionTarget;
    if (target?.kind !== 'tile') return '';
    const p = properties[name],
      value = this.draft[name],
      source = Object.hasOwn(this.currentPatch(), name)
        ? target.scope === 'cell'
          ? 'Cell override'
          : 'Map override'
        : target.scope === 'cell' &&
            Object.hasOwn(this.getLevel().tileDefaults?.[target.id] ?? {}, name)
          ? 'Map default'
          : 'Registry';
    return `<label class="property-field"><span>${p.label}<small>${source}</small></span><input data-field="${name}" aria-label="${p.label}" type="${p.type === 'boolean' ? 'checkbox' : p.type === 'color' ? 'color' : 'number'}" ${p.type === 'boolean' ? (value ? 'checked' : '') : `value="${value}"`} ${'min' in p ? `min="${p.min}" max="${p.max}" step="${p.step}"` : ''}></label>`;
  };
  entityForm() {
    const draft = this.entityDraft;
    if (!draft) return '';
    if (draft.type === 'checkpoint')
      return `<p class="property-help">Respawn feet position</p><div data-position class="point-row"><label>X<input data-x type="number" step="8" aria-label="Checkpoint X" value="${draft.position[0]}"></label><label>Y<input data-y type="number" step="8" aria-label="Checkpoint Y" value="${draft.position[1]}"></label></div>`;
    if (draft.type === 'enemy') {
      const stats = enemyStats(draft);
      return `<p class="property-help">${stats.name} | ${stats.attack} | ${stats.flying ? 'Flying' : 'Ground'} | ${stats.w}x${stats.h} | ${stats.windup}s windup | ${stats.flying ? '270' : '120'} degrees vision</p>
        <label>Facing<select data-facing><option value="1" ${draft.facing === 1 ? 'selected' : ''}>Right</option><option value="-1" ${draft.facing === -1 ? 'selected' : ''}>Left</option></select></label>
        <div data-spawn class="point-row"><label>Spawn X<input data-x type="number" value="${draft.spawn[0]}"></label><label>Spawn Y<input data-y type="number" value="${draft.spawn[1]}"></label></div>
        ${Object.entries(enemyOverrideLimits)
          .map(([key, limits]) => {
            const name = key as keyof EnemyOverrides;
            return `<label>${key}<input data-enemy-field="${key}" type="number" min="${limits[0]}" max="${limits[1]}" step="0.05" value="${stats[name]}"></label>`;
          })
          .join('')}
        <h3>Patrol</h3>${draft.patrol.map(([x, y], i) => `<div data-enemy-point class="point-row"><label>X ${i + 1}<input data-x type="number" value="${x}"></label><label>Y ${i + 1}<input data-y type="number" value="${y}"></label>${stats.flying ? `<button data-remove-enemy-point="${i}" aria-label="Remove patrol point ${i + 1}">X</button>` : ''}</div>`).join('')}${stats.flying ? '<button data-add-enemy-point>Add patrol point</button>' : ''}`;
    }
    const fields: [
      'speed' | 'radius' | 'phase',
      string,
      number,
      number,
      number,
    ][] = [
      ['speed', 'Saw speed', 16, 240, 1],
      ['radius', 'Saw radius', 4, 12, 1],
      ['phase', 'Saw phase', 0, 1, 0.05],
    ];
    return `<label>Mode<select data-mode aria-label="Saw mode"><option value="ping-pong" ${draft.mode === 'ping-pong' ? 'selected' : ''}>Ping-pong</option><option value="loop" ${draft.mode === 'loop' ? 'selected' : ''}>Loop</option></select></label>${fields.map(([name, label, min, max, step]) => `<label class="property-field">${label}<input data-field="${name}" aria-label="${label}" type="number" value="${draft[name]}" min="${min}" max="${max}" step="${step}"></label>`).join('')}${this.expanded ? `<h3>Waypoints</h3>${draft.path.map(([x, y], i) => `<div data-waypoint="${i}" class="point-row"><span>${i + 1}</span><label>X<input data-x type="number" step="16" value="${x}" aria-label="Waypoint ${i + 1} X"></label><label>Y<input data-y type="number" step="16" value="${y}" aria-label="Waypoint ${i + 1} Y"></label><button data-remove="${i}" aria-label="Remove waypoint ${i + 1}">X</button></div>`).join('')}<button data-add-point>Add waypoint</button>` : ''}`;
  }
  render() {
    const target = this.selectionTarget;
    if (!target) return;
    if (
      target.kind === 'entity' &&
      !this.getLevel().entities?.some((e) => e.id === target.entity)
    ) {
      this.close();
      return;
    }
    const tile = target.kind === 'tile' ? tiles[target.id] : undefined;
    this.host.classList.toggle('expanded', this.expanded);
    Dom.require(this.root, '.editor', HTMLElement).classList.toggle(
      'has-inspector',
      this.expanded,
    );
    this.host.hidden = false;
    const names = target.kind === 'tile' ? fieldsFor(target.id) : [],
      shown = this.expanded
        ? names
        : names
            .filter(
              (n) =>
                ![
                  'offsetX',
                  'offsetY',
                  'width',
                  'height',
                  'effectsColor',
                ].includes(n),
            )
            .slice(0, 3);
    const title =
      target.kind === 'entity'
        ? this.entityDraft?.type === 'saw'
          ? 'Moving saw'
          : this.entityDraft?.type === 'enemy'
            ? enemyStats(this.entityDraft).name
            : 'Checkpoint'
        : (tile?.name ?? '');
    this.host.innerHTML = `<div class="inspector-heading"><div>${tile ? `<img alt="" src="${this.assets[tile.asset ?? '']?.src ?? ''}">` : ''}<h2>${title}</h2></div><button data-close aria-label="Close inspector">Close</button></div><div class="inspector-content">${target.kind === 'entity' ? `<p class="property-help">${target.entity}</p>${this.entityForm()}` : `<label class="scope-label">Scope<select aria-label="Property scope"><option value="type" ${target.scope === 'type' ? 'selected' : ''}>Tile type in this map</option><option value="cell" ${target.scope === 'cell' ? 'selected' : ''}>This cell</option></select></label>${this.expanded ? `<p class="property-help">ID ${target.id} | ${tile?.kind} | ${tile?.asset}.png | Cell ${target.x}, ${target.y}</p>` : ''}${shown.map(this.field).join('')}${[9, 10].includes(target.id) && this.expanded ? '<label>Direction<select aria-label="Conveyor direction" data-direction><option value="-1">Left</option><option value="1">Right</option></select></label>' : ''}${this.expanded ? '<p class="property-help">Changing the hitbox can make collision differ from the sprite.</p>' : ''}`}
  <p role="status" class="property-error"></p></div><div class="inspector-actions"><button data-apply class="primary">Apply</button><button data-cancel>Cancel</button>${target.kind === 'entity' ? '<button data-duplicate>Duplicate</button><button data-delete>Delete</button>' : '<button data-reset>Reset</button>'}</div><button class="show-more" data-expand>${this.expanded ? 'Show less' : 'Show more...'}</button>`;
    const direction =
      this.host.querySelector<HTMLSelectElement>('[data-direction]');
    if (direction) direction.value = this.draft.conveyor < 0 ? '-1' : '1';
    this.position();
  }
}
export const createInspector = (
  ...args: ConstructorParameters<typeof TileInspector>
) => new TileInspector(...args);
