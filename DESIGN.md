# Friend interface

## Direction

A calm personal workbench for thinking with an assistant. The chat, composer, and conversation history remain the primary structure; the UI avoids dashboard metrics and decorative widget grids.

## Color and materials

- Dark theme: warm charcoal canvas (`#151612`), raised charcoal panels, soft olive highlight (`#d4df9b`), and sage-gray secondary text.
- Light theme: soft paper canvas (`#f4f3ed`), near-white panels, olive highlight (`#52642d`), and deep muted green-gray text.
- Borders are low-contrast separators. Shadows are reserved for elevated controls, dialogs, and the composer.

## Typography

System sans-serif stacks keep the interface fast and legible without external font requests. Headings use size and weight rather than decorative type.

## Composition and interaction

- Desktop: persistent conversation sidebar, compact provider indicator, centered conversation measure, and a bottom composer.
- Mobile: conversation list becomes an accessible slide-in drawer; the provider and composer remain visible.
- User and assistant messages use distinct labels and compact avatars. Markdown supports tables and syntax-highlighted code.
- The light/dark switch persists locally. Message controls expose attachment, dictation, speech playback, and browser print/export.

## Accessibility and resilience

Controls have action labels, error states remain visible, and the layout reflows for narrow screens. Voice features detect browser support rather than assuming it.
