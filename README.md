# AWS FlowLab v0.1 — AWS WAF Basics

Interactive Japanese-language AWS WAF beginner lesson for a 3–5 minute presentation.

## Run locally

Requires Node.js 20+.

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Build

```bash
npm run build
npm run preview
```

## GitHub Pages

The Vite base is `./`, which supports static deployment to a repository subpath. Upload the generated `dist/` directory using GitHub Actions or your preferred static hosting workflow.

## Features

- Four guided Japanese chapters
- Normal / simulated malicious HTTP requests
- Detection rule toggle
- Deterministic ALLOW / BLOCK evaluation
- Animated flow and step-by-step trace
- Presenter mode and keyboard chapter shortcuts (Alt+Left/Right)
- No backend, AWS account, or paid API required

## Scope and accuracy

This is an educational model, **not AWS WAF**. It assumes one simplified detection rule, a default ALLOW Web ACL action, and predetermined matches for the simulated malicious request. It does not implement actual AWS Managed Rules, HTTP parsing, rule priorities, CAPTCHA, labels, or real detection. Do not use its decisions for security validation.

## Next versions

- v0.2: Web ACL rule ordering, Count, labels, and match conditions
- v0.3: WAF Service Explorer integrated into AWS FlowLab
- v0.4: CloudFront / WAF architecture flows
