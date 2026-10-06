# Windows application icon

`office-md.ico` is the multi-resolution Windows icon generated from `../public/favicon.svg`.

To regenerate it from the repository root with ImageMagick installed:

```sh
magick -background none -density 768 public/favicon.svg -define icon:auto-resize=256,128,64,48,32,16 build/office-md.ico
```
