# ColorWarning

ColorWarning checks website colors for combinations that are hard to read, or hard to tell apart, for people with color-vision deficiency.

The check is meant for pull requests. A command reads CSS variables, a Tailwind theme, or a token file. A GitHub Action can post a picture of the original pair and the same pair under simulation. The VS Code extension warns for those same color-vision pairs.

## Status

The `colorwarning check` command reads a stylesheet, a static Tailwind theme, or a JSON token file. Passing pairs stay quiet. A finding prints the file, the line, both colors, the normal ratio, the simulated ratio, and the deficiency. Gradients, images, and unknown variables are unchecked and do not fail the command.

`colorwarning baseline <file>...` writes `colorwarning-baseline.json`. A later check stays quiet for those pairs, and reports only new ones. The match uses the file and the colors, so moving a rule does not reopen it. Put `colorwarning-ignore` in a comment on a finding's line, or on the line above it, to leave that one pair out.

`colorwarning swatch <file>...` writes `colorwarning-swatch.png`. Each new color-vision finding is drawn twice: the original pair, and the same pair under the deficiency that failed. Text is drawn on its background. Status colors sit side by side. Baselined and ignored pairs stay out of the picture. The command exits 0 when it writes the picture, and when there is nothing to draw.

The GitHub Action runs that check on a pull request. A finding adds or updates one comment and does not fail the workflow. A fine-grained or classic personal access token posts the swatch picture. The default Actions token posts the text, because GitHub does not accept that token for images.

`colorwarning scan` reads published colors from Bootstrap, Material, Radix, and shadcn and prints the same report as [SCAN.md](SCAN.md). The command exits 0. It publishes the report. It does not gate a build.

Stylelint rule `colorwarning/color-vision` warns for the same two color-vision problems. The warning does not fail the Stylelint run. `colorwarning check` still exits 1.

The VS Code extension warns in the editor for those same two problems. A baselined pair stays quiet, and so does a `colorwarning-ignore` comment.

The Storybook panel shows each of those findings twice: the original pair, and the same pair under simulation. Pass the story's CSS in `parameters.colorwarning`. The panel does not fail the Storybook build.

## Requirements

Node.js 22 or newer.

## Scripts

```bash
npm install
npm test
npm run typecheck
npm run build
npm run colorwarning -- check path/to/file.css
npm run colorwarning -- baseline path/to/file.css
npm run colorwarning -- swatch path/to/file.css
npm run colorwarning -- scan
```

`npm run colorwarning -- check <file>` is the local command. After this package is installed, the same command is `npx colorwarning check <file>`. The command exits 1 when it finds a new contrast or color-vision problem, and 0 when it does not. Baselined and ignored pairs do not fail the command.

## GitHub Action

```yaml
name: ColorWarning
on:
  pull_request:
permissions:
  contents: read
  pull-requests: write
jobs:
  colorwarning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: ManOfNeptune27/ColorWarning@main
        with:
          token: ${{ secrets.COLORWARNING_TOKEN }}
          files: |
            src/theme.css
```

Leave `files` empty to check every CSS file and Tailwind config, skipping `node_modules` and `dist`. Leave `token` unset to comment with the default Actions token. Set `token` to a fine-grained personal access token with pull request write access when the comment should include the swatch picture. A clean check removes the earlier comment.

## Public scan

[SCAN.md](SCAN.md) is the committed copy of `npm run colorwarning -- scan`. Bootstrap's success and danger colors collide under deuteranopia. Material's error and on-error stay apart. Radix names its scales by hue and step, so this check has no success or danger pair to compare. shadcn's default theme uses `oklch()`, which this check does not read yet.

## Stylelint

The rule reads a stylesheet the same way `colorwarning check` reads CSS. It warns when text passes ordinary contrast and fails after simulation, and when status colors collide after simulation. Passing pairs, ordinary contrast failures, gradients, and unknown variables stay quiet. A `colorwarning-ignore` comment leaves a pair out. A Stylelint disable comment does too.

The warning stays a warning. Stylelint's severity option does not turn it into an error. Use `colorwarning check` when a finding should fail a command. Tailwind configs and JSON token files stay on that command. Stylelint only sees CSS.

Stylelint 16 or newer.

```js
export default {
  plugins: ["colorwarning/stylelint"],
  rules: {
    "colorwarning/color-vision": true,
  },
};
```

## Storybook

Add `colorwarning/storybook` to the Storybook addons list. The panel reads the CSS for the open story. It draws text on its background, and status colors side by side. A `colorwarning-ignore` comment leaves that pair out. Passing pairs, ordinary contrast failures, and unknown variables stay quiet.

The panel does not read computed colors from the canvas. Put the stylesheet, or the part the story uses, in the parameter. Storybook 9 or 10.

```ts
// .storybook/main.ts
const config = {
  addons: ["colorwarning/storybook"],
};
export default config;
```

```ts
const meta = {
  parameters: {
    colorwarning: `
      .label { color: #ff0000; background-color: #000000; }
    `,
  },
};
```

`parameters.colorwarning` can also be `{ css: "..." }`. Set `{ disable: true }` to hide the panel for one story.

## VS Code

The extension reads a stylesheet, a static Tailwind theme, or a JSON token file in the editor. It warns when text passes ordinary contrast and fails after simulation, and when status colors collide after simulation. The warning highlights the color. Passing pairs, ordinary contrast failures, gradients, and unknown variables stay quiet.

A `colorwarning-ignore` comment leaves a pair out. The nearest `colorwarning-baseline.json`, walking up from the file, leaves those pairs out too. The extension does not change the file, and it does not repaint the page.

Build first, then install the `vscode` folder from this repo. VS Code 1.96 or newer.

```bash
npm install
npm run build
```

Open the Command Palette and run **Developer: Install Extension from Location...**. Choose the `vscode` folder. To try it in a development window, open this repo and press F5.

## License

[MIT](LICENSE)
