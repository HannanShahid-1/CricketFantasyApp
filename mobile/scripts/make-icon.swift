// Draws the app icon: a white cricket ball with a stitched seam on the Dusk theme's coral, plus the dark and tinted
// variants iOS uses for its dark and tinted home screens. Drawn from scratch: Apple's licence doesn't allow SF Symbols
// in app icons. Also draws the launch screen's ball (the light icon's ball alone, on a transparent background, at 2x
// so it stays sharp as the intro zooms it). Run from mobile/: `swift scripts/make-icon.swift` (writes assets/icon*.png
// and assets/splash-ball.png).
import AppKit

let S: CGFloat = 1024
let coral = CGColor(srgbRed: 0xdc / 255, green: 0x5f / 255, blue: 0x57 / 255, alpha: 1)
let coralTop = CGColor(srgbRed: 0xe8 / 255, green: 0x6d / 255, blue: 0x64 / 255, alpha: 1)
let coralBottom = CGColor(srgbRed: 0xcc / 255, green: 0x50 / 255, blue: 0x49 / 255, alpha: 1)
let white = CGColor(srgbRed: 1, green: 1, blue: 1, alpha: 1)
let paper = CGColor(srgbRed: 0xf8 / 255, green: 0xf4 / 255, blue: 0xee / 255, alpha: 1)
let paperShade = CGColor(srgbRed: 0xe6 / 255, green: 0xdc / 255, blue: 0xd1 / 255, alpha: 1)

enum Style { case light, dark, tinted, ball }

func render(_ style: Style, to path: String) {
  // light and tinted are opaque (tinted is grayscale on black: iOS tints it by brightness); dark keeps a transparent
  // background so iOS can put its own dark backdrop behind it
  let opaque = style == .light || style == .tinted
  let k: CGFloat = style == .ball ? 2 : 1
  let ctx = CGContext(
    data: nil, width: Int(S * k), height: Int(S * k), bitsPerComponent: 8, bytesPerRow: 0,
    space: CGColorSpace(name: CGColorSpace.sRGB)!,
    bitmapInfo: opaque ? CGImageAlphaInfo.noneSkipLast.rawValue : CGImageAlphaInfo.premultipliedLast.rawValue
  )!
  ctx.scaleBy(x: k, y: k)

  // background: a soft top-to-bottom coral gradient (light), black (tinted), transparent (dark)
  if style == .light {
    let g = CGGradient(colorsSpace: nil, colors: [coralTop, coralBottom] as CFArray, locations: [0, 1])!
    ctx.drawLinearGradient(g, start: CGPoint(x: 0, y: S), end: CGPoint(x: 0, y: 0), options: [])
  } else if style == .tinted {
    ctx.setFillColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1))
    ctx.fill(CGRect(x: 0, y: 0, width: S, height: S))
  }

  // the ball
  let c = CGPoint(x: S / 2, y: S / 2)
  let R: CGFloat = 318
  let ball = CGRect(x: c.x - R, y: c.y - R, width: 2 * R, height: 2 * R)
  ctx.setFillColor(style == .dark ? coral : style == .tinted ? white : paper)
  ctx.fillEllipse(in: ball)
  if style == .light || style == .ball {
    // a soft shade towards the lower right so the ball reads as round
    ctx.saveGState()
    ctx.addEllipse(in: ball)
    ctx.clip()
    let shade = CGGradient(colorsSpace: nil, colors: [paper, paperShade] as CFArray, locations: [0.55, 1])!
    ctx.drawRadialGradient(shade, startCenter: CGPoint(x: c.x - R * 0.35, y: c.y + R * 0.35), startRadius: 0,
                           endCenter: CGPoint(x: c.x - R * 0.35, y: c.y + R * 0.35), endRadius: R * 1.65, options: [])
    ctx.restoreGState()
  }

  // the seam, cut into the ball: two gently curved lines with stitches across them, running corner to corner
  ctx.saveGState()
  ctx.addEllipse(in: ball)
  ctx.clip()
  ctx.translateBy(x: c.x, y: c.y)
  ctx.rotate(by: -.pi / 4)
  // the seam: coral on the light icon, black on tinted, cut out (transparent) on dark
  if style == .light || style == .ball { ctx.setStrokeColor(coral) } else if style == .tinted { ctx.setStrokeColor(CGColor(srgbRed: 0, green: 0, blue: 0, alpha: 1)) } else { ctx.setBlendMode(.clear) }
  ctx.setLineCap(.round)

  // in the rotated frame the seam is vertical; each line is an arc of a big circle centred off to the right
  let big: CGFloat = 1250
  let gap: CGFloat = 44
  // the seam passes through the middle of the ball and curves gently away at either end
  let centre = CGPoint(x: big + 8, y: 0)
  let sweep: CGFloat = 0.3 // radians either side of the horizontal: enough to cross the whole ball
  for r in [big - gap, big + gap] {
    ctx.setLineWidth(20)
    ctx.addArc(center: centre, radius: r, startAngle: .pi - sweep, endAngle: .pi + sweep, clockwise: false)
    ctx.strokePath()
  }
  // stitches: short ticks across each line, evenly spaced along the seam
  ctx.setLineWidth(15)
  let tick: CGFloat = 26
  var a = CGFloat.pi - sweep
  while a <= CGFloat.pi + sweep {
    for r in [big - gap, big + gap] {
      let p0 = CGPoint(x: centre.x + (r - tick) * cos(a), y: centre.y + (r - tick) * sin(a))
      let p1 = CGPoint(x: centre.x + (r + tick) * cos(a), y: centre.y + (r + tick) * sin(a))
      ctx.move(to: p0)
      ctx.addLine(to: p1)
    }
    a += 0.042
  }
  ctx.strokePath()
  ctx.restoreGState()

  var image = ctx.makeImage()!
  if style == .ball { image = image.cropping(to: CGRect(x: ball.minX * k, y: ball.minY * k, width: ball.width * k, height: ball.height * k))! }
  let rep = NSBitmapImageRep(cgImage: image)
  try! rep.representation(using: .png, properties: [:])!.write(to: URL(fileURLWithPath: path))
}

render(.light, to: "assets/icon.png")
render(.dark, to: "assets/icon-dark.png")
render(.tinted, to: "assets/icon-tinted.png")
render(.ball, to: "assets/splash-ball.png")
print("wrote assets/icon.png, icon-dark.png, icon-tinted.png, splash-ball.png")
