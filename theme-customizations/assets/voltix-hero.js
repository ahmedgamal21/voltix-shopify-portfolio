/**
 * VOLTIX hero slider: native scroll-snap, dots, optional auto-rotate.
 * Auto-rotate pauses on hover/focus and is off when the user prefers reduced motion.
 */
if (!customElements.get('voltix-hero')) {
  customElements.define(
    'voltix-hero',
    class extends HTMLElement {
      connectedCallback() {
        this.track = this.querySelector('[data-track]');
        this.dots = Array.from(this.querySelectorAll('[data-dot]'));
        this.slides = Array.from(this.track?.children || []);
        if (this.slides.length < 2) return;

        this.dots.forEach((dot) =>
          dot.addEventListener('click', () => this.go(Number(dot.dataset.dot)))
        );

        this.observer = new IntersectionObserver(
          (entries) => {
            entries.forEach((entry) => {
              if (entry.isIntersecting) this.mark(this.slides.indexOf(entry.target));
            });
          },
          { root: this.track, threshold: 0.6 }
        );
        this.slides.forEach((s) => this.observer.observe(s));

        const section = this.closest('.vx-hero');
        const seconds = Number(section?.dataset.autoplay || this.dataset.autoplay || 6);
        const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        if (seconds > 0 && !reduced) {
          this.timer = setInterval(() => {
            if (this.matches(':hover, :focus-within')) return;
            this.go((this.index + 1) % this.slides.length);
          }, seconds * 1000);
        }
      }

      disconnectedCallback() {
        clearInterval(this.timer);
        this.observer?.disconnect();
      }

      go(i) {
        const slide = this.slides[i];
        if (!slide) return;
        this.track.scrollTo({ left: slide.offsetLeft - this.track.offsetLeft, behavior: 'smooth' });
        this.mark(i);
      }

      mark(i) {
        this.index = i;
        this.dots.forEach((d, n) => d.toggleAttribute('aria-current', n === i));
      }
    }
  );
}
