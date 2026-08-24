<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Design

Before touching any UI, read `DESIGN.md` at the repo root. It records the
token system, the calls already made (fixed emerald accent, soft
destructive, compact density) and the rules CSS cannot express. Values
live in `src/app/globals.css` and win over the document if the two ever
disagree.
