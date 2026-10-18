# Project maintenance

- Keep gameplay in browser-independent simulation modules and rendering in Canvas modules.
- Update README.md, ARCHITECTURE.md, and CHANGELOG.md in the same change whenever their documented behavior, setup, or structure changes. Documentation must remain concise English.
- Regenerate and include public/assets PNGs whenever scripts/generate-assets.js changes.
- Run npm run check before handing off gameplay or tooling changes. Install Playwright Chromium first when needed.
- Keep test-only browser hooks out of production builds. Do not add external art, runtime network services, or CI without a request.
