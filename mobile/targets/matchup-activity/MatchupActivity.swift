import ActivityKit
import SwiftUI
import WidgetKit

// Your matchup outside the app.
// Compact: both scores, the leader bright. Minimal (beside another app's activity): your win chance as a ring.
// Expanded: each badge and score beside the camera, like a scoreboard; the full width below it holds the team names,
// the win-chance bar and one status line. The centre region (which iOS puts below the camera, out of line with the
// sides) stays empty so everything lines up on the same left and right edges.

/// one horizontal inset for every expanded region, so the badges, names and bar share the same edges
private let inset: CGFloat = 6

@main
struct SeamWidgets: WidgetBundle {
  var body: some Widget {
    MatchupActivity()
  }
}

struct MatchupActivity: Widget {
  var body: some WidgetConfiguration {
    ActivityConfiguration(for: MatchupAttributes.self) { context in
      LockScreen(a: context.attributes, s: context.state)
    } dynamicIsland: { context in
      let a = context.attributes
      let s = context.state
      return DynamicIsland {
        DynamicIslandExpandedRegion(.leading) {
          BadgeScore(side: a.me, score: s.my, color: Color(hex: s.myColor), dim: s.lead < 0, trailing: false)
            .padding(.leading, inset)
        }
        DynamicIslandExpandedRegion(.trailing) {
          BadgeScore(side: a.opp, score: s.opp, color: Color(hex: s.oppColor), dim: s.lead > 0, trailing: true)
            .padding(.trailing, inset)
        }
        DynamicIslandExpandedRegion(.bottom) {
          VStack(spacing: 10) {
            HStack {
              TeamName(name: a.me.name)
              Spacer(minLength: 12)
              TeamName(name: a.opp.name)
            }
            WinChance(s: s)
          }
          .padding(.horizontal, inset)
          .padding(.top, 2)
        }
      } compactLeading: {
        CompactScore(avatar: a.me.avatar, score: s.my, dim: s.lead < 0, trailing: false)
      } compactTrailing: {
        CompactScore(avatar: a.opp.avatar, score: s.opp, dim: s.lead > 0, trailing: true)
      } minimal: {
        WinRing(win: s.win, color: Color(hex: s.myColor))
      }
      .keylineTint(Color(hex: s.accent))
    }
  }
}

// MARK: - Lock Screen

struct LockScreen: View {
  let a: MatchupAttributes
  let s: MatchupAttributes.ContentState

  var body: some View {
    VStack(spacing: 12) {
      HStack(alignment: .top) {
        Side(side: a.me, score: s.my, proj: s.myProj, color: Color(hex: s.myColor), dim: s.lead < 0, trailing: false)
        Spacer(minLength: 16)
        Side(side: a.opp, score: s.opp, proj: s.oppProj, color: Color(hex: s.oppColor), dim: s.lead > 0, trailing: true)
      }
      WinChance(s: s)
    }
    .padding(.horizontal, 18)
    .padding(.vertical, 16)
  }

  /// badge and name, then the score and projection, all on one edge
  struct Side: View {
    let side: MatchupAttributes.Side
    let score: String
    let proj: String
    let color: Color
    let dim: Bool
    let trailing: Bool

    var body: some View {
      VStack(alignment: trailing ? .trailing : .leading, spacing: 6) {
        HStack(spacing: 7) {
          if !trailing { Badge(avatar: side.avatar, color: color, size: 22) }
          TeamName(name: side.name)
          if trailing { Badge(avatar: side.avatar, color: color, size: 22) }
        }
        Score(text: score, size: 32, dim: dim)
        Text("Proj \(proj)")
          .font(.system(size: 11, weight: .medium).monospacedDigit())
          .foregroundStyle(.secondary)
      }
    }
  }
}

// MARK: - Pieces

/// A team's emoji on its colour, like the app's TeamBadge
struct Badge: View {
  let avatar: String
  let color: Color
  var size: CGFloat = 28

  var body: some View {
    Text(avatar)
      .font(.system(size: size * 0.56))
      .frame(width: size, height: size)
      .background(color, in: RoundedRectangle(cornerRadius: size * 0.3, style: .continuous))
  }
}

struct Score: View {
  let text: String
  let size: CGFloat
  /// behind: the score steps back
  let dim: Bool

  var body: some View {
    Text(text)
      .font(.system(size: size, weight: .bold, design: .rounded).monospacedDigit())
      .foregroundStyle(dim ? .secondary : .primary)
      .contentTransition(.numericText())
      .lineLimit(1)
      .minimumScaleFactor(0.7)
  }
}

struct TeamName: View {
  let name: String

  var body: some View {
    Text(name)
      .font(.system(size: 13, weight: .semibold))
      .foregroundStyle(.secondary)
      .lineLimit(1)
  }
}

/// the expanded island's sides: badge and score beside the camera, the score on the outside edge's far side
struct BadgeScore: View {
  let side: MatchupAttributes.Side
  let score: String
  let color: Color
  let dim: Bool
  let trailing: Bool

  var body: some View {
    HStack(spacing: 10) {
      if !trailing { Badge(avatar: side.avatar, color: color) }
      Score(text: score, size: 28, dim: dim)
      if trailing { Badge(avatar: side.avatar, color: color) }
    }
    .frame(maxHeight: .infinity)
  }
}

/// Your share of the bar in your colour on a quiet track, your chance and theirs at the ends, the status between
struct WinChance: View {
  let s: MatchupAttributes.ContentState

  var body: some View {
    VStack(spacing: 7) {
      GeometryReader { g in
        ZStack(alignment: .leading) {
          Capsule().fill(Color.primary.opacity(0.16))
          Capsule().fill(Color(hex: s.myColor))
            .frame(width: max(5, g.size.width * CGFloat(s.win) / 100))
        }
      }
      .frame(height: 5)
      HStack(spacing: 8) {
        Text("\(s.win)%")
          .foregroundStyle(.primary)
          .contentTransition(.numericText())
        Spacer(minLength: 0)
        HStack(spacing: 5) {
          if s.status == "live" {
            Circle().fill(Color(hex: s.accent)).frame(width: 6, height: 6)
          }
          Text(s.detail)
            .lineLimit(1)
        }
        .foregroundStyle(.secondary)
        Spacer(minLength: 0)
        Text("\(100 - s.win)%")
          .foregroundStyle(.secondary)
          .contentTransition(.numericText())
      }
      .font(.system(size: 12, weight: .semibold).monospacedDigit())
    }
  }
}

struct CompactScore: View {
  let avatar: String
  let score: String
  let dim: Bool
  let trailing: Bool

  var body: some View {
    HStack(spacing: 4) {
      if !trailing { Text(avatar).font(.system(size: 13)) }
      Text(score)
        .font(.system(size: 14, weight: .bold, design: .rounded).monospacedDigit())
        .foregroundStyle(dim ? .secondary : .primary)
        .contentTransition(.numericText())
      if trailing { Text(avatar).font(.system(size: 13)) }
    }
  }
}

/// your win chance as a ring in your colour on a quiet track
struct WinRing: View {
  let win: Int
  let color: Color

  var body: some View {
    ZStack {
      Circle().stroke(Color.primary.opacity(0.16), lineWidth: 2.5)
      Circle()
        .trim(from: 0, to: CGFloat(win) / 100)
        .stroke(color, style: StrokeStyle(lineWidth: 2.5, lineCap: .round))
        .rotationEffect(.degrees(-90))
      Text("\(win)")
        .font(.system(size: 9, weight: .bold, design: .rounded).monospacedDigit())
    }
    .padding(2)
  }
}

extension Color {
  /// #rrggbb from the app's theme
  init(hex: String) {
    let v = UInt64(hex.trimmingCharacters(in: CharacterSet(charactersIn: "#")), radix: 16) ?? 0x888888
    self.init(red: Double((v >> 16) & 0xff) / 255, green: Double((v >> 8) & 0xff) / 255, blue: Double(v & 0xff) / 255)
  }
}
