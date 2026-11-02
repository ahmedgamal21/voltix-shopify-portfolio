/**
 * VOLTIX mega menu
 * Desktop: opens on click (and hover), departments switch on hover/focus/click.
 * Mobile: the same markup becomes a full-height drawer with an accordion.
 * Keyboard: Esc closes, ArrowUp/ArrowDown move between departments.
 */
if (!customElements.get('voltix-mega-menu')) {
  class VoltixMegaMenu extends HTMLElement {
    connectedCallback() {
      this.toggle = this.querySelector('[data-mega-toggle]');
      this.panel = this.querySelector('[data-mega-panel]');
      this.overlay = this.querySelector('[data-mega-overlay]');
      this.depts = Array.from(this.querySelectorAll('[data-dept]'));
      this.desktop = window.matchMedia('(min-width: 990px)');
      this.closeTimer = null;

      this.toggle?.addEventListener('click', () => (this.isOpen ? this.close() : this.open()));
      this.querySelector('[data-mega-close]')?.addEventListener('click', () => this.close(true));
      this.overlay?.addEventListener('click', () => this.close());

      this.depts.forEach((btn, index) => {
        btn.addEventListener('click', () => {
          if (this.desktop.matches) this.activate(btn);
          else this.accordion(btn);
        });
        btn.addEventListener('mouseenter', () => this.desktop.matches && this.activate(btn));
        btn.addEventListener('focus', () => this.desktop.matches && this.activate(btn));
        btn.addEventListener('keydown', (event) => this.onDeptKey(event, index));
      });

      // Hover intent on desktop
      this.addEventListener('mouseleave', () => {
        if (!this.desktop.matches || !this.isOpen) return;
        this.closeTimer = setTimeout(() => this.close(), 250);
      });
      this.addEventListener('mouseenter', () => clearTimeout(this.closeTimer));

      this.onKeyUp = (event) => event.key === 'Escape' && this.isOpen && this.close(true);
      document.addEventListener('keyup', this.onKeyUp);
      this.desktop.addEventListener('change', () => this.close());
    }

    disconnectedCallback() {
      document.removeEventListener('keyup', this.onKeyUp);
    }

    get isOpen() {
      return this.toggle?.getAttribute('aria-expanded') === 'true';
    }

    open() {
      this.panel.hidden = false;
      this.overlay.hidden = false;
      this.toggle.setAttribute('aria-expanded', 'true');
      this.classList.add('is-open');
      if (!this.desktop.matches) document.documentElement.classList.add('vx-scroll-lock');
      const current = this.depts.find((b) => b.getAttribute('aria-expanded') === 'true') || this.depts[0];
      if (this.desktop.matches && current) this.activate(current);
    }

    close(returnFocus = false) {
      this.panel.hidden = true;
      this.overlay.hidden = true;
      this.toggle.setAttribute('aria-expanded', 'false');
      this.classList.remove('is-open');
      document.documentElement.classList.remove('vx-scroll-lock');
      if (returnFocus) this.toggle.focus();
    }

    /** Desktop: one department visible at a time */
    activate(btn) {
      this.depts.forEach((b) => {
        const active = b === btn;
        b.setAttribute('aria-expanded', String(active));
        const subs = document.getElementById(b.getAttribute('aria-controls'));
        if (subs) subs.hidden = !active;
      });
    }

    /** Mobile: accordion, tap to open / close */
    accordion(btn) {
      const willOpen = btn.getAttribute('aria-expanded') !== 'true';
      this.depts.forEach((b) => {
        const active = b === btn && willOpen;
        b.setAttribute('aria-expanded', String(active));
        const subs = document.getElementById(b.getAttribute('aria-controls'));
        if (subs) subs.hidden = !active;
      });
    }

    onDeptKey(event, index) {
      let next = null;
      if (event.key === 'ArrowDown') next = this.depts[(index + 1) % this.depts.length];
      if (event.key === 'ArrowUp') next = this.depts[(index - 1 + this.depts.length) % this.depts.length];
      if (event.key === 'ArrowRight' && this.desktop.matches) {
        const subs = document.getElementById(this.depts[index].getAttribute('aria-controls'));
        subs?.querySelector('a')?.focus();
        event.preventDefault();
        return;
      }
      if (next) {
        event.preventDefault();
        next.focus();
      }
    }
  }

  customElements.define('voltix-mega-menu', VoltixMegaMenu);
}
