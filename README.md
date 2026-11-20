# ColorWarning

ColorWarning checks website colors for combinations that are hard to read, or hard to tell apart, for people with color-vision deficiency.

The check is meant for pull requests. A command will read CSS variables, a Tailwind theme, or a token file. A GitHub Action can post a picture of the original pair and the same pair under simulation. An editor plugin comes later and will use the same results.

## Status

Color parsing, the WCAG contrast ratio, and the color-vision verdicts are in place. Reading project files and the command are not implemented yet.

## Requirements

Node.js 22 or newer.

## Scripts

```bash
npm install
npm test
npm run typecheck
```

## License

[MIT](LICENSE)
