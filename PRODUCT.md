# Product

<!-- impeccable:product-schema 1 -->

> Inferred from README.md, MASTER_BRIEF.md, LEGAL.md and the code. The owner said to proceed without an interview (2026-10-08). Correct anything that's wrong.

## Platform

web

## Users

Small multifamily investors, analysts and students checking whether a deal works: they paste or type a few figures (price, units, rent, rate) or upload a rent roll, then read cash flow, debt and returns. Often on a laptop, sometimes on a phone (390px is a supported width). *(inferred)*

## Product Purpose

A free, browser-local tool for understanding multifamily property cash flows and financing. Quick analysis gives annual returns, debt schedules and sensitivity; the Monthly planner adds leasing, development, refinancing and investor scenarios. Success means a user can explain the numbers they got, not just see them.

## Positioning

Deterministic, transparent math that runs entirely in the browser, with no account, no backend and no AI claims. Every assumption is visible and editable, and the math is benchmarked against independent calculations (README "How the math is validated").

## Operating Context

Users paste deal text or upload CSV/XLSX rent rolls and operating statements, review the extracted figures, then read results and export a CSV, chart image or printable report. Hosted on Cloudflare Pages; deploys from `main`.

## Capabilities and Constraints

- No accounts, no backend, no paid APIs; all calculation is local. CSP: `script-src 'self'`; everything is bundled.
- Exception, opt-in builds only (`VITE_BROWSER_AI=1`, ADR-0011): an experimental document assistant may download an open model from Hugging Face after explicit consent and run it in the browser. CSP then adds `'wasm-unsafe-eval'` and Hugging Face to `connect-src`. It is described as an experimental suggestion, never as "AI-powered", and never approves or calculates figures.
- Financial calculations are frozen for UI work (see docs/adr/0001).
- Terminology: see CONTEXT.md (start page, composer, input review, quick analysis, monthly planner).

## Brand Commitments

Name "PropertyIQ" and the existing logo (`src/ui/Brand.tsx`). Calm, factual copy: no hype, testimonials, portraits or invented social proof. The examples are fictional and labelled as fictional.

## Evidence on Hand

The fictional Maple Grove sample (`src/finance/sharedSample.ts`), sample workbooks in `public/samples`, and test and verification results (TESTING.md). There are no customers, testimonials or press; never fabricate them.

## Product Principles

1. Show the work: every figure traces to an editable assumption.
2. Private by design: data stays in the browser.
3. Honest about limits: label fictional data, defaults and simplifications.
4. Free and fast: nothing should require sign-up to try.

## Accessibility & Inclusion

WCAG 2.1 AA, checked by axe in the Playwright suite. Visible focus states, `prefers-reduced-motion` respected, and no horizontal overflow at 390px.
