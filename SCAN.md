# Public scan

ColorWarning read the published colors of Bootstrap, Material, Radix, and shadcn. Passing pairs stay quiet.

## Bootstrap

The light theme custom properties in Bootstrap 5.3.8.

https://cdn.jsdelivr.net/npm/bootstrap@5.3.8/dist/css/bootstrap.css

bootstrap.css:33 --bs-success / --bs-danger
  #198754 and #dc3545
  cvd-collision under deuteranopia
  distance 0.31, simulated 0.07

1 finding, 0 unchecked

## Material

Default theme custom properties from @material/theme 14.0.0, including error and on-error.

https://cdn.jsdelivr.net/npm/@material/theme@14.0.0/dist/mdc.theme.css

no findings

## Radix

sRGB light scales for green, red, yellow, and blue from Radix Colors 3.0.0. These scales are named by hue and step, such as --green-9 and --red-9.

https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/green.css
https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/red.css
https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/yellow.css
https://cdn.jsdelivr.net/npm/@radix-ui/colors@3.0.0/blue.css

no findings

## shadcn

Default light theme tokens from shadcn/ui. The values use oklch().

https://github.com/shadcn-ui/ui/blob/main/apps/v4/app/globals.css

shadcn.css:5 --background
  oklch(1 0 0)
  unchecked (unreadable)

shadcn.css:6 --foreground
  oklch(0% 0 0)
  unchecked (unreadable)

shadcn.css:8 --card-foreground
  oklch(0% 0 0)
  unchecked (unreadable)

shadcn.css:10 --popover-foreground
  oklch(0% 0 0)
  unchecked (unreadable)

shadcn.css:12 --primary-foreground
  oklch(0.985 0 0)
  unchecked (unreadable)

shadcn.css:14 --secondary-foreground
  oklch(0.205 0 0)
  unchecked (unreadable)

shadcn.css:16 --muted-foreground
  oklch(0.556 0 0)
  unchecked (unreadable)

shadcn.css:18 --accent-foreground
  oklch(0.205 0 0)
  unchecked (unreadable)

shadcn.css:19 --destructive
  oklch(0.577 0.245 27.325)
  unchecked (unreadable)

shadcn.css:20 --destructive-foreground
  oklch(0.97 0.01 17)
  unchecked (unreadable)

0 findings, 10 unchecked
