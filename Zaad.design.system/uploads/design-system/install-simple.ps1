# Tmkeen Design System — Simple Installer (no zip)
# Copy ALL this file to Notepad -> Save as install-simple.ps1
# Run: powershell -ExecutionPolicy Bypass -File install-simple.ps1

$Root = "C:\Users\asama\Projects\itsalplatform.zaad\design-system"
New-Item -ItemType Directory -Force -Path $Root | Out-Null
New-Item -ItemType Directory -Force -Path (Join-Path $Root "examples") | Out-Null

Write-Host "Writing tokens.css..." -ForegroundColor Cyan
@'
/**
 * Tmkeen Design System — Design Tokens
 * استورد هذا الملف في أي منصة (React, Vue, WordPress, HTML)
 */
@import url("https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap");

:root {
  /* Brand */
  --tmkeen-primary: #8b1538;
  --tmkeen-primary-dark: #6e102c;
  --tmkeen-primary-light: #a31a44;

  --tmkeen-secondary: #f2b824;
  --tmkeen-secondary-dark: #d9a31f;
  --tmkeen-secondary-light: #f5c84d;

  --tmkeen-brand-gray: #706f6f;

  /* Surfaces */
  --tmkeen-surface: #ffffff;
  --tmkeen-surface-muted: #f5f5f5;
  --tmkeen-surface-border: #e8e8e8;
  --tmkeen-background: #f5f5f5;
  --tmkeen-foreground: #706f6f;

  /* Semantic */
  --tmkeen-success: #15803d;
  --tmkeen-success-bg: #dcfce7;
  --tmkeen-warning: #854d0e;
  --tmkeen-warning-bg: #fef9c3;
  --tmkeen-danger: #991b1b;
  --tmkeen-danger-bg: #fee2e2;
  --tmkeen-overlay: rgba(0, 0, 0, 0.5);

  /* Typography */
  --tmkeen-font-sans: "Tajawal", Tahoma, Arial, sans-serif;

  /* Spacing */
  --tmkeen-page-max-width: 72rem;
  --tmkeen-radius-lg: 0.5rem;
  --tmkeen-radius-xl: 0.75rem;

  /* Aliases (متوافقة مع globals.css الحالي) */
  --background: var(--tmkeen-background);
  --foreground: var(--tmkeen-foreground);
  --primary: var(--tmkeen-primary);
  --secondary: var(--tmkeen-secondary);
}
'@ | Set-Content -Path (Join-Path $Root 'tokens.css') -Encoding UTF8

Write-Host "Writing components.css..." -ForegroundColor Cyan
@'
/**
 * Tmkeen Design System — Component Classes (framework-agnostic)
 * يتطلب tokens.css
 */

/* ── Base RTL ── */
.tmkeen-root,
[data-tmkeen] {
  color: var(--tmkeen-foreground);
  background: var(--tmkeen-background);
  font-family: var(--tmkeen-font-sans);
  direction: rtl;
  text-align: start;
  -webkit-font-smoothing: antialiased;
}

/* ── Buttons ── */
.btn-primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--tmkeen-radius-lg);
  background: var(--tmkeen-primary);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  color: #fff;
  text-align: start;
  transition: background-color 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-primary:hover {
  background: var(--tmkeen-primary-dark);
}
.btn-primary:focus-visible {
  outline: 2px solid var(--tmkeen-primary);
  outline-offset: 2px;
}
.btn-primary:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.btn-secondary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--tmkeen-radius-lg);
  border: 1px solid var(--tmkeen-surface-border);
  background: var(--tmkeen-surface);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  color: var(--tmkeen-brand-gray);
  text-align: start;
  transition: background-color 0.15s ease;
  cursor: pointer;
}
.btn-secondary:hover {
  background: var(--tmkeen-surface-muted);
}
.btn-secondary:focus-visible {
  outline: 2px solid var(--tmkeen-surface-border);
  outline-offset: 2px;
}

.btn-recommend {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--tmkeen-radius-lg);
  background: var(--tmkeen-secondary);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  color: var(--tmkeen-warning);
  text-align: start;
  transition: background-color 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-recommend:hover {
  background: var(--tmkeen-secondary-light);
}

.btn-register {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: var(--tmkeen-radius-lg);
  background: rgb(250, 204, 21);
  padding: 0.75rem 1.5rem;
  font-weight: 600;
  color: var(--tmkeen-warning);
  text-align: start;
  transition: background-color 0.15s ease;
  border: none;
  cursor: pointer;
}
.btn-register:hover {
  background: var(--tmkeen-secondary);
}

/* ── Cards ── */
.card {
  border-radius: var(--tmkeen-radius-xl);
  border: 2px solid var(--tmkeen-surface-border);
  background: var(--tmkeen-surface);
  padding: 1.5rem;
  text-align: start;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

.card-section {
  border-radius: var(--tmkeen-radius-xl);
  border: 2px solid color-mix(in srgb, var(--tmkeen-primary) 20%, transparent);
  background: var(--tmkeen-surface);
  padding: 1.25rem;
  text-align: start;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}

/* ── Forms ── */
.input-field {
  width: 100%;
  border-radius: var(--tmkeen-radius-lg);
  border: 1px solid var(--tmkeen-surface-border);
  background: var(--tmkeen-surface);
  padding: 0.75rem 1rem;
  color: var(--tmkeen-brand-gray);
  text-align: start;
  outline: none;
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
}
.input-field:focus {
  border-color: var(--tmkeen-primary);
  box-shadow: 0 0 0 2px color-mix(in srgb, var(--tmkeen-primary) 20%, transparent);
}

.label-field {
  display: block;
  margin-bottom: 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--tmkeen-brand-gray);
  text-align: start;
}

/* LTR fields (email, phone, url, datetime) */
input[type="email"],
input[type="tel"],
input[type="url"],
input[type="datetime-local"],
input[type="password"][dir="ltr"],
.input-field[dir="ltr"] {
  direction: ltr;
  text-align: left;
}

/* ── Badges ── */
.badge-primary {
  display: inline-block;
  border-radius: 9999px;
  background: color-mix(in srgb, var(--tmkeen-primary) 10%, transparent);
  padding: 0.125rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tmkeen-primary);
}

.badge-warning {
  display: inline-block;
  border-radius: 0.25rem;
  background: var(--tmkeen-warning-bg);
  padding: 0.125rem 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tmkeen-warning);
}

.badge-danger {
  display: inline-block;
  border-radius: 9999px;
  background: var(--tmkeen-danger-bg);
  padding: 0.125rem 0.75rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tmkeen-danger);
}

.badge-success {
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--tmkeen-success);
}

/* ── Layout helpers ── */
.page-shell {
  min-height: 100vh;
  background: var(--tmkeen-surface-muted);
}

.page-container {
  margin-inline: auto;
  max-width: var(--tmkeen-page-max-width);
  padding-inline: 1rem;
  padding-block: 2rem;
}

.page-container-narrow {
  margin-inline: auto;
  max-width: 28rem;
  padding-inline: 1rem;
  padding-block: 3rem;
}

/* ── Tables ── */
.tmkeen-table {
  width: 100%;
  font-size: 0.875rem;
  text-align: start;
}
.tmkeen-table thead {
  background: color-mix(in srgb, var(--tmkeen-primary) 5%, transparent);
  color: var(--tmkeen-primary);
}
.tmkeen-table th,
.tmkeen-table td {
  padding: 0.75rem 1rem;
}
.tmkeen-table tbody tr {
  border-top: 1px solid var(--tmkeen-surface-border);
}
.tmkeen-table tbody tr:nth-child(even) {
  background: color-mix(in srgb, var(--tmkeen-surface-muted) 40%, transparent);
}
.tmkeen-table tbody tr:hover {
  background: color-mix(in srgb, var(--tmkeen-secondary) 10%, transparent);
  cursor: pointer;
}

/* ── Tabs (segmented) ── */
.tab-bar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  border-radius: var(--tmkeen-radius-xl);
  background: var(--tmkeen-surface);
  padding: 0.25rem;
  box-shadow: 0 1px 2px 0 rgb(0 0 0 / 0.05);
}
.tab-bar button {
  flex: 1;
  min-width: 100px;
  border-radius: var(--tmkeen-radius-lg);
  padding: 0.75rem 0.5rem;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--tmkeen-brand-gray);
  background: transparent;
  border: none;
  cursor: pointer;
  transition: background-color 0.15s ease, color 0.15s ease;
}
.tab-bar button[data-active="true"],
.tab-bar button.active {
  background: var(--tmkeen-primary);
  color: #fff;
}

/* ── Modal overlay ── */
.modal-overlay {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--tmkeen-overlay);
  padding: 1rem;
}
.modal-panel {
  max-height: 90vh;
  width: 100%;
  max-width: 32rem;
  overflow-y: auto;
}
.modal-panel.wide {
  max-width: 48rem;
}
'@ | Set-Content -Path (Join-Path $Root 'components.css') -Encoding UTF8

Write-Host "Writing tailwind.preset.ts..." -ForegroundColor Cyan
@'
import type { Config } from "tailwindcss";

/**
 * Tmkeen Design System — Tailwind Preset
 *
 * Usage in tailwind.config.ts:
 *   import tmkeenPreset from "./design-system/tailwind.preset";
 *   export default { presets: [tmkeenPreset], content: [...] };
 */
const tmkeenPreset: Partial<Config> = {
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: "#8B1538",
          dark: "#6E102C",
          light: "#A31A44",
        },
        secondary: {
          DEFAULT: "#F2B824",
          dark: "#D9A31F",
          light: "#F5C84D",
        },
        brand: {
          gray: "#706F6F",
        },
        surface: {
          DEFAULT: "#FFFFFF",
          muted: "#F5F5F5",
          border: "#E8E8E8",
        },
      },
      fontFamily: {
        sans: ["Tajawal", "Tahoma", "Arial", "sans-serif"],
      },
      maxWidth: {
        page: "72rem",
      },
    },
  },
};

export default tmkeenPreset;
'@ | Set-Content -Path (Join-Path $Root 'tailwind.preset.ts') -Encoding UTF8

Write-Host "Writing tokens.json..." -ForegroundColor Cyan
@'
{
  "$schema": "https://design-tokens.github.io/community-group/format/",
  "meta": {
    "name": "Tmkeen Design System",
    "version": "1.0.0",
    "locale": "ar-SA",
    "direction": "rtl",
    "source": "tmkeen platform — جمعية الزاد"
  },
  "color": {
    "primary": {
      "default": { "value": "#8B1538", "type": "color" },
      "dark": { "value": "#6E102C", "type": "color" },
      "light": { "value": "#A31A44", "type": "color" }
    },
    "secondary": {
      "default": { "value": "#F2B824", "type": "color" },
      "dark": { "value": "#D9A31F", "type": "color" },
      "light": { "value": "#F5C84D", "type": "color" }
    },
    "brand": {
      "gray": { "value": "#706F6F", "type": "color" }
    },
    "surface": {
      "default": { "value": "#FFFFFF", "type": "color" },
      "muted": { "value": "#F5F5F5", "type": "color" },
      "border": { "value": "#E8E8E8", "type": "color" }
    },
    "semantic": {
      "success": { "value": "#15803D", "type": "color" },
      "successBg": { "value": "#DCFCE7", "type": "color" },
      "warning": { "value": "#854D0E", "type": "color" },
      "warningBg": { "value": "#FEF9C3", "type": "color" },
      "danger": { "value": "#991B1B", "type": "color" },
      "dangerBg": { "value": "#FEE2E2", "type": "color" },
      "overlay": { "value": "rgba(0, 0, 0, 0.5)", "type": "color" }
    },
    "text": {
      "foreground": { "value": "#706F6F", "type": "color" },
      "heading": { "value": "#8B1538", "type": "color" },
      "onPrimary": { "value": "#FFFFFF", "type": "color" },
      "onSecondary": { "value": "#7F1D1D", "type": "color" }
    }
  },
  "typography": {
    "fontFamily": {
      "sans": { "value": "Tajawal, Tahoma, Arial, sans-serif", "type": "fontFamily" }
    },
    "fontWeight": {
      "regular": { "value": "400", "type": "fontWeight" },
      "medium": { "value": "500", "type": "fontWeight" },
      "semibold": { "value": "600", "type": "fontWeight" },
      "bold": { "value": "700", "type": "fontWeight" },
      "extrabold": { "value": "800", "type": "fontWeight" }
    },
    "fontSize": {
      "xs": { "value": "0.75rem", "type": "dimension" },
      "sm": { "value": "0.875rem", "type": "dimension" },
      "base": { "value": "1rem", "type": "dimension" },
      "lg": { "value": "1.125rem", "type": "dimension" },
      "xl": { "value": "1.25rem", "type": "dimension" },
      "2xl": { "value": "1.5rem", "type": "dimension" },
      "3xl": { "value": "1.875rem", "type": "dimension" },
      "4xl": { "value": "2.25rem", "type": "dimension" },
      "5xl": { "value": "3rem", "type": "dimension" }
    },
    "lineHeight": {
      "relaxed": { "value": "1.625", "type": "number" }
    }
  },
  "spacing": {
    "pageMaxWidth": { "value": "72rem", "type": "dimension", "comment": "max-w-6xl" },
    "cardPadding": { "value": "1.5rem", "type": "dimension" },
    "cardSectionPadding": { "value": "1.25rem", "type": "dimension" },
    "inputPaddingX": { "value": "1rem", "type": "dimension" },
    "inputPaddingY": { "value": "0.75rem", "type": "dimension" },
    "buttonPaddingX": { "value": "1.5rem", "type": "dimension" },
    "buttonPaddingY": { "value": "0.75rem", "type": "dimension" }
  },
  "radius": {
    "lg": { "value": "0.5rem", "type": "dimension" },
    "xl": { "value": "0.75rem", "type": "dimension" },
    "full": { "value": "9999px", "type": "dimension" }
  },
  "shadow": {
    "sm": { "value": "0 1px 2px 0 rgb(0 0 0 / 0.05)", "type": "shadow" },
    "lg": { "value": "0 10px 15px -3px rgb(0 0 0 / 0.1)", "type": "shadow" },
    "xl": { "value": "0 20px 25px -5px rgb(0 0 0 / 0.1)", "type": "shadow" },
    "2xl": { "value": "0 25px 50px -12px rgb(0 0 0 / 0.25)", "type": "shadow" }
  },
  "layout": {
    "direction": { "value": "rtl", "type": "string" },
    "textAlign": { "value": "start", "type": "string" }
  }
}
'@ | Set-Content -Path (Join-Path $Root 'tokens.json') -Encoding UTF8

Write-Host "Writing package.json..." -ForegroundColor Cyan
@'
{
  "name": "@tmkeen/design-system",
  "version": "1.0.0",
  "description": "Design tokens and CSS components for Tmkeen platform (Arabic RTL)",
  "private": true,
  "files": [
    "tokens.json",
    "tokens.css",
    "components.css",
    "tailwind.preset.ts",
    "README.md",
    "examples/"
  ],
  "exports": {
    "./tokens.css": "./tokens.css",
    "./components.css": "./components.css",
    "./tokens.json": "./tokens.json",
    "./tailwind.preset": "./tailwind.preset.ts"
  }
}
'@ | Set-Content -Path (Join-Path $Root 'package.json') -Encoding UTF8

Write-Host "Writing examples/html-rtl-demo.html..." -ForegroundColor Cyan
@'
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Tmkeen Design System — Demo</title>
    <link rel="stylesheet" href="../tokens.css" />
    <link rel="stylesheet" href="../components.css" />
  </head>
  <body class="tmkeen-root page-shell">
    <header
      style="
        border-bottom: 1px solid var(--tmkeen-surface-border);
        background: var(--tmkeen-surface);
        padding: 0.75rem 1rem;
      "
    >
      <div class="page-container" style="padding-block: 0.75rem">
        <strong style="color: var(--tmkeen-primary); font-size: 1.25rem">نظام تصميم التمكين</strong>
      </div>
    </header>

    <main class="page-container">
      <h1 style="color: var(--tmkeen-primary); font-size: 2rem; font-weight: 800; margin-bottom: 1rem">
        معاينة المكوّنات
      </h1>
      <p style="color: var(--tmkeen-brand-gray); margin-bottom: 2rem">
        هذا الملف يعمل بدون React أو Tailwind — HTML + CSS فقط.
      </p>

      <section class="card" style="margin-bottom: 1.5rem">
        <h2 style="color: var(--tmkeen-primary); font-weight: 700; margin-bottom: 1rem">الأزرار</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 0.75rem">
          <button type="button" class="btn-primary">أساسي</button>
          <button type="button" class="btn-secondary">ثانوي</button>
          <button type="button" class="btn-recommend">توصية</button>
          <button type="button" class="btn-register">تسجيل</button>
        </div>
      </section>

      <section class="card-section" style="margin-bottom: 1.5rem">
        <h2 style="color: var(--tmkeen-primary); font-weight: 700; margin-bottom: 1rem">نموذج</h2>
        <label class="label-field" for="email">البريد الإلكتروني</label>
        <input id="email" type="email" class="input-field" dir="ltr" placeholder="email@example.com" />
        <label class="label-field" for="name" style="margin-top: 1rem">الاسم</label>
        <input id="name" type="text" class="input-field" placeholder="الاسم الكامل" />
      </section>

      <section class="card" style="margin-bottom: 1.5rem">
        <h2 style="color: var(--tmkeen-primary); font-weight: 700; margin-bottom: 1rem">الشارات</h2>
        <span class="badge-primary">نشط</span>
        <span class="badge-warning" style="margin-inline: 0.5rem">طلب معلّق</span>
        <span class="badge-danger">غير مرفق</span>
        <span class="badge-success" style="margin-inline-start: 0.5rem">مرفق ✓</span>
      </section>

      <section class="card">
        <h2 style="color: var(--tmkeen-primary); font-weight: 700; margin-bottom: 1rem">جدول</h2>
        <table class="tmkeen-table">
          <thead>
            <tr>
              <th>الاسم</th>
              <th>الجوال</th>
              <th>المرحلة</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>أحمد محمد</td>
              <td dir="ltr">0501234567</td>
              <td><span class="badge-primary">إرشاد</span></td>
            </tr>
            <tr>
              <td>سارة علي</td>
              <td dir="ltr">0559876543</td>
              <td><span class="badge-warning">طلب انتقال</span></td>
            </tr>
          </tbody>
        </table>
      </section>
    </main>
  </body>
</html>
'@ | Set-Content -Path (Join-Path $Root 'examples/html-rtl-demo.html') -Encoding UTF8

Write-Host "Done! Files at: $Root" -ForegroundColor Green
Get-ChildItem $Root -Recurse | Select-Object FullName
