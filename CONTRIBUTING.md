# Contributing to Zen Notes Widget

Thank you for your interest in improving Zen Notes!

## Development Setup

Vanilla JS + CSS mod, no build step. Dev tooling only: Node 22+, Biome, linkedom.

```bash
git clone https://github.com/jjspscl/zen-notes.git
cd zen-notes
npm ci
npm run check   # biome + validate + tests (what CI runs)
npm run fmt     # format
npm run zen     # live-reloading harness (Windows Zen from WSL, disposable profile)
```

Layout and rules: [AGENTS.md](AGENTS.md) and [docs/architecture.md](docs/architecture.md). Never install by copying into a profile; use Sine.

## Conventional Commits

We follow [Conventional Commits](https://www.conventionalcommits.org/) to auto-generate changelogs.

### Format

```
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

### Types

| Type | Use when |
|------|----------|
| `feat` | Adding a new feature |
| `fix` | Fixing a bug |
| `docs` | Documentation only changes |
| `style` | Code style changes (formatting, semicolons, etc.) |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf` | Performance improvement |
| `test` | Adding or correcting tests |
| `chore` | Build process or auxiliary tool changes |

### Examples

```bash
feat: add word count display to footer
fix: toolbar buttons invisible in compact sidebar mode
docs: update install instructions for Zen 1.8
chore: bump version to v0.3.0
refactor: extract drag logic into separate function
```

### Scopes (optional)

Use a scope to clarify what part of the project changed:

- `js` — `zen-notes-core.uc.js`, `zen-notes-editor.uc.js`, `zen-notes-ui.uc.js`
- `css` — `style.css`
- `docs` — README, install.md, ROADMAP
- `ci` — GitHub Actions workflows
- `scripts` — build/validation scripts

Example:
```bash
feat(js): add auto-save interval for crash protection
fix(css): dark mode card colors too saturated
```

## Version Bumping

Use the bump script before releasing:

```bash
node scripts/bump.js patch   # 0.2.2 → 0.2.3
node scripts/bump.js minor   # 0.2.2 → 0.3.0
node scripts/bump.js major   # 0.2.2 → 1.0.0
# bump.js also sets theme.json updatedAt/homepage; Sine needs a newer updatedAt to offer an update
```

This updates `theme.json`, `mod.json`, `// @version`, README badge, and ROADMAP.

## Testing in Zen Browser

Run the automated tests and launch the live XHTML harness:

```bash
npm ci
npm test
npm run zen
```

The harness serves source files from the checkout and reloads on save in a
disposable Zen profile. It uses stubbed storage, so it does not verify actual
profile IO. For end-to-end checks, install the beta branch through Sine in a
separate test profile and verify migration, restart, rollback, and multiple
windows. Do not manually copy mod files into a profile; Sine manages that folder.

## Code Style

- **JavaScript**: 2-space indentation, single quotes, semicolons
- **CSS**: 2-space indentation, kebab-case selectors prefixed with `#zen-notes-widget`
- **No inline styles** — all widget styling in `src/style.css`
- **No runtime dependencies** — Node tooling dependencies are dev-only and excluded from release packages

## Before Submitting a PR

- [ ] `npm run check` passes (Biome, release-contract validation, tests)
- [ ] Tested the XHTML harness in Zen
- [ ] Tested file persistence and migrations through Sine before stable promotion
- [ ] Commit messages follow Conventional Commits format

## Questions?

Open an issue or discussion on GitHub.
