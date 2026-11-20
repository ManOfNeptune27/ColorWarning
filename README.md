# ColorWarning

ColorWarning checks website colors for combinations that are hard to read, or hard to tell apart, for people with color-vision deficiency.

The check is meant for pull requests. A command will read CSS variables, a Tailwind theme, or a token file. A GitHub Action can post a picture of the original pair and the same pair under simulation. An editor plugin comes later and will use the same results.

## Status

The `colorwarning check` command reads a stylesheet, a static Tailwind theme, or a JSON token file. Passing pairs stay quiet. A finding prints the file, the line, both colors, the normal ratio, the simulated ratio, and the deficiency. Gradients, images, and unknown variables are unchecked and do not fail the command.

## Requirements

Node.js 22 or newer.

## Scripts

```bash
npm install
npm test
npm run typecheck
npm run build
npm run colorwarning -- check path/to/file.css
```

`npm run colorwarning -- check <file>` is the local command. After this package is installed, the same command is `npx colorwarning check <file>`. The command exits 1 when it finds a contrast or color-vision problem, and 0 when it does not.

## License

[MIT](LICENSE)
