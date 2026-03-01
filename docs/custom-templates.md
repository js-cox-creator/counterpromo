# CounterPromo — Custom HTML Templates

Custom templates let you design flyers exactly how you want them. You write plain HTML and CSS, mark up specific elements with `counterpromo-*` classes, and the system injects brand colours, product data, branch details, and AI-generated copy before rendering.

---

## How it works

1. You upload an HTML file (or paste HTML into the editor) via **Templates** in the sidebar.
2. When a promo is rendered, the worker loads your HTML into [cheerio](https://cheerio.js.org/), finds every `counterpromo-*` class, and injects the right data.
3. The finished HTML is handed to a headless Chromium browser (Playwright) which produces a PNG preview and a PDF.

The injection is **additive** — existing `style` attributes are preserved and new declarations are appended. Classes that have no data available (e.g. `counterpromo-branch-name` when no branch is set) are left empty or the element is removed depending on the class type.

---

## Dimensions & page rules

| Output | Size | Notes |
|---|---|---|
| **PDF** | US Letter — 8.5 × 11 in | Chromium `page.pdf({ format: 'Letter' })`, zero margins, `printBackground: true` |
| **Preview PNG** | 816 × 1056 px | 96 dpi equivalent of 8.5 × 11 in, viewport-clipped (not full-page scroll) |
| **Social image** | 1080 × 1080 px | Separate render, not driven by custom templates |

### Rules to follow

- **Design for 816 × 1056 px** (or its inch equivalent, 8.5 × 11 in at 96 dpi). Anything outside this viewport is cropped in the preview PNG.
- **Set `html, body { margin: 0; padding: 0; width: 816px; height: 1056px; overflow: hidden; }`** to ensure nothing bleeds out.
- **Use `printBackground: true` compatible CSS.** Background colours and images on non-body elements are printed — they do not need `-webkit-print-color-adjust: exact` in modern Chromium, but adding it is harmless.
- **Avoid web fonts loaded from external CDNs** (Google Fonts, Adobe Fonts, etc.) — the worker's network environment may not resolve them reliably. Embed fonts as base64 `@font-face` declarations or use system fonts (`Arial`, `Helvetica`, `Georgia`, `Times New Roman`).
- **Images in `<img>` tags must be absolute URLs** (https://…). Relative paths will not resolve. The `counterpromo-product-image` and `counterpromo-brand-logo` slots are filled automatically with absolute URLs from S3.
- **Do not rely on JavaScript.** Playwright waits for `networkidle` but does not execute custom JS in a meaningful way for layout purposes. Build your layout in pure CSS.
- **Background images in CSS** (`background-image: url(…)`) work as long as the URL is absolute and publicly accessible.

---

## counterpromo-* class reference

Add these classes to any HTML element. Multiple classes can appear on the same element.

### Colour injection

These append an inline `style` declaration to the element, preserving any styles already set.

| Class | Injects |
|---|---|
| `counterpromo-bg-primary` | `background-color: {brand.primaryColor}` |
| `counterpromo-bg-secondary` | `background-color: {brand.secondaryColor}` |
| `counterpromo-text-primary` | `color: {brand.primaryColor}` |
| `counterpromo-text-secondary` | `color: {brand.secondaryColor}` |
| `counterpromo-border-primary` | `border-color: {brand.primaryColor}` |
| `counterpromo-border-secondary` | `border-color: {brand.secondaryColor}` |

> `primaryColor` is the first colour in the brand kit; `secondaryColor` is the second. If fewer than two colours are saved, both fall back to `#000000`.

### Text & image slots

These set the element's **text content** (or `src` for images).

| Class | Replaced with |
|---|---|
| `counterpromo-brand-name` | Brand name |
| `counterpromo-brand-logo` | `<img>` src → brand logo URL; **element is removed** if no logo is saved |
| `counterpromo-promo-title` | Promo title |
| `counterpromo-promo-subhead` | Promo subhead; **element is removed** if subhead is blank |
| `counterpromo-promo-cta` | Promo CTA, or `"Contact us today"` if blank |
| `counterpromo-branch-name` | Branch name |
| `counterpromo-branch-phone` | Branch phone |
| `counterpromo-branch-email` | Branch email |
| `counterpromo-branch-address` | Branch address |

### Product repeater

The element with class `counterpromo-product` is used as a **template** — it is cloned once for each product in the promo, then the original is removed. Place this element inside a flex or grid container so the clones lay out correctly.

Inside each clone, these classes are resolved:

| Class | Resolved to |
|---|---|
| `counterpromo-product-name` | Product name |
| `counterpromo-product-price` | Formatted price, e.g. `$12.99` |
| `counterpromo-product-price-whole` | Whole dollars only, e.g. `12` |
| `counterpromo-product-price-cents` | Cents only, e.g. `99` |
| `counterpromo-product-image` | `<img>` src → product image URL; **element is removed** if no image |
| `counterpromo-product-category` | Product category |
| `counterpromo-product-vendor` | Vendor name |
| `counterpromo-product-sku` | SKU |
| `counterpromo-product-unit` | Unit (e.g. `ea`, `lf`) |

> The repeater element can contain any HTML structure — nested divs, tables, flex children, whatever your design needs.

### Conditional removal

These classes cause the entire element (and all its children) to be **removed from the DOM** when the condition is false. Use them to hide sections that only make sense when certain data is present.

| Class | Element removed when |
|---|---|
| `counterpromo-if-logo` | Brand has no logo |
| `counterpromo-if-branch` | No branch is assigned to the promo |
| `counterpromo-if-subhead` | Promo subhead is blank |

### AI-generated copy

Any element with `counterpromo-gen` has its **text content treated as a prompt**. The worker calls Gemini with the prompt plus brand name, promo title, and any keywords set on the promo, then replaces the element's text with the response.

```html
<p class="counterpromo-gen">
  One punchy sentence (max 12 words) promoting this sale.
</p>
```

- If `GEMINI_API_KEY` is not configured, the element retains its original prompt text.
- Keep prompts short and specific — the model receives your prompt plus context about the brand and promo.
- Keywords (set in the promo editor right panel) are appended to every gen prompt as additional context.
- Multiple `counterpromo-gen` elements are processed sequentially to avoid rate limiting.

---

## Minimal working example

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    html, body {
      margin: 0; padding: 0;
      width: 816px; height: 1056px;
      overflow: hidden;
      font-family: Arial, Helvetica, sans-serif;
    }

    .header {
      padding: 24px 32px;
      display: flex;
      align-items: center;
      justify-content: space-between;
    }

    .products {
      display: flex;
      flex-wrap: wrap;
      gap: 16px;
      padding: 24px 32px;
    }

    .product-card {
      width: 220px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      overflow: hidden;
    }

    .product-card img {
      width: 100%;
      height: 140px;
      object-fit: cover;
    }

    .product-card .body {
      padding: 12px;
    }

    .footer {
      position: absolute;
      bottom: 0;
      width: 100%;
      padding: 12px 32px;
      box-sizing: border-box;
    }
  </style>
</head>
<body>

  <!-- Header -->
  <div class="header counterpromo-bg-primary">
    <img class="counterpromo-brand-logo" style="height: 48px;" alt="Logo" />
    <div>
      <h1 class="counterpromo-promo-title counterpromo-text-secondary"
          style="margin:0; font-size:22px;"></h1>
      <p class="counterpromo-promo-subhead"
         style="margin:4px 0 0; color:white; font-size:13px;"></p>
    </div>
  </div>

  <!-- AI tagline -->
  <p class="counterpromo-gen"
     style="text-align:center; padding: 16px 32px 0; font-size:14px; color:#475569;">
    One sentence about why customers should shop this sale.
  </p>

  <!-- Product grid -->
  <div class="products">
    <div class="product-card counterpromo-product">
      <img class="counterpromo-product-image" alt="" />
      <div class="body">
        <p class="counterpromo-product-name"
           style="margin:0 0 6px; font-size:13px; font-weight:600;"></p>
        <p class="counterpromo-product-price counterpromo-text-primary"
           style="margin:0; font-size:18px; font-weight:700;"></p>
        <p class="counterpromo-product-unit"
           style="margin:2px 0 0; font-size:11px; color:#94a3b8;"></p>
      </div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer counterpromo-bg-secondary counterpromo-if-branch">
    <span class="counterpromo-branch-name" style="color:white; font-weight:600;"></span>
    &nbsp;·&nbsp;
    <span class="counterpromo-branch-phone" style="color:white;"></span>
  </div>

</body>
</html>
```

---

## System templates & forking

**System templates** (the ones with the "System" badge) are managed by a product admin and are read-only for all regular accounts. To use one as a starting point:

1. Go to **Templates** in the sidebar.
2. Click the **copy icon** on any system template.
3. An editor opens pre-filled with its HTML — give it a new name and save. It is now your own private copy that you can edit freely.

---

## Tips & common mistakes

| | Do | Don't |
|---|---|---|
| Fonts | Use system fonts or base64 `@font-face` | Link to Google Fonts |
| Images | Use absolute `https://` URLs | Use relative paths |
| Layout | Set `width: 816px; height: 1056px` on `body` | Let content overflow or scroll |
| Colours | Use `counterpromo-bg-primary` classes | Hardcode your client's brand colour |
| Product images | Always include `counterpromo-product-image` inside the repeater | Put it outside — it won't be cloned |
| Empty states | Use `counterpromo-if-branch` / `counterpromo-if-subhead` to hide optional sections | Leave empty `<span>` elements when no data |
| Background colours | Set on a `<div>` with height, not just `<body>` | Assume body background prints automatically |
| AI copy | Keep `counterpromo-gen` prompts short and specific | Write long paragraphs as the prompt |
