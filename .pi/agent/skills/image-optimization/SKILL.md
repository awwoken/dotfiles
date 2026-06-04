---
name: image-optimization
description: Use when optimizing local raster image assets for web/app delivery while preserving layout, aspect ratio, and visual quality. Covers choosing target dimensions, WebP compression tradeoffs, and verifying byte size, dimensions, and references.
---

# Image Optimization

## Core Rules

- Use `sharp` for crop, resize, format conversion, and batch processing.
- Prefer WebP for photos.
- Optimize from the best available source, not an already-compressed derivative.
- Preserve layout and aspect ratio unless the task explicitly asks to crop.

## Workflow

1. Inspect how the image renders in code: source path, CSS size, `width`/`height`, `sizes`, object-fit, and crop.
2. Choose target dimensions:
   - use rendered size x2 for normal UI images
   - use x2.5-x3 only for visually critical hero/product images
   - do not upscale small originals
3. Crop only when needed to match an existing UI frame or when the user explicitly asks.
4. Encode the optimized output.
5. Verify format, dimensions, and byte size before updating references.
6. Tell the user the before/after file info.

## WebP Pattern

Use this for normal static UI photos:

```sh
node -e 'const sharp=require("sharp"); sharp("input.jpg").resize({width: TARGET_WIDTH}).webp({quality:84,effort:6}).toFile("output.webp")'
```

For exact UI crops, crop first, then resize, then encode. Keep WebP quality in these ranges:

- normal photos: `quality: 82-86`
- important hero/product images: `quality: 88-92`
- prefer smaller files unless visual artifacts are noticeable.

## Verification

Check format, dimensions, and byte size:

```sh
file output.webp
sips -g pixelWidth -g pixelHeight output.webp
stat -f "%z %N" output.webp
```

Report the before/after file info to the user: source and output paths, format, dimensions, and byte size.

Update references only after verifying output files. Remove old assets only after confirming no references remain.
