/**
 * VOLTIX product page components.
 *
 * <vx-installments>  "or 4 interest-free payments of X" — follows the selected variant.
 * <vx-delivery-eta>  Kuwait delivery estimate with a live cut-off countdown.
 *
 * Both listen to Horizon's ProductSelectEvent (@shopify/events), so they stay in sync with the
 * variant picker without touching Horizon's own scripts.
 */
import { StandardEvents } from '@shopify/events';

const sectionOf = (el) => el.closest('[id*="ProductInformation-"], [id*="QuickAdd-"], .shopify-section') || document;

/** Calls `callback(variant)` whenever the product section reports a new selected variant. */
function onVariantChange(el, callback) {
  const target = sectionOf(el);
  const handler = (event) => {
    event.promise
      ?.then(({ detail }) => detail?.resource && callback(detail.resource))
      .catch(() => {});
  };
  target.addEventListener(StandardEvents.productSelect, handler);
  return () => target.removeEventListener(StandardEvents.productSelect, handler);
}

class VxInstallments extends HTMLElement {
  connectedCallback() {
    this.off = onVariantChange(this, (variant) => this.update(variant));
  }
  disconnectedCallback() {
    this.off?.();
  }
  update(variant) {
    const count = Number(this.dataset.count) || 4;
    const min = Number(this.dataset.min) || 0;
    const amountEl = this.querySelector('[data-amount]');
    if (!amountEl || variant.price == null) return;
    // Ajax-style prices are integers in 1/100 of the currency; Storefront-style prices are decimal strings.
    const major = typeof variant.price === 'string' ? parseFloat(variant.price) : variant.price / 100;
    if (Number.isNaN(major)) return;
    this.hidden = major * 100 < min;
    const decimals = Number(this.dataset.decimals) || 2;
    // Same rounding as Liquid: whole 1/100 units, rounded up so the payments cover the price.
    const each = Math.ceil((major * 100) / count) / 100;
    const amount = each.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    amountEl.textContent = (this.dataset.moneyFormat || '{{amount}}').replace(/{{\s*\w+\s*}}/, amount);
  }
}

class VxDeliveryEta extends HTMLElement {
  connectedCallback() {
    this.text = this.querySelector('[data-eta-text]');
    this.available = this.dataset.available !== 'false';
    this.off = onVariantChange(this, (variant) => {
      this.available = variant.available !== false;
      this.render();
    });
    this.render();
    this.timer = setInterval(() => this.render(), 30000);
  }
  disconnectedCallback() {
    clearInterval(this.timer);
    this.off?.();
  }

  /** Current wall-clock parts in the store's time zone (Kuwait has no daylight saving). */
  nowParts() {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: this.dataset.timezone || 'Asia/Kuwait',
      year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(new Date());
    const get = (type) => Number(parts.find((p) => p.type === type)?.value);
    return { y: get('year'), m: get('month'), d: get('day'), h: get('hour'), min: get('minute') };
  }

  render() {
    if (!this.text) return;
    if (!this.available) {
      this.text.textContent = this.querySelector('[data-eta-oos]')?.content.textContent.trim() || '';
      return;
    }
    const cutoff = Number(this.dataset.cutoff) || 14;
    const skipFriday = this.dataset.skipFriday === 'true';
    let days = Number(this.dataset.days) || 0;
    const now = this.nowParts();
    const beforeCutoff = now.h < cutoff;

    // Work on a UTC date that represents the Kuwait calendar day, so weekday maths is stable.
    const date = new Date(Date.UTC(now.y, now.m - 1, now.d, 12));
    if (!beforeCutoff) days += 1;
    if (days === 0 && skipFriday && date.getUTCDay() === 5) days = 1;
    while (days > 0) {
      date.setUTCDate(date.getUTCDate() + 1);
      if (skipFriday && date.getUTCDay() === 5) continue;
      days -= 1;
    }

    const lang = document.documentElement.lang || 'en';
    const todayUTC = Date.UTC(now.y, now.m - 1, now.d, 12);
    const diff = Math.round((date.getTime() - todayUTC) / 86400000);
    let label;
    if (diff === 0 || diff === 1) {
      label = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' }).format(diff, 'day');
    } else {
      label = new Intl.DateTimeFormat(lang, { weekday: 'long', day: 'numeric', month: 'short', timeZone: 'UTC' }).format(date);
    }

    const minutesLeft = cutoff * 60 - (now.h * 60 + now.min);
    const hours = Math.floor(minutesLeft / 60);
    const mins = minutesLeft % 60;
    const unit = (value, u) => new Intl.NumberFormat(lang, { style: 'unit', unit: u, unitDisplay: 'narrow' }).format(value);
    const time = hours > 0 ? `${unit(hours, 'hour')} ${unit(mins, 'minute')}` : unit(mins, 'minute');

    const template = this.querySelector(beforeCutoff ? '[data-eta-template]' : '[data-eta-template-late]');
    const html = (template?.innerHTML || '').replace('[date]', `<strong>${label}</strong>`).replace('[time]', `<strong>${time}</strong>`);
    this.text.innerHTML = html;
  }
}

if (!customElements.get('vx-installments')) customElements.define('vx-installments', VxInstallments);
if (!customElements.get('vx-delivery-eta')) customElements.define('vx-delivery-eta', VxDeliveryEta);
