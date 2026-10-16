import ActivityKit

/// Your matchup on the Lock Screen and in the Dynamic Island. ActivityKit pairs the app with the widget by this type's
/// name, so keep it identical to targets/matchup-activity/MatchupAttributes.swift. Both sides decode the JSON that
/// src/data/liveActivity.ts sends.
struct MatchupAttributes: ActivityAttributes {
  struct Side: Codable, Hashable {
    var name: String
    var avatar: String
  }

  struct ContentState: Codable, Hashable {
    /// formatted scores and projections
    var my: String
    var opp: String
    var myProj: String
    var oppProj: String
    /// 1 you lead, 0 level, -1 behind
    var lead: Int
    /// your chance to win, 0–100
    var win: Int
    /// "live", "upcoming" or "final"
    var status: String
    /// one quiet line, e.g. "MI v CSK · 14.3 ov"
    var detail: String
    /// theme colours as #rrggbb (here, not in the attributes, so a theme change reaches a running activity)
    var myColor: String
    var oppColor: String
    var accent: String
  }

  /// the league, week and teams: a new key ends the old activity and starts a new one
  var key: String
  var week: String
  var me: Side
  var opp: Side
}
