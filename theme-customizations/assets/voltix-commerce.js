/**
 * VOLTIX commerce layer — compare, quick view, quick add and cart recommendations.
 *
 * Shopify APIs used:
 *  - Section Rendering API   /products/<handle>?section_id=voltix-quick-view | voltix-compare-column
 *  - Product Recommendations /recommendations/products?intent=complementary|related&section_id=...
 *  - Cart AJAX API           /cart/add.js (with `sections` so the drawer re-renders in the same request)
 *  - Horizon / Shopify standard events (CartLinesUpdateEvent) so the cart drawer, cart icon and
 *    fly-to-cart all react exactly as they do for Horizon's own add-to-cart.
 */
import { CartLinesUpdateEvent, StandardEvents } from '@shopify/events';

const root = () => window.Shopify?.routes?.root || '/';
const t = (key, fallback) => window.VoltixStrings?.[key] || fallback;

/** Fetches a section rendered in the context of a URL and returns its inner element. */
async function fetchSection(path, sectionId) {
  const url = new URL(path, location.origin);
  url.searchParams.set('section_id', sectionId);
  const response = await fetch(url, { headers: { Accept: 'text/html' } });
  if (!response.ok) throw new Error(`Section ${sectionId} failed: ${response.status}`);
  const doc = new DOMParser().parseFromString(await response.text(), 'text/html');
  return doc.querySelector('.shopify-section') || doc.body;
}

/* ------------------------------------------------------------------ */
/* Quick add                                                           */
/* ------------------------------------------------------------------ */

/** Adds a variant to the cart and lets Horizon's cart drawer re-render from the same response. */
export async function addToCart(variantId, quantity = 1, sourceEl = document.body) {
  const sectionIds = [...document.querySelectorAll('cart-items-component[data-section-id]')].map((el) => el.dataset.sectionId);
  const deferred = CartLinesUpdateEvent.createPromise();

  sourceEl.dispatchEvent(
    new CartLinesUpdateEvent({
      action: 'add',
      context: 'product',
      lines: [{ merchandiseId: String(variantId), quantity }],
      promise: deferred.promise,
    })
  );

  try {
    const response = await fetch(`${root()}cart/add.js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      // sections_url renders the drawer in the context (and language) of the current page.
      body: JSON.stringify({ items: [{ id: Number(variantId), quantity }], sections: sectionIds.join(','), sections_url: location.pathname }),
    });
    const data = await response.json();
    if (data.status) throw new Error(data.description || data.message);

    const cart = await fetch(`${root()}cart.js`).then((r) => r.json());
    deferred.resolve({
      cart: CartLinesUpdateEvent.createCartFromAjaxResponse(cart),
      detail: { items: cart.items, source: 'voltix-quick-add', itemCount: quantity, sections: data.sections, didError: false },
    });
    return cart;
  } catch (error) {
    deferred.reject(error);
    throw error;
  }
}

class VxQuickAdd extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.button?.addEventListener('click', this.onClick);
  }
  disconnectedCallback() {
    this.button?.removeEventListener('click', this.onClick);
  }
  onClick = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (this.button.getAttribute('aria-busy') === 'true') return;
    this.button.setAttribute('aria-busy', 'true');
    const label = this.button.querySelector('[data-label]');
    const original = label?.textContent;
    try {
      // Close any VOLTIX dialog first so the cart drawer can take focus.
      this.closest('dialog.vx-dialog')?.close();
      const insideDrawer = Boolean(this.closest('#cart-drawer'));
      await addToCart(this.dataset.variantId, 1, this);
      if (label) label.textContent = t('added', 'Added');
      // Show the result: open Horizon's cart drawer unless the shopper is already in it.
      const drawer = document.getElementById('cart-drawer');
      if (!insideDrawer && drawer && !drawer.isOpen) drawer.open?.();
      this.classList.add('is-added');
    } catch (error) {
      if (label) label.textContent = t('error', 'Could not add');
      console.warn('[voltix] quick add failed', error);
    } finally {
      this.button.removeAttribute('aria-busy');
      setTimeout(() => {
        if (label && original) label.textContent = original;
        this.classList.remove('is-added');
      }, 2000);
    }
  };
}

/* ------------------------------------------------------------------ */
/* Shared dialog                                                       */
/* ------------------------------------------------------------------ */

function getDialog(id, labelText) {
  let dialog = document.getElementById(id);
  if (dialog) return dialog;
  dialog = document.createElement('dialog');
  dialog.id = id;
  dialog.className = `vx-dialog ${id}`;
  dialog.setAttribute('aria-label', labelText);
  dialog.innerHTML = `
    <div class="vx-dialog__inner">
      <button type="button" class="vx-dialog__close" aria-label="${t('close', 'Close')}">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>
      </button>
      <div class="vx-dialog__body" data-body></div>
    </div>`;
  dialog.querySelector('.vx-dialog__close').addEventListener('click', () => dialog.close());
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('vx-dialog-open');
    dialog._opener?.focus?.();
  });
  document.body.append(dialog);
  return dialog;
}

function openDialog(dialog, opener) {
  dialog._opener = opener;
  document.documentElement.classList.add('vx-dialog-open');
  if (!dialog.open) dialog.showModal();
}

/* ------------------------------------------------------------------ */
/* Quick view (Section Rendering API)                                  */
/* ------------------------------------------------------------------ */

class VxQuickView extends HTMLElement {
  connectedCallback() {
    this.querySelector('button')?.addEventListener('click', this.open);
  }
  open = async (event) => {
    event.preventDefault();
    event.stopPropagation();
    const button = event.currentTarget;
    const dialog = getDialog('vx-quick-view', t('quick_view', 'Quick view'));
    const body = dialog.querySelector('[data-body]');
    body.innerHTML = `<div class="vx-dialog__loading" role="status">${t('loading', 'Loading…')}</div>`;
    openDialog(dialog, button);
    try {
      const section = await fetchSection(`${root()}products/${this.dataset.handle}`, 'voltix-quick-view');
      body.replaceChildren(...section.childNodes);
      body.querySelector('h2')?.focus();
    } catch (error) {
      body.innerHTML = `<p class="vx-dialog__loading">${t('error', 'Something went wrong.')}</p>`;
    }
  };
}

/* ------------------------------------------------------------------ */
/* Compare                                                             */
/* ------------------------------------------------------------------ */

const COMPARE_KEY = 'voltix:compare';
const COMPARE_EVENT = 'voltix:compare-change';
const COMPARE_MAX = 4;

const compare = {
  read() {
    try {
      const list = JSON.parse(localStorage.getItem(COMPARE_KEY) || '[]');
      return Array.isArray(list) ? list.filter((i) => i && i.handle) : [];
    } catch {
      return [];
    }
  },
  write(list) {
    try {
      localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
    } catch {
      /* storage blocked */
    }
    document.dispatchEvent(new CustomEvent(COMPARE_EVENT, { detail: { list } }));
  },
  has(handle) {
    return this.read().some((i) => i.handle === handle);
  },
  toggle(item) {
    const list = this.read();
    const index = list.findIndex((i) => i.handle === item.handle);
    if (index > -1) {
      list.splice(index, 1);
      this.write(list);
      return 'removed';
    }
    if (list.length >= COMPARE_MAX) return 'full';
    list.push(item);
    this.write(list);
    return 'added';
  },
  remove(handle) {
    this.write(this.read().filter((i) => i.handle !== handle));
  },
  clear() {
    this.write([]);
  },
};
window.VoltixCompare = compare;

class VxCompareButton extends HTMLElement {
  connectedCallback() {
    this.button = this.querySelector('button');
    this.button?.addEventListener('click', this.onClick);
    document.addEventListener(COMPARE_EVENT, this.sync);
    this.sync();
  }
  disconnectedCallback() {
    document.removeEventListener(COMPARE_EVENT, this.sync);
  }
  sync = () => {
    const active = compare.has(this.dataset.handle);
    this.button?.setAttribute('aria-pressed', String(active));
    this.classList.toggle('is-active', active);
  };
  onClick = (event) => {
    event.preventDefault();
    event.stopPropagation();
    const result = compare.toggle({ handle: this.dataset.handle, title: this.dataset.title, image: this.dataset.image });
    if (result === 'full') document.querySelector('vx-compare-bar')?.flash(t('compare_full', 'You can compare up to 4 products.'));
  };
}

class VxCompareBar extends HTMLElement {
  connectedCallback() {
    this.list = this.querySelector('[data-items]');
    this.count = this.querySelector('[data-count]');
    this.openButton = this.querySelector('[data-open]');
    this.message = this.querySelector('[data-message]');
    this.querySelector('[data-clear]')?.addEventListener('click', () => compare.clear());
    this.openButton?.addEventListener('click', () => this.openCompare());
    this.list?.addEventListener('click', (event) => {
      const remove = event.target.closest('[data-remove]');
      if (remove) compare.remove(remove.dataset.remove);
    });
    document.addEventListener(COMPARE_EVENT, () => this.render());
    window.addEventListener('storage', (e) => e.key === COMPARE_KEY && this.render());
    this.render();
  }

  flash(text) {
    if (!this.message) return;
    this.message.textContent = text;
    this.hidden = false;
    this.classList.add('is-visible');
    clearTimeout(this.flashTimer);
    this.flashTimer = setTimeout(() => {
      this.message.textContent = '';
      this.render();
    }, 3000);
  }

  render() {
    const items = compare.read();
    const visible = items.length > 0;
    this.classList.toggle('is-visible', visible);
    this.toggleAttribute('inert', !visible);
    if (this.count) this.count.textContent = String(items.length);
    if (this.openButton) this.openButton.disabled = items.length < 2;
    if (!this.list) return;
    this.list.replaceChildren(
      ...Array.from({ length: COMPARE_MAX }, (_, i) => {
        const item = items[i];
        const li = document.createElement('li');
        li.className = item ? 'vx-compare-bar__item' : 'vx-compare-bar__item is-empty';
        if (item) {
          const img = item.image
            ? `<img src="${item.image}" alt="" width="48" height="48" loading="lazy">`
            : `<span class="vx-compare-bar__ph" aria-hidden="true">${(item.title || '?').charAt(0)}</span>`;
          li.innerHTML = `${img}<span class="vx-compare-bar__name"></span>
            <button type="button" data-remove="${item.handle}" aria-label="${t('remove', 'Remove')} ${item.title || ''}">×</button>`;
          li.querySelector('.vx-compare-bar__name').textContent = item.title || item.handle;
        }
        return li;
      })
    );
  }

  async openCompare() {
    const items = compare.read();
    const dialog = getDialog('vx-compare', t('compare', 'Compare products'));
    const body = dialog.querySelector('[data-body]');
    body.innerHTML = `<div class="vx-dialog__loading" role="status">${t('loading', 'Loading…')}</div>`;
    openDialog(dialog, this.openButton);

    const columns = await Promise.all(
      items.map((item) =>
        fetchSection(`${root()}products/${item.handle}`, 'voltix-compare-column')
          .then((section) => section.querySelector('[data-vx-compare-item]'))
          .catch(() => null)
      )
    );
    const valid = columns.filter(Boolean);
    body.replaceChildren(buildCompareTable(valid));
  }
}

/** Builds an accessible table: one column per product, one row per specification label. */
function buildCompareTable(columns) {
  const labels = [];
  const values = columns.map((col) => {
    const map = new Map();
    col.querySelectorAll('.vx-specs__row').forEach((row) => {
      const label = row.querySelector('dt')?.textContent.trim();
      if (!label) return;
      if (!labels.includes(label)) labels.push(label);
      map.set(label, row.querySelector('dd')?.innerHTML.trim() || '');
    });
    return map;
  });

  const wrapper = document.createElement('div');
  wrapper.className = 'vx-compare';
  const heading = document.createElement('h2');
  heading.className = 'vx-compare__title';
  heading.tabIndex = -1;
  heading.textContent = t('compare', 'Compare products');
  wrapper.append(heading);

  const scroller = document.createElement('div');
  scroller.className = 'vx-compare__scroll';
  scroller.tabIndex = 0;
  const table = document.createElement('table');
  table.className = 'vx-compare__table';
  table.style.setProperty('--vx-cols', String(columns.length));

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  const corner = document.createElement('td');
  corner.className = 'vx-compare__corner';
  headRow.append(corner);
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.append(col.querySelector('[data-head]') || document.createTextNode(''));
    headRow.append(th);
  });
  thead.append(headRow);

  const tbody = document.createElement('tbody');
  labels.forEach((label) => {
    const tr = document.createElement('tr');
    const rowValues = values.map((m) => m.get(label) || '—');
    if (new Set(rowValues).size > 1) tr.classList.add('is-different');
    const th = document.createElement('th');
    th.scope = 'row';
    th.textContent = label;
    tr.append(th);
    rowValues.forEach((html) => {
      const td = document.createElement('td');
      td.innerHTML = html;
      tr.append(td);
    });
    tbody.append(tr);
  });

  table.append(thead, tbody);
  scroller.append(table);
  wrapper.append(scroller);
  requestAnimationFrame(() => heading.focus());
  return wrapper;
}

/* ------------------------------------------------------------------ */
/* Cart recommendations (Product Recommendations API)                  */
/* ------------------------------------------------------------------ */

class VxCartRecs extends HTMLElement {
  connectedCallback() {
    this.load();
    document.addEventListener(StandardEvents.cartLinesUpdate, this.onCartUpdate);
  }
  disconnectedCallback() {
    document.removeEventListener(StandardEvents.cartLinesUpdate, this.onCartUpdate);
  }
  onCartUpdate = (event) => {
    const refresh = async () => {
      const cart = await fetch(`${root()}cart.js`).then((r) => r.json());
      if (!cart.items?.length) return;
      this.dataset.productId = String(cart.items[0].product_id);
      this.dataset.inCart = cart.items.map((i) => i.product_id).join(',');
      const product = await fetch(`${root()}products/${cart.items[0].handle}.js`).then((r) => r.json()).catch(() => null);
      const dept = product?.tags?.find((tag) => tag.startsWith('dept-'));
      this.dataset.dept = dept ? dept.slice(5) : '';
      this.load();
    };
    (event.promise || Promise.resolve()).then(refresh).catch(() => {});
  };

  async load() {
    const productId = this.dataset.productId;
    const target = this.querySelector('[data-recs]');
    if (!productId || !target) return;
    const inCart = (this.dataset.inCart || '').split(',');

    // 1. Complementary (merchant-curated)  2. Same department  3. Shopify's related products
    const sources = [`recommendations/products?product_id=${productId}&limit=6&intent=complementary`];
    if (this.dataset.dept) sources.push(`collections/${this.dataset.dept}`);
    sources.push(`recommendations/products?product_id=${productId}&limit=6&intent=related`);

    for (const source of sources) {
      try {
        const section = await fetchSection(`${root()}${source}`, 'voltix-cart-recommendations');
        const cards = [...section.querySelectorAll('[data-rec-card]')].filter((c) => !inCart.includes(c.dataset.productId)).slice(0, 3);
        if (cards.length) {
          target.replaceChildren(...cards);
          this.hidden = false;
          return;
        }
      } catch {
        /* try the next source */
      }
    }
    this.hidden = true;
  }
}

const define = (name, ctor) => !customElements.get(name) && customElements.define(name, ctor);
define('vx-quick-add', VxQuickAdd);
define('vx-quick-view', VxQuickView);
define('vx-compare-button', VxCompareButton);
define('vx-compare-bar', VxCompareBar);
define('vx-cart-recs', VxCartRecs);
