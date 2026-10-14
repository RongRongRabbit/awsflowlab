# AWS FlowLab development rules

- Iterate on the existing React / TypeScript / Vite app. App teaching text stays Japanese; Developer Guide prose stays Chinese; code identifiers and commit messages stay English.
- Keep deterministic WAF evaluation separate from React and playback. Allow / Block terminate, Count continues, lower unique non-negative Priority executes first, and Default Action is Allow / Block.
- Preserve beginner teaching, presenter mode, keyboard navigation, responsive layout, and the educational simulation disclaimer. Do not connect AWS or paid APIs.
- For every feature, behavior change, refactor, or stack adjustment, assess its impact on `docs/developer-guide.md`. Update affected sections, the actual file tree, code references, walkthroughs, and flow diagrams alongside code and tests.
- Markdown is the documentation source. Never hand-edit generated HTML. Run `npm run docs:build` and `npm run docs:check`; verify referenced paths, function names, and execution flows against code. The checker validates existence, not semantic correctness: review descriptions manually.
- If no documentation update is needed, explain why in the delivery report.
- Run `npm test`, `npm run typecheck`, `npm run build`, and `npm run docs:check` before committing. Build includes documentation generation. Do not skip or delete failed tests to obtain a pass.
- Commit related code, tests, and Markdown together using meaningful English Conventional Commits. Generated `dist/` output is a build artifact and is not committed; regenerate it from tracked Markdown/scripts.
- Inspect branch, worktree, and remotes first. Report pre-existing user changes and do not overwrite or commit them. Reuse an existing feature branch after inspection. Do not force push, push feature work to main, merge, or deploy without authorization.
- Never commit `node_modules`, `.env`, AWS credentials, keys, tokens, or unrelated files.
- Before adding a Pages workflow, inspect existing deployment configuration. Preserve the app entry and place documentation at `developer-guide/` within the same build. A public URL is verified only after a successful authorized deployment and HTTP/browser check.
