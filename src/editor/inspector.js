import { tiles } from '../domain/tiles.js';
import {
  baseProperties,
  fieldsFor,
  properties,
  validatePatch,
  sparsePatch,
  invalidateProperties,
} from '../domain/properties.js';
import { validateEntities } from '../domain/entities.js';
export class TileInspector {
  constructor({ root, assets, getModel, project, onChange, signal }) {
    const self = this;
    self.root = root;
    self.assets = assets;
    self.getModel = getModel;
    self.project = project;
    self.onChange = onChange;
    self.signal = signal;
    self.host = document.createElement('aside');
    self.host.className = 'inspector';
    self.host.hidden = true;
    self.host.setAttribute('aria-label', 'Tile inspector');
    self.root.querySelector('.editor').append(self.host);
    self.selectionTarget = null;
    self.expanded = false;
    self.hasPendingChanges = false;
    self.draft = {};
    self.reset = false;
    self.anchor = null;
    self.returnFocus = null;
    self.getLevel = () => self.getModel().level;
    self.host.addEventListener(
      'input',
      (e) => {
        if (e.target.matches('[aria-label="Property scope"]')) return;
        self.hasPendingChanges = true;
        self.reset = false;
        self.collect();
      },
      { signal: self.signal },
    );
    self.host.addEventListener(
      'change',
      async (e) => {
        if (e.target.matches('[aria-label="Property scope"]')) {
          const scope = e.target.value;
          if (await self.ask()) {
            self.selectionTarget.scope = scope;
            self.load();
          }
          self.render();
        } else if (e.target.matches('[data-direction]')) {
          self.collect();
          self.draft.conveyor =
            Math.abs(self.draft.conveyor) * Number(e.target.value);
          self.hasPendingChanges = true;
          self.render();
        }
      },
      { signal: self.signal },
    );
    self.host.addEventListener(
      'click',
      (e) => {
        if (e.target.closest('[data-close]')) self.close();
        else if (e.target.closest('[data-apply]')) self.apply();
        else if (e.target.closest('[data-cancel]')) {
          self.load();
          self.render();
        } else if (e.target.closest('[data-reset]')) {
          self.draft = { ...self.inherited() };
          self.hasPendingChanges = true;
          self.reset = true;
          self.render();
        } else if (e.target.closest('[data-expand]')) {
          self.collect();
          self.expanded = !self.expanded;
          self.render();
          self.host.querySelector('[data-expand]').focus();
        } else if (e.target.closest('[data-add-point]')) {
          self.collect();
          if (self.draft.path.length < 32) {
            const last = self.draft.path.at(-1);
            self.draft.path.push([
              Math.min(self.getLevel().width * 16 - 16, last[0] + 16),
              last[1],
            ]);
            self.hasPendingChanges = true;
            self.render();
          }
        } else if (e.target.closest('[data-remove]')) {
          self.collect();
          if (self.draft.path.length > 2) {
            self.draft.path.splice(
              Number(e.target.closest('[data-remove]').dataset.remove),
              1,
            );
            self.hasPendingChanges = true;
            self.render();
          }
        } else if (e.target.closest('[data-delete]')) {
          const model = self.getModel();
          model.begin();
          model.level.entities = model.level.entities.filter(
            (entity) => entity.id !== self.selectionTarget.entity,
          );
          model.commit();
          self.close();
          self.onChange();
        }
      },
      { signal: self.signal },
    );
    self.host.addEventListener(
      'keydown',
      (e) => {
        e.stopPropagation();
        if (e.code === 'Escape') {
          e.preventDefault();
          self.close();
        }
      },
      { signal: self.signal },
    );
    Object.defineProperties(
      this,
      Object.getOwnPropertyDescriptors({
        guard: self.ask,
        close: self.close,
        position: self.position,
        get pending() {
          return self.hasPendingChanges;
        },
        get target() {
          return self.selectionTarget;
        },
        get previewEntity() {
          if (!self.selectionTarget?.entity || !self.hasPendingChanges)
            return null;
          try {
            validateEntities(
              [self.draft],
              self.getLevel().width,
              self.getLevel().height,
            );
            return self.draft;
          } catch {
            return null;
          }
        },
        async openTile(id, cell, source) {
          if (!id || !(await self.ask())) return false;
          self.returnFocus =
            source || self.root.querySelector('#editor-canvas');
          self.anchor = source;
          self.selectionTarget = {
            id,
            scope: cell ? 'cell' : 'type',
            ...(cell || {}),
          };
          self.load();
          self.render();
          self.host.querySelector('select').focus();
          return true;
        },
        async openEntity(id) {
          if (!(await self.ask())) return;
          self.selectionTarget = { entity: id };
          self.returnFocus = self.root.querySelector('#editor-canvas');
          self.load();
          self.render();
          self.host.querySelector('input,select,button')?.focus();
        },
        refresh() {
          if (self.selectionTarget && !self.hasPendingChanges) {
            self.load();
            self.render();
          }
        },
        dispose() {
          self.host.remove();
        },
      }),
    );
  }
  inherited = () => {
    const self = this;

    const l = self.getLevel();
    return self.selectionTarget.scope === 'type'
      ? baseProperties(self.selectionTarget.id)
      : {
          ...baseProperties(self.selectionTarget.id),
          ...(l.tileDefaults?.[self.selectionTarget.id] || {}),
        };
  };
  currentPatch = () => {
    const self = this;

    const l = self.getLevel();
    return self.selectionTarget.scope === 'type'
      ? l.tileDefaults?.[self.selectionTarget.id] || {}
      : l.cellOverrides?.[
          `${self.selectionTarget.x},${self.selectionTarget.y}`
        ] || {};
  };
  load = () => {
    const self = this;

    self.reset = false;
    self.hasPendingChanges = false;
    self.draft = self.selectionTarget.entity
      ? structuredClone(
          self
            .getLevel()
            .entities.find((e) => e.id === self.selectionTarget.entity),
        )
      : { ...self.inherited(), ...self.currentPatch() };
  };
  collect = () => {
    const self = this;

    for (const input of self.host.querySelectorAll('[data-field]')) {
      const name = input.dataset.field;
      self.draft[name] =
        input.type === 'checkbox'
          ? input.checked
          : input.type === 'color'
            ? input.value
            : Number(input.value);
    }
    if (self.selectionTarget?.entity) {
      const path = [...self.host.querySelectorAll('[data-waypoint]')];
      if (path.length)
        self.draft.path = path.map((row) => [
          Number(row.querySelector('[data-x]').value),
          Number(row.querySelector('[data-y]').value),
        ]);
      const mode = self.host.querySelector('[data-mode]');
      if (mode) self.draft.mode = mode.value;
      const pos = self.host.querySelector('[data-position]');
      if (pos)
        self.draft.position = [
          Number(pos.querySelector('[data-x]').value),
          Number(pos.querySelector('[data-y]').value),
        ];
    }
  };
  error = (message) => {
    const self = this;

    self.host.querySelector('[role="status"]').textContent = message;
  };
  apply = () => {
    const self = this;

    if (!self.selectionTarget) return true;
    self.collect();
    const model = self.getModel(),
      l = model.level;
    try {
      if (self.selectionTarget.entity) {
        const list = (l.entities || []).map((e) =>
          e.id === self.selectionTarget.entity ? self.draft : e,
        );
        validateEntities(list, l.width, l.height);
        model.begin();
        l.entities = structuredClone(list);
      } else {
        const patch = self.reset
          ? {}
          : sparsePatch(
              self.selectionTarget.id,
              Object.fromEntries(
                fieldsFor(self.selectionTarget.id).map((name) => [
                  name,
                  self.draft[name],
                ]),
              ),
              self.inherited(),
            );
        validatePatch(self.selectionTarget.id, patch, self.inherited());
        if (self.selectionTarget.scope === 'type')
          for (const [key, cellPatch] of Object.entries(
            l.cellOverrides || {},
          )) {
            const [x, y] = key.split(',').map(Number);
            if (l.tiles[y][x] === self.selectionTarget.id)
              validatePatch(self.selectionTarget.id, cellPatch, {
                ...baseProperties(self.selectionTarget.id),
                ...patch,
              });
          }
        model.begin();
        const key =
            self.selectionTarget.scope === 'type'
              ? String(self.selectionTarget.id)
              : `${self.selectionTarget.x},${self.selectionTarget.y}`,
          field =
            self.selectionTarget.scope === 'type'
              ? 'tileDefaults'
              : 'cellOverrides';
        l[field] ||= {};
        if (Object.keys(patch).length) l[field][key] = patch;
        else delete l[field][key];
      }
      invalidateProperties(l);
      model.commit();
      self.load();
      self.render();
      self.onChange();
      return true;
    } catch (e) {
      self.error(e.message);
      return false;
    }
  };
  ask = () => {
    const self = this;

    if (!self.hasPendingChanges) return Promise.resolve(true);
    return new Promise((resolve) => {
      const dialog = document.createElement('dialog');
      dialog.className = 'decision';
      dialog.innerHTML =
        '<h2>Unapplied changes</h2><p>Apply your changes before continuing?</p><div><button data-choice="apply">Apply</button><button data-choice="discard">Discard</button><button data-choice="cancel">Cancel</button></div>';
      self.root.append(dialog);
      const done = (choice) => {
        if (choice === 'apply' && !self.apply()) return;
        self.hasPendingChanges = false;
        if (choice === 'cancel') self.hasPendingChanges = true;
        dialog.close();
        dialog.remove();
        resolve(choice !== 'cancel');
      };
      dialog.addEventListener('click', (e) => {
        const choice = e.target.closest('[data-choice]')?.dataset.choice;
        if (choice) done(choice);
      });
      dialog.addEventListener('cancel', (e) => {
        e.preventDefault();
        done('cancel');
      });
      dialog.showModal();
      dialog.querySelector('button').focus();
    });
  };
  close = () => {
    const self = this;

    self.host.hidden = true;
    self.root.querySelector('.editor').classList.remove('has-inspector');
    self.selectionTarget = null;
    self.hasPendingChanges = false;
    self.expanded = false;
    self.returnFocus?.focus?.({ preventScroll: true });
    self.onChange(false);
  };
  position = () => {
    const self = this;

    if (!self.selectionTarget || (self.host.hidden && self.expanded)) return;
    if (self.expanded) {
      self.host.hidden = false;
      self.host.style.left = '';
      self.host.style.top = '';
      return;
    }
    let rect;
    if (self.selectionTarget.entity) {
      const e = self
        .getLevel()
        .entities?.find((e) => e.id === self.selectionTarget.entity);
      if (!e) {
        self.close();
        return;
      }
      const p = e.type === 'saw' ? e.path[0] : e.position;
      rect = self.project(p[0] / 16, p[1] / 16);
    } else
      rect =
        self.selectionTarget.x !== undefined
          ? self.project(self.selectionTarget.x, self.selectionTarget.y)
          : self.anchor?.getBoundingClientRect();
    if (!rect) return;
    const workspace = self.root
      .querySelector('.workspace')
      .getBoundingClientRect();
    if (
      (self.selectionTarget.x !== undefined || self.selectionTarget.entity) &&
      (rect.right < workspace.left ||
        rect.left > workspace.right ||
        rect.bottom < workspace.top ||
        rect.top > workspace.bottom)
    ) {
      self.host.hidden = true;
      return;
    }
    self.host.hidden = false;
    const width = self.host.offsetWidth,
      height = self.host.offsetHeight;
    let x = rect.right + 10;
    if (x + width > innerWidth - 10) x = rect.left - width - 10;
    self.host.style.left = `${Math.max(8, Math.min(innerWidth - width - 8, x))}px`;
    self.host.style.top = `${Math.max(8, Math.min(innerHeight - height - 8, rect.top))}px`;
  };
  field = (name) => {
    const self = this;

    const p = properties[name],
      value = self.draft[name],
      source =
        self.selectionTarget.scope === 'cell' &&
        Object.hasOwn(self.currentPatch(), name)
          ? 'Cell override'
          : self.selectionTarget.scope === 'type' &&
              Object.hasOwn(self.currentPatch(), name)
            ? 'Map override'
            : self.selectionTarget.scope === 'cell' &&
                Object.hasOwn(
                  self.getLevel().tileDefaults?.[self.selectionTarget.id] || {},
                  name,
                )
              ? 'Map default'
              : 'Registry';
    return `<label class="property-field"><span>${p.label}<small>${source}</small></span><input data-field="${name}" aria-label="${p.label}" type="${p.type === 'boolean' ? 'checkbox' : p.type === 'color' ? 'color' : 'number'}" ${p.type === 'boolean' ? (value ? 'checked' : '') : `value="${value}"`} ${p.min !== undefined ? `min="${p.min}" max="${p.max}" step="${p.step}"` : ''}></label>`;
  };
  entityForm = () => {
    const self = this;

    if (self.draft.type === 'checkpoint')
      return `<p class="property-help">Respawn feet position</p><div data-position class="point-row"><label>X<input data-x type="number" step="8" aria-label="Checkpoint X" value="${self.draft.position[0]}"></label><label>Y<input data-y type="number" step="8" aria-label="Checkpoint Y" value="${self.draft.position[1]}"></label></div>`;
    return `<label>Mode<select data-mode aria-label="Saw mode"><option value="ping-pong" ${self.draft.mode === 'ping-pong' ? 'selected' : ''}>Ping-pong</option><option value="loop" ${self.draft.mode === 'loop' ? 'selected' : ''}>Loop</option></select></label>${[
      ['speed', 'Saw speed', 16, 240, 1],
      ['radius', 'Saw radius', 4, 12, 1],
      ['phase', 'Saw phase', 0, 1, 0.05],
    ]
      .map(
        ([name, label, min, max, step]) =>
          `<label class="property-field">${label}<input data-field="${name}" aria-label="${label}" type="number" value="${self.draft[name]}" min="${min}" max="${max}" step="${step}"></label>`,
      )
      .join(
        '',
      )}${self.expanded ? `<h3>Waypoints</h3>${self.draft.path.map(([x, y], i) => `<div data-waypoint="${i}" class="point-row"><span>${i + 1}</span><label>X<input data-x type="number" step="16" value="${x}" aria-label="Waypoint ${i + 1} X"></label><label>Y<input data-y type="number" step="16" value="${y}" aria-label="Waypoint ${i + 1} Y"></label><button data-remove="${i}" aria-label="Remove waypoint ${i + 1}">X</button></div>`).join('')}<button data-add-point>Add waypoint</button>` : ''}`;
  };
  render = () => {
    const self = this;

    if (!self.selectionTarget) return;
    const l = self.getLevel();
    if (
      self.selectionTarget.entity &&
      !l.entities?.some((e) => e.id === self.selectionTarget.entity)
    ) {
      self.close();
      return;
    }
    const title = self.selectionTarget.entity
      ? self.draft.type === 'saw'
        ? 'Moving saw'
        : 'Checkpoint'
      : tiles[self.selectionTarget.id].name;
    self.host.classList.toggle('expanded', self.expanded);
    self.root
      .querySelector('.editor')
      .classList.toggle('has-inspector', self.expanded);
    self.host.hidden = false;
    const names = self.selectionTarget.entity
        ? []
        : fieldsFor(self.selectionTarget.id),
      shown = self.expanded
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
    self.host.innerHTML = `<div class="inspector-heading"><div>${self.selectionTarget.entity ? '' : `<img alt="" src="${self.assets[tiles[self.selectionTarget.id].asset].src}">`}<h2>${title}</h2></div><button data-close aria-label="Close inspector">Close</button></div><div class="inspector-content">${self.selectionTarget.entity ? `<p class="property-help">${self.selectionTarget.entity}</p>${self.entityForm()}` : `<label class="scope-label">Scope<select aria-label="Property scope"><option value="type" ${self.selectionTarget.scope === 'type' ? 'selected' : ''}>Tile type in this map</option>${self.selectionTarget.x !== undefined ? `<option value="cell" ${self.selectionTarget.scope === 'cell' ? 'selected' : ''}>This cell</option>` : ''}</select></label>${self.expanded ? `<p class="property-help">ID ${self.selectionTarget.id} | ${tiles[self.selectionTarget.id].kind} | ${tiles[self.selectionTarget.id].asset}.png${self.selectionTarget.x !== undefined ? ` | Cell ${self.selectionTarget.x}, ${self.selectionTarget.y}` : ''}</p>` : ''}${shown.map(self.field).join('')}${[9, 10].includes(self.selectionTarget.id) && self.expanded ? '<label>Direction<select aria-label="Conveyor direction" data-direction><option value="-1">Left</option><option value="1">Right</option></select></label>' : ''}${self.expanded ? '<p class="property-help">Changing the hitbox can make collision differ from the sprite.</p>' : ''}`}
  <p role="status" class="property-error"></p></div><div class="inspector-actions"><button data-apply class="primary">Apply</button><button data-cancel>Cancel</button>${self.selectionTarget.entity ? '<button data-delete>Delete</button>' : '<button data-reset>Reset</button>'}</div><button class="show-more" data-expand>${self.expanded ? 'Show less' : 'Show more...'}</button>`;
    const direction = self.host.querySelector('[data-direction]');
    if (direction) direction.value = self.draft.conveyor < 0 ? '-1' : '1';
    self.position();
  };
}
export const createInspector = (...args) => new TileInspector(...args);
