---
name: Field Logistics Operational System
colors:
  surface: '#fff8f2'
  surface-dim: '#e3d9ca'
  surface-bright: '#fff8f2'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#fdf2e3'
  surface-container: '#f8ecdd'
  surface-container-high: '#f2e7d7'
  surface-container-highest: '#ece1d2'
  on-surface: '#201b12'
  on-surface-variant: '#444652'
  inverse-surface: '#353026'
  inverse-on-surface: '#fbefe0'
  outline: '#757683'
  outline-variant: '#c5c5d4'
  surface-tint: '#4158b1'
  primary: '#4158b1'
  on-primary: '#ffffff'
  primary-container: '#7b91ee'
  on-primary-container: '#02247f'
  inverse-primary: '#b8c4ff'
  secondary: '#615e5b'
  on-secondary: '#ffffff'
  secondary-container: '#e4dedb'
  on-secondary-container: '#65625f'
  tertiary: '#585e6f'
  on-tertiary: '#ffffff'
  tertiary-container: '#9096a8'
  on-tertiary-container: '#282f3e'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dde1ff'
  primary-fixed-dim: '#b8c4ff'
  on-primary-fixed: '#001453'
  on-primary-fixed-variant: '#273f98'
  secondary-fixed: '#e7e1de'
  secondary-fixed-dim: '#cbc5c2'
  on-secondary-fixed: '#1d1b19'
  on-secondary-fixed-variant: '#494644'
  tertiary-fixed: '#dce2f6'
  tertiary-fixed-dim: '#c0c6d9'
  on-tertiary-fixed: '#151b29'
  on-tertiary-fixed-variant: '#404756'
  background: '#fff8f2'
  on-background: '#201b12'
  surface-variant: '#ece1d2'
typography:
  headline-xl:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: 40px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Inter
    fontSize: 26px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 26px
    letterSpacing: -0.01em
  headline-sm:
    fontFamily: Inter
    fontSize: 17px
    fontWeight: '600'
    lineHeight: 22px
    letterSpacing: 0em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: 0em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0.01em
  label-lg:
    fontFamily: Inter
    fontSize: 15px
    fontWeight: '600'
    lineHeight: 20px
    letterSpacing: 0.01em
  label-md:
    fontFamily: Inter
    fontSize: 13px
    fontWeight: '600'
    lineHeight: 18px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: Inter
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 14px
    letterSpacing: 0.04em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  gutter: 1rem
  margin: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system serves pharmaceutical waste management drivers executing route assignments, hazardous manifest tracking, and physical custody transfers in the field. The operational environment demands immediate glanceability under direct midday glare, gloved one-handed mobile interactions, and zero-ambiguity workflow verification. 

The aesthetic is functional, modern, and clinical—marrying high-contrast utility with warm, tactile clarity. Rather than cold clinical industrialism, the system combines warm architectural neutrals (`#FDFBF8`, `#EADFD0`) with an authoritative, energetic periwinkle-blue action tier (`#7B91EE`). The overall visual language conveys reliability, rigorous regulatory compliance, and rapid physical throughput.

Key tenants:
- **Zero-Error Ergonomics**: Crucial actions (manifest validation, biological seal confirmations, emergency aborts) rely on persistent minimum 48px hit areas and multi-point visual feedback.
- **Glanceable Status Architecture**: Information hierarchy is strictly stratified. Primary transport numbers and address points lead in dense `#201E1C`, surrounded by high-contrast categorical tags and muted supportive data.
- **Tactile Softened Precision**: Clean cards with generous rounding (`rounded-2xl` / 16px) resting on warm off-white canvases, fortified with structural hairline borders for edge definition under varied lighting conditions.

## Colors

The palette balances clinical legibility with warm, fatigue-reducing ambient surfaces.

### Primary Palette & Tonal Roles
- **Primary Action (`#7B91EE`)**: Applied to forward-driving interactive triggers, primary action buttons, active pipeline steps, focused input borders, and verified check states.
- **Primary Ink & Dark Accents (`#201E1C`)**: Used for high-priority typography, regulatory barcode representations, active tab indicators, and high-impact micro-surfaces. Provides an accessible contrast ratio exceeding 12:1 against the canvas.
- **Canvas Base (`#FDFBF8`)**: Warm, low-strain off-white used as the global screen background to eliminate pure-white glare during outdoor route inspection.
- **Elevated Card Surface (`#FFFFFF`)**: Pure crisp white reserved for actionable content cards, manifest modals, and modular containers to visually push foreground information closer to the driver.
- **Informational / Active Tint (`#E5EBFF`)**: Soft periwinkle tint designated for container backgrounds, passive route notifications, informational banners, and active selected chips.
- **Structural Neutral & Separators (`#EADFD0`)**: Warm sand tone for card borders, list dividers, inactive tracking dots, and container segmentations.

### Functional Alerts
- **Hazardous/Urgent Red (`#D94B38`)**: For biohazard discrepancies, weight mismatches, and route deviations.
- **Compliance Green (`#1E8E5A`)**: For chain-of-custody locked signatures, successful dock check-ins, and completed runs.
- **Amber Warning (`#D97706`)**: For temperature excursion risks and pending manifests.

## Typography

The typography uses Inter across all levels to prioritize legibility, precise tracking, and neutral optical balance. Numerals, license plates, waste tracking codes, and GPS distances demand uncompromised vertical scanning speed.

- **Weight Discipline**: 700 (Bold) for route milestones, addresses, and primary KPI metrics; 600 (Semi-Bold) for interactive labels, buttons, and section titles; 400 (Regular) for compliance notes, regulatory descriptions, and timestamps.
- **Tabular Figures**: All tracking numbers, cargo weights (kg/lbs), container counts, and countdowns must render with fixed tabular lining figures (`font-variant-numeric: tabular-nums`) to prevent horizontal jitter during updates.
- **Micro-Labels**: `label-sm` utilizes uppercase rendering with a `+0.04em` tracking offset for high-density badges such as "BIO-HAZARD", "RCRA HAZARDOUS", and "STOP 4 OF 12".

## Layout & Spacing

The layout is built primarily around standard handheld operational viewports (360px–430px wide), adapting fluidly to in-cab vehicle-mounted tablets (768px+).

- **Grid Model**: A 4-column fluid mobile grid structured around an 8pt base grid unit. Outer screen margins are locked to `1rem` (16px) to maximize usable screen real estate while protecting touch areas from edge gestures.
- **Vertical Spacing Rhythm**: Operational card stacks follow an explicit `0.75rem` (12px) separation, creating visual grouping without pushing subsequent route stops below the screen fold. 
- **Thumb-Zone Prioritization**: Primary forward actions (e.g., "Confirm Waste Scan", "Begin Transit") anchor to the lower 25% of the viewport with a sticky bottom safe-area container, elevated over scrolling manifests.
- **Tablet Adaptation**: On larger screens, the manifest list and the live depot navigation map split into an asymmetric 40/60 two-column interface, preserving the one-handed action rail on the right side.

## Elevation & Depth

To maintain high visibility under direct glare and sunlight, depth relies on surface tonal contrast reinforced with soft ambient shadows and low-contrast outlines.

- **Surface Tiers**:
  - `Level 0 (Canvas)`: `#FDFBF8` base screen background.
  - `Level 1 (Card/List Surface)`: `#FFFFFF` containers bounded by a 1px solid `#EADFD0` border.
  - `Level 2 (Active/Selected Card)`: `#FFFFFF` bounded by a 1.5px solid `#7B91EE` border with a subtle ambient tint.
  - `Level 3 (Floating Bar / Bottom Action Dock)`: `#FFFFFF` background with an ambient shadow: `0px 4px 20px -2px rgba(32, 30, 28, 0.08)`.
  - `Level 4 (Modals & Signature Capture)`: `#FFFFFF` over an opaque dimming scrim (`rgba(32, 30, 28, 0.5)`).

- **Shadow Character**: Shadows are subtle, warm-tinted (`rgba(32, 30, 28, ...)`), and used only where physical elevation is functionally meaningful (floating action trays and verification overlays). Cards remain flat with clear borders to avoid visual mud in bright light.

## Shapes

The interface embraces a rounded card-centric form factor:

- **Cards & Primary Modules**: Standardized to `rounded-2xl` (1rem / 16px). This rounds out dense medical-waste operational data, framing technical tables into easily digestible touch targets.
- **Buttons & Large Fields**: Standardized to `0.75rem` (12px) border radius for ergonomic tap boundaries.
- **Chips, Pills & Badges**: Fully rounded (pill shape / `9999px`) to immediately distinguish contextual status elements from tappable operational cards.
- **Nested Inner Surfaces**: Internal summary sections within cards (e.g., manifest counts inside a facility stop card) utilize `0.5rem` (8px) radius to maintain nested visual geometry.

## Components

### Buttons
- **Primary CTA**: Solid `#7B91EE` background, `#FFFFFF` text (`label-lg`), minimum height of 52px for gloved accessibility, 12px border radius. Active state darkens to `#657CD6`. Disabled state renders as `#EADFD0` background with `#201E1C` text at 40% opacity.
- **Secondary Action**: `#FFFFFF` background, `#201E1C` text, 1.5px solid `#EADFD0` border, minimum height 48px. Active press activates an `#E5EBFF` background fill.
- **Destructive/Exception Button**: `#FFFFFF` background, 1.5px solid `#D94B38` border, `#D94B38` text.

### Chips & Badges
- **Status Badges**: Pill-shaped container (`rounded-full`), height 24px, horizontal padding 10px. 
  - *Active Route / En Route*: `#E5EBFF` surface with `#7B91EE` text (`label-sm`).
  - *Pending Verification*: `#FDFBF8` surface with `#EADFD0` border, `#201E1C` text.
  - *Manifest Signed*: `#E6F5EE` surface with `#1E8E5A` text.
  - *Hazard/Discrepancy*: `#FDF0ED` surface with `#D94B38` text.

### Cards
- **Route Stop Card**: `#FFFFFF` background, 16px corner radius, 1px solid `#EADFD0` border. Internal padding is `1rem` (16px). Contains three zones:
  1. *Header*: Stop sequence marker, facility name, arrival ETA.
  2. *Body*: Address detail, waste category icons, manifest volume tags.
  3. *Action Footprint*: Full-width secondary tap surface or primary trigger depending on route state.
- **Active Card Variation**: 1.5px solid `#7B91EE` border with an interior subtle left-rail accent (4px solid `#7B91EE`).

### Pipeline & Step Indicators
- **Manifest Pipeline Tracker**: Horizontal flex container displaying linear progression: *Dispatched → Arrived → Scanned → Signed → Departed*.
- **Nodes**: Inactive steps are 8px `#EADFD0` dots. Active step is a 16px `#7B91EE` pill containing a white center dot. Completed steps show a 16px `#201E1C` circle with an embedded white checkmark. Connecting lines are 2px solid `#EADFD0`, turning to `#201E1C` as steps are completed.

### Lists
- **Manifest Barcode List**: High-density scan item lists. Each item has a 56px minimum row height, separated by 1px solid `#EADFD0` dividers. Uses tabular-lining Inter regular for serial IDs and bold font for weight metrics.
- Right-aligned swipe actions expose red hazard reject or green quick-verify actions.

### Inputs & Signature Surfaces
- **Text & Numeric Inputs**: Height 52px, `#FFFFFF` surface, 1px solid `#EADFD0` border, `#201E1C` input text. Focus state transitions border to 2px solid `#7B91EE`.
- **Chain-of-Custody Signature Pad**: Height 180px, `#FFFFFF` canvas, bounded by a 1px dashed `#EADFD0` border, containing an explicit `#E5EBFF` baseline guide for physical stylus or finger compliance capture.

### Checkboxes & Segmented Controls
- **Checkboxes**: 24px × 24px hit area with an 8px radius. Inactive: `#FFFFFF` with 2px solid `#EADFD0`. Selected: `#7B91EE` with a crisp `#FFFFFF` check icon.
- **Segmented Filter Bar**: Height 40px, `#E5EBFF` background with 10px radius. Active tab is an elevated `#FFFFFF` pill with a 1px solid `#EADFD0` border and `#201E1C` text.