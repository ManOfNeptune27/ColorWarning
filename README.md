# ColorWarning

ColorWarning checks website colors for combinations that are hard to read, or hard to tell apart, for people with color-vision deficiency.

The check is meant for pull requests. A command will read CSS variables, a Tailwind theme, or a token file. A GitHub Action can post a picture of the original pair and the same pair under simulation. An editor plugin comes later and will use the same results.

## Status

Color parsing, contrast, color-vision verdicts, and file reading are in place. The command is not implemented yet. CSS custom properties, a static Tailwind theme, and a JSON token file can be read into text-on-background pairs. Gradients, images, and variables that cannot be resolved stay unchecked.

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
