export type CloudEntry = { name: string; count: number; kind: 'word' | 'emoji' }
export type CloudWord = CloudEntry & { x: number; y: number; width: number; height: number; image: HTMLCanvasElement }
const CELL = 2
const palette = ['#62c7f5', '#99e6d9', '#6dd1ed', '#abece3', '#7bc6ef']

function sprite(entry: CloudEntry, size: number, color: string) {
  const image = document.createElement('canvas')
  const context = image.getContext('2d', { willReadFrequently: true })!
  const font = `800 ${size}px "Inter Variable", sans-serif`
  context.font = font
  const metrics = context.measureText(entry.name)
  const left = Math.ceil(Math.max(0, metrics.actualBoundingBoxLeft))
  const ascent = Math.ceil(metrics.actualBoundingBoxAscent)
  const width = Math.ceil((left + metrics.actualBoundingBoxRight + 2) / CELL) * CELL
  const height = Math.ceil((ascent + metrics.actualBoundingBoxDescent + 2) / CELL) * CELL
  // Render at double resolution; collision masks use the actual painted glyphs.
  image.width = width * 2; image.height = height * 2
  context.scale(2, 2); context.font = font; context.fillStyle = color
  context.fillText(entry.name, left + 1, ascent + 1)
  const pixels = context.getImageData(0, 0, image.width, image.height).data
  const columns = width / CELL, rows = height / CELL
  const ink = new Uint8Array(columns * rows)
  for (let y = 0; y < image.height; y++) for (let x = 0; x < image.width; x++) {
    if (pixels[(y * image.width + x) * 4 + 3] > 32) ink[Math.floor(y / 4) * columns + Math.floor(x / 4)] = 1
  }
  // One cell of breathing room prevents adjacent letters from touching.
  const points: [number, number][] = []
  for (let y = 0; y < rows; y++) for (let x = 0; x < columns; x++) {
    let painted = false
    for (let dy = -1; dy <= 1 && !painted; dy++) for (let dx = -1; dx <= 1; dx++) {
      if (x + dx >= 0 && x + dx < columns && y + dy >= 0 && y + dy < rows && ink[(y + dy) * columns + x + dx]) { painted = true; break }
    }
    if (painted) points.push([x, y])
  }
  return { image, width, height, columns, rows, points }
}

/** Deterministic glyph packing with a small work budget between animation frames. */
export async function layoutCloud(entries: CloudEntry[], width: number, height: number, cancelled: () => boolean): Promise<CloudWord[]> {
  const columns = Math.floor(width / CELL), rows = Math.floor(height / CELL)
  const context = document.createElement('canvas').getContext('2d')!
  const sizes = entries.map((entry) => 15 + Math.min(100, width * .14) * Math.pow(entry.count / entries[0].count, .65))
  let area = 0, scale = 1
  entries.forEach((entry, index) => {
    context.font = `800 ${sizes[index]}px "Inter Variable", sans-serif`
    const textWidth = context.measureText(entry.name).width
    area += textWidth * sizes[index]
    scale = Math.min(scale, (width - 12) / Math.max(textWidth, 1))
  })
  scale = Math.min(scale, Math.sqrt(width * height * .95 / Math.max(area, 1)))
  let best: CloudWord[] = []
  let sliceStarted = performance.now()
  for (let attempt = 0; attempt < 4; attempt++) {
    const occupied = new Uint8Array(columns * rows)
    const result: CloudWord[] = []
    for (let index = 0; index < entries.length; index++) {
      // Several small words can fit in one slice; avoid waiting a frame per word.
      if (performance.now() - sliceStarted >= 6) {
        await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()))
        sliceStarted = performance.now()
      }
      if (cancelled()) return []
      const entry = entries[index]
      const glyph = sprite(entry, sizes[index] * scale, palette[index % palette.length])
      for (let step = 0; step < 7500; step++) {
        const angle = step * .13, radius = step * .055
        const x = Math.round(columns / 2 + Math.cos(angle) * radius * columns / rows - glyph.columns / 2)
        const y = Math.round(rows / 2 + Math.sin(angle) * radius - glyph.rows / 2)
        if (x < 1 || y < 1 || x + glyph.columns >= columns || y + glyph.rows >= rows) continue
        if (glyph.points.some(([dx, dy]) => occupied[(y + dy) * columns + x + dx])) continue
        for (const [dx, dy] of glyph.points) occupied[(y + dy) * columns + x + dx] = 1
        result.push({ ...entry, x: x * CELL, y: y * CELL, width: glyph.width, height: glyph.height, image: glyph.image })
        break
      }
    }
    if (result.length > best.length) best = result
    if (result.length === entries.length) break
    scale *= .88
  }
  return best
}
