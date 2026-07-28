# Contributing to Zen Notes Widget

Thank you for your interest in improving Zen Notes!

## Development Setup

No build step required. This is a vanilla JS + CSS mod for Zen Browser.

```bash
# Clone
git clone https://github.com/jjspscl/zen-notes.git
cd zen-notes

# Test scripts
node scripts/validate-version.js
node scripts/validate-theme.js
node scripts/validate-header.js
node scripts/validate-css.js
node --check zen-notes-core.uc.js && node --check zen-notes-editor.uc.js && node --check zen-notes-ui.uc.js
```

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
```

This updates `theme.json`, `mod.json`, `// @version`, README badge, and ROADMAP.

## Testing in Zen Browser

1. Make your changes
2. Build a release ZIP: `node scripts/build-release.js`
3. In Sine settings, reinstall the mod from the built ZIP (Sine → Install from file)
4. Clear startup cache: `about:support` → "Clear startup cache"
5. Restart Zen Browser
6. Open Browser Console (`Ctrl+Shift+J`) to check for errors

Alternatively, load the repo folder as an unpublished local mod in Sine for faster iteration.

## Code Style

- **JavaScript**: 2-space indentation, single quotes, semicolons
- **CSS**: 2-space indentation, kebab-case selectors prefixed with `#zen-notes-widget`
- **No inline styles** — all widget styling in `style.css`
- **No external dependencies** — Zen chrome APIs only

## Before Submitting a PR

- [ ] `node scripts/validate-version.js` passes
- [ ] `node scripts/validate-theme.js` passes
- [ ] `node scripts/validate-header.js` passes
- [ ] `node scripts/validate-css.js` passes
- [ ] `node --check zen-notes-core.uc.js && node --check zen-notes-editor.uc.js && node --check zen-notes-ui.uc.js` passes
- [ ] Tested in Zen Browser after clearing startup cache
- [ ] Commit messages follow Conventional Commits format

## Questions?

Open an issue or discussion on GitHub.
