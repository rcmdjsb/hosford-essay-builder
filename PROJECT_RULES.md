# Hosford Essay Builder — Project Rules & Architecture

## 1. Mission & Audience
**Hosford Essay Builder** is a clean, distraction-free, multi-page student essay writing web application built for **Hosford Middle School** students on Chromebooks and desktop browsers. Every paragraph is broken into scaffolded, chunked boxes on its own wizard page, then automatically stitched into a properly formatted MLA essay ready for Google Docs or PDF export.

## 2. Technical Constraints
- **Zero external dependencies**: Pure HTML5, CSS3, and vanilla JavaScript. No npm packages, bundlers, frameworks, or external CDN fonts/scripts required.
- **Instant execution**: Must run seamlessly both over a local/static HTTP server and directly via `file://` in Chrome/Chromebooks (classic deferred scripts with clean namespaced modules rather than CORS-restricted `file://` ES modules).
- **Modular file structure**:
  - `index.html` — Semantic page shell, accessible modal `<dialog>`, header, wizard progress bar, and main stage container.
  - `style.css` — Hosford Husky design tokens, responsive Chromebook-first layout, wizard controls, authentic MLA preview sheet, and dedicated `@media print` rules.
  - `export.js` — Pure essay stitching, MLA HTML/plain-text formatting, Clipboard API export (rich HTML + plain text fallback for Google Docs), and Print/PDF controller (`window.HosfordExport`).
  - `app.js` — State schema, `localStorage` auto-save/restore, multi-page wizard navigation, dynamic Body Paragraphs & repeatable Evidence Chunks rendering, and confirmation dialog logic.
  - `PROJECT_RULES.md` — Architectural guidelines, branding standards, and data conventions.

## 3. Branding & Visual System (Hosford Middle School Huskies)
| Token | Hex | Usage |
|---|---|---|
| `--husky-teal` | `#1F7A99` | Primary buttons, active step pills, focus outlines, progress bar fill |
| `--husky-teal-dark` | `#175E77` | Hover/active states for primary actions |
| `--husky-cyan` | `#7CC9E8` | Light accents, focus rings, badge highlights, subtle borders |
| `--husky-navy` | `#061A22` | Top application header, primary high-contrast headings |
| `--surface-bg` | `#F2F6F8` | Soft light-slate outer canvas to reduce eye strain |
| `--surface-card` | `#FFFFFF` | High-contrast white writing cards and inputs |
| `--text-primary` | `#0F222B` | High-contrast body text (WCAG AAA on white) |
| `--text-muted` | `#4A626E` | Helper prompts, step subtitles, labels |

### Chromebook Ergonomics & Accessibility
- Minimum `16px` input font size with `1.6` line height and auto-expanding textareas.
- High-contrast focus rings (`:focus-visible`) on all interactive controls.
- Keyboard-accessible modal `<dialog>` for destructive confirmations (never raw `window.confirm`).
- Distraction-free layout: one essay section per page, clear visual hierarchy, no unnecessary chrome.

## 4. Wizard Flow & Paragraph Scaffolding
1. **Page 1 — MLA Header & Setup**: Student Name, Teacher Name, Class/Period, Date (with one-click MLA date helper), and Essay Title.
2. **Page 2 — Introduction Paragraph**:
   - *Hook* (describe the topic without naming it directly)
   - *Context* ("This is what happens in/with...")
   - *Claim Statement* (main thesis/claim)
3. **Pages 3..5+ — Body Paragraph 1, 2, 3 (default 3 body paragraphs, dynamically expandable)**:
   - Starts with **3 dedicated Body Paragraph pages** out of the box (classic 5-paragraph essay structure: Intro + Body 1, Body 2, Body 3 + Conclusion).
   - *Topic Sentence*
   - *Evidence Chunk 1..M* (repeatable via `+ Add Another Evidence Chunk` right above Concluding Sentence, each containing Quote/Concrete Detail, Summary of the Quote, and Explanation/Analysis, with a Remove option when multiple chunks exist)
   - *Concluding Sentence*
   - `+ Add Another Body Paragraph` dynamically appends Body Paragraph 4, 5, etc., with the identical structure, and extra body paragraphs can be deleted if fewer are needed.
4. **Second-to-Last Page — Conclusion Paragraph**:
   - Reference callout displaying the original *Claim Statement* from Page 2 above the first input.
   - *Restated Claim*
   - *Summary of Body Paragraphs*
   - *Why It All Matters (Mic Drop)*
5. **Page 7 — Final MLA Essay**:
   - Live stitched essay in true MLA 9th Edition formatting.
   - One-click **Copy Essay to Clipboard** (Google Docs ready), **Print / Save as PDF**, and status link to Step 8.
6. **Page 8 — Review & Rubric (Interactive Student Self-Assessment)**:
   - **Pre-Submission Student Checklist**: 5 interactive checkboxes covering Hook, Context/Claim, Quote Summary & Explanation, Conclusion, and MLA formatting.
   - **4-Level Proficiency Rubric (DP, CP, PR, HP)**: Clickable Traits of Writing grid (`Ideas & Claim`, `Organization & Chunking`, `Evidence & Elaboration`, `Voice & Word Choice`, `Conventions & MLA Format`) across `DP` (Developing Proficiency), `CP` (Close to Proficiency), `PR` (Proficient), and `HP` (Highly Proficient).
   - **Self-Evaluation Summary & Print Integration**: Displays live self-assessment summary and attaches a clean, formatted Self-Assessment Summary sheet on a new page right after the MLA essay when printing/saving as PDF.

## 5. Data Schema & Persistence
- Student essay storage key: `hosford_essay_builder_v1` in `localStorage`.
- Teacher video settings storage key: `hosford_essay_video_settings_v1` in `localStorage` (preserved even when students click **Clear / Start New Essay**).
- Auto-saved on every `input` event and structural change (add/remove chunk, add/remove body paragraph, page change, checklist/rubric updates).
- **Clear / Start New Essay** requires explicit modal confirmation before clearing essay storage and resetting state.

## 6. Paragraph Video Help & Teacher Customization
- Each paragraph writing page (**Introduction**, **Body Paragraphs 1..N**, and **Conclusion**) displays a distraction-free **Watch Video Help** button in the page header.
- Clicking it opens a modal `<dialog>` player embedding the video via privacy-enhanced `https://www.youtube-nocookie.com/embed/<ID>?rel=0`, clears the iframe `src` on close so audio never plays in the background, and includes an **Open on YouTube** fallback link for filtered school networks.
- Default URLs are configured in `DEFAULT_VIDEO_LESSONS` at the top of `app.js` and can also be customized directly in the browser via the **Video Settings** modal (supports full YouTube URLs, `youtu.be` short links, embed/shorts URLs, or bare 11-character IDs, plus a **Reset to Defaults** button).

## 6. MLA Formatting & Export Rules
- Font: `Times New Roman`, `12pt`.
- Line spacing: True double-spacing (`line-height: 2`) throughout heading, title, and body paragraphs with zero extra blank spacing between paragraphs.
- Margins: `1in` all around on print/PDF (`@page { size: letter; margin: 1in; }`).
- Running header: Top-right `<Student Last Name> <Page Number>`.
- Top-left 4-line MLA heading: Student Name, Teacher Name, Class/Period, Date.
- Title: Centered, plain 12pt Times New Roman (no bold, italic, underline, or all-caps).
- Paragraphs: Left-aligned with `0.5in` first-line indentation.
- Stitching rule: Each chunked box is trimmed, internal line breaks are normalized to spaces, empty boxes are skipped cleanly, and non-empty sentences are joined with a single space into one cohesive paragraph.
