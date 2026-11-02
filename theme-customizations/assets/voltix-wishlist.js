/**
 * VOLTIX wishlist (no app needed).
 * Product handles are saved in the shopper's browser (localStorage).
 *
 * <voltix-wishlist-button data-handle="..."> toggles a product.
 * <voltix-wishlist-count> shows the number of saved products.
 * <voltix-wishlist-grid> renders saved products on the wishlist page.
 */
(() => {
  const KEY = 'voltix:wishlist';
  const EVENT = 'voltix:wishlist-change';

  const read = () => {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '[]');
      return Array.isArray(value) ? value : [];
    } catch (e) {
      return [];
    }
  };

  const write = (list) => {
    try {
      localStorage.setItem(KEY, JSON.stringify(list));
    } catch (e) {
      /* storage blocked: the button still toggles for this page view */
    }
    document.dispatchEvent(new CustomEvent(EVENT, { detail: { list } }));
  };

  const toggle = (handle) => {
    const list = read();
    const index = list.indexOf(handle);
    if (index === -1) list.unshift(handle);
    else list.splice(index, 1);
    write(list.slice(0, 100));
    return index === -1;
  };

  window.VoltixWishlist = { read, toggle, EVENT };

  if (!customElements.get('voltix-wishlist-button')) {
    customElements.define(
      'voltix-wishlist-button',
      class extends HTMLElement {
        connectedCallback() {
          this.button = this.querySelector('button');
          this.handle = this.dataset.handle;
          this.sync = () => this.render(read().includes(this.handle));
          this.button?.addEventListener('click', (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.render(toggle(this.handle));
          });
          document.addEventListener(EVENT, this.sync);
          this.sync();
        }
        disconnectedCallback() {
          document.removeEventListener(EVENT, this.sync);
        }
        render(saved) {
          this.toggleAttribute('saved', saved);
          this.button?.setAttribute('aria-pressed', String(saved));
          this.button?.setAttribute('aria-label', saved ? this.dataset.labelRemove : this.dataset.labelAdd);
        }
      }
    );
  }

  if (!customElements.get('voltix-wishlist-count')) {
    customElements.define(
      'voltix-wishlist-count',
      class extends HTMLElement {
        connectedCallback() {
          this.sync = () => {
            const n = read().length;
            this.textContent = n;
            this.hidden = n === 0;
          };
          document.addEventListener(EVENT, this.sync);
          window.addEventListener('storage', this.sync);
          this.sync();
        }
        disconnectedCallback() {
          document.removeEventListener(EVENT, this.sync);
          window.removeEventListener('storage', this.sync);
        }
      }
    );
  }

  if (!customElements.get('voltix-wishlist-grid')) {
    customElements.define(
      'voltix-wishlist-grid',
      class extends HTMLElement {
        connectedCallback() {
          this.grid = this.querySelector('[data-grid]');
          this.empty = this.querySelector('[data-empty]');
          this.money = new Intl.NumberFormat(document.documentElement.lang || 'en', {
            style: 'currency',
            currency: this.dataset.currency || 'KWD',
          });
          this.load();
          document.addEventListener(EVENT, () => this.load());
        }

        async load() {
          const handles = read();
          this.empty.hidden = handles.length > 0;
          if (!handles.length) {
            this.grid.replaceChildren();
            return;
          }
          const root = window.Shopify?.routes?.root || '/';
          const products = await Promise.all(
            handles.map((h) =>
              fetch(`${root}products/${encodeURIComponent(h)}.js`)
                .then((r) => (r.ok ? r.json() : null))
                .catch(() => null)
            )
          );
          this.grid.replaceChildren(...products.filter(Boolean).map((p) => this.card(p)));
        }

        card(p) {
          const li = document.createElement('li');
          li.className = 'vx-wish-card';

          const link = document.createElement('a');
          link.href = p.url;
          link.className = 'vx-wish-card__media';
          if (p.featured_image) {
            const img = document.createElement('img');
            img.src = `${p.featured_image}${p.featured_image.includes('?') ? '&' : '?'}width=400`;
            img.alt = p.title;
            img.loading = 'lazy';
            link.append(img);
          } else {
            const dept = (p.tags || []).find((t) => t.startsWith('dept-'));
            if (dept && this.dataset.illoBase) {
              const illo = document.createElement('img');
              illo.src = `${this.dataset.illoBase}vx-illo-${dept.slice(5)}.svg`;
              illo.alt = '';
              illo.className = 'vx-placeholder__illo';
              link.append(illo);
            }
            const brand = document.createElement('span');
            brand.className = 'vx-placeholder__brand';
            brand.textContent = p.vendor || '';
            link.append(brand);
          }

          const title = document.createElement('a');
          title.href = p.url;
          title.className = 'vx-wish-card__title';
          title.textContent = p.title;

          const price = document.createElement('span');
          price.className = 'vx-wish-card__price';
          price.textContent = this.money.format(p.price / 100);

          const remove = document.createElement('button');
          remove.type = 'button';
          remove.className = 'vx-wish-card__remove';
          remove.textContent = this.dataset.labelRemove || 'Remove';
          remove.addEventListener('click', () => toggle(p.handle));

          li.append(link, title, price, remove);
          return li;
        }
      }
    );
  }
})();
