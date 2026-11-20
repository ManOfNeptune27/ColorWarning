# ColorWarning

ColorWarning warns when website colors are hard to read, or hard to tell apart, for people with color-vision deficiency.

Open a stylesheet, a static Tailwind theme, or a JSON token file. A warning appears on text that passes ordinary contrast and fails after simulation, and on status colors that collide after simulation. The warning highlights the color.

Passing pairs, ordinary contrast failures, gradients, and unknown variables stay quiet. The extension does not change the file, and it does not repaint the page.

Put `colorwarning-ignore` in a comment on a finding's line, or on the line above it, to leave that pair out. A `colorwarning-baseline.json` file in the project, or in a parent folder, leaves the saved pairs out too.

The same check is available as a command and a GitHub Action at [github.com/ManOfNeptune27/ColorWarning](https://github.com/ManOfNeptune27/ColorWarning).
