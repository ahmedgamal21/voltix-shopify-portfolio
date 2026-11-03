# VOLTIX — Shopify Electronics Storefront

A custom Shopify storefront for **VOLTIX**, a demonstration electronics and home-appliance retailer for Kuwait, built on Shopify's Horizon theme (Online Store 2.0). The work goes beyond styling: custom theme blocks, the Section Rendering API, the Product Recommendations API, the Cart AJAX API wired into Horizon's own cart events, metafield-driven specifications and full English / Arabic (RTL) support.

**Live demo:** [voltix-kanuk8wf.myshopify.com](https://voltix-kanuk8wf.myshopify.com) — store password: `uttean`
(Shopify development stores are always password-protected. Checkout is in test mode; no real orders are processed.)

> **Portfolio project.** VOLTIX is a fictional store with demonstration data. Prices, stock and fulfilment terms are illustrative. Products without photography use original VOLTIX illustrations. Specifications only show data the store really holds — nothing is invented.

![VOLTIX homepage](docs/screenshots/01-homepage-hero.png)

## What it shows

| Shopify skill | Where it is used |
|---|---|
| **Theme blocks with schemas** (OS 2.0) | Specifications, installments, delivery estimate, wishlist & compare and service badges are real blocks (`blocks/voltix-*.liquid`) that merchants add, reorder and configure in the theme editor |
| **Metafields** | Specification table reads the JSON metafield `voltix.specs` (plus `voltix.specs_ar` for Arabic and `voltix.warranty`), then falls back to brand, category, SKU, weight and delivery class |
| **Section Rendering API** | Quick view and every compare column are sections fetched with `?section_id=` — the same Liquid renders server-side, no duplicated templates in JavaScript |
| **Product Recommendations API** | Cart drawer cross-sell: complementary products (Search & Discovery) → same department → related |
| **Cart AJAX API + Horizon events** | One-click add to cart posts to `/cart/add.js` with `sections` and `sections_url`, then resolves Horizon's `CartLinesUpdateEvent`, so the drawer, cart count and animations update exactly like Horizon's own button |
| **Variant-aware components** | Installments and delivery estimate listen to `ProductSelectEvent` and update when the variant changes |
| **Cart-section rendering** | Free-delivery progress bar lives inside the cart section, so it re-renders with every cart change at no extra request |
| **Localization** | All copy in locale files (`voltix.*`), translated collection titles, RTL with logical CSS properties, dates and countdowns formatted with `Intl` in the shopper's language |
| **Theme settings** | A *VOLTIX commerce* settings group (free-delivery threshold, card buttons, cart recommendations) |
| **Quality** | Theme Check with no errors, GitHub Actions CI, keyboard-accessible dialogs, reduced-motion support |

## Features

**Navigation**
- Mega menu for 16 departments and 72 subcategories — hover and keyboard on desktop, accordion drawer on mobile, every link from collection pickers (no hard-coded URLs).
- Quick links bar built from the department blocks when no Shopify menu is chosen.
- Subcategory pills on collection pages, generated from product tags.

**Product page**
- Key specifications table from metafields and product data.
- "Or 4 interest-free payments of …" message, variant-aware (enable it only when a pay-later provider is active).
- Kuwait delivery estimate with a live cut-off countdown, Friday skipping and longer lead time for products tagged `ship-large-appliances` — calculated in Kuwait time.
- Wishlist, compare and service badges as configurable blocks; Horizon's sticky add-to-cart bar.

**Discovery**
- Quick view dialog from any product card.
- Compare up to 4 products: tray at the bottom of the screen, side-by-side table that lines up specification rows across products and highlights differences.
- Wishlist without an app, with a header counter and a wishlist page.

**Cart drawer**
- Free-delivery progress bar (threshold in theme settings).
- "Complete your setup" recommendations with one-click add.
- Department illustrations for cart lines without photos.

**Store setup**: Kuwait market, KWD, Asia/Kuwait time zone, English + Arabic, ~1,000 demonstration products, 88 tag-driven category collections (16 departments + 72 subcategories), shipping rates by product size.

## Screens

| Homepage | Mega menu | Collection page |
|---|---|---|
| ![Homepage](docs/screenshots/02-shop-by-category.png) | ![Mega menu](docs/screenshots/06-mega-menu.png) | ![Collection page](docs/screenshots/07-collection-page.png) |

| Arabic (RTL) | Mobile | Mobile menu |
|---|---|---|
| ![Arabic homepage](docs/screenshots/09-arabic-rtl-homepage.png) | ![Mobile homepage](docs/screenshots/10-mobile-homepage.png) | ![Mobile menu](docs/screenshots/11-mobile-menu.png) |

Full homepage: [`docs/screenshots/00-homepage-overview.png`](docs/screenshots/00-homepage-overview.png)

## How it fits into Horizon

Horizon stays the base theme. Everything VOLTIX lives in `voltix-*` files, and the edits inside Horizon files are small and documented in [`theme-customizations/horizon-integration.patch`](theme-customizations/horizon-integration.patch) (loading the CSS/JS, card tools, cart drawer hooks, translated titles).

```
theme-customizations/
  assets/      voltix.css, voltix-commerce.css
               voltix-commerce.js  compare, quick view, quick add, cart recommendations
               voltix-pdp.js       installments + delivery estimate
               voltix-mega-menu.js, voltix-wishlist.js, voltix-hero.js
               vx-illo-*.svg       16 department illustrations
  blocks/      voltix-specs, voltix-installments, voltix-delivery, voltix-actions, voltix-service-badges
  sections/    hero, announcements, mega menu, category grid, services, promo banners, brands, newsletter,
               footer, collection links, wishlist, quick view*, compare column*, cart recommendations*
  snippets/    specs table, free-delivery bar, compare bar and button, quick add / quick view buttons,
               product thumb, icons, translated text and collection titles, wishlist, placeholders
  templates/   page.wishlist.json
  locales/     en.voltix.json, ar.voltix.json
  config-snippets/  ready-made settings for the homepage, header, footer and product page
  horizon-integration.patch
docs/          screenshots, collections.csv, mega-menu-structure.json
```
\* rendered only through the Section Rendering API.

The full theme (Horizon plus these files) is in a private repository with a GitHub Actions workflow that runs Theme Check on every push. Horizon's licence allows modifying it for Shopify stores but not redistributing derived themes, so only the original VOLTIX code is published here.

## Using the customizations in a Horizon theme

1. Copy `assets`, `blocks`, `sections`, `snippets` and `templates` into the theme.
2. Merge `locales/en.voltix.json` into `locales/en.default.json` and `locales/ar.voltix.json` into `locales/ar.json`.
3. Apply `horizon-integration.patch`.
4. Add the blocks to the product template in the theme editor (or paste `config-snippets/product__main.json`), and the sections to the homepage.
5. Optional: create the product metafields `voltix.specs` (JSON), `voltix.specs_ar` (JSON) and `voltix.warranty` (single-line text).
6. Preview with `shopify theme dev --store <store>.myshopify.com`.

## Key decisions

- **Server-rendered pieces, small JavaScript.** Quick view, compare columns and recommendations are Liquid sections fetched with the Section Rendering API, so markup, translations and money formatting stay in one place.
- **Work with Horizon, not around it.** Quick add resolves Horizon's `CartLinesUpdateEvent` instead of reloading the cart, so every Horizon component keeps working.
- **Collection pickers instead of a navigation API.** No extra app permissions, and product counts stay live.
- **Honest merchandising.** Sale prices only when a real compare-at price exists, installments only as a configurable block, specifications only from real data.

## Tech stack

Shopify Online Store 2.0 · Horizon · Liquid · theme blocks · JSON templates · Section Rendering API · Product Recommendations API · Cart AJAX API · metafields · Web Components (vanilla JavaScript modules) · CSS custom and logical properties · Shopify CLI · Theme Check · GitHub Actions

## Author

**Ahmed Gamal** — E-commerce Manager & Web Developer
[LinkedIn](https://www.linkedin.com/in/ahmed-gamal-76321925a/)
