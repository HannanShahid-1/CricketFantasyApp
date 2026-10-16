import ActivityKit
import ExpoModulesCore

/// Starts, updates and ends the matchup Live Activity (the widget is in targets/matchup-activity). There is no push
/// server, so the activity only changes while Seam is open.
public class SeamLiveActivityModule: Module {
  /// the matchup this run started: if its activity has gone (swiped away), don't bring it back until the matchup changes
  private var startedKey: String?

  public func definition() -> ModuleDefinition {
    Name("SeamLiveActivity")

    Function("isEnabled") { () -> Bool in
      ActivityAuthorizationInfo().areActivitiesEnabled
    }

    /// Shows this matchup: updates its activity, or ends any other one and starts it.
    AsyncFunction("sync") { (attributesJson: String, stateJson: String) async throws in
      let attributes = try Self.decode(MatchupAttributes.self, attributesJson)
      let content = ActivityContent(state: try Self.decode(MatchupAttributes.ContentState.self, stateJson), staleDate: nil)
      var current: Activity<MatchupAttributes>?
      for activity in Activity<MatchupAttributes>.activities {
        let live = activity.activityState == .active || activity.activityState == .stale
        if live && activity.attributes.key == attributes.key && current == nil {
          current = activity
        } else if activity.attributes.key != attributes.key {
          await activity.end(nil, dismissalPolicy: .immediate)
        }
      }
      if let current {
        await current.update(content)
      } else if self.startedKey != attributes.key {
        _ = try Activity.request(attributes: attributes, content: content)
        self.startedKey = attributes.key
      }
    }

    AsyncFunction("end") { () async in
      self.startedKey = nil
      for activity in Activity<MatchupAttributes>.activities {
        await activity.end(nil, dismissalPolicy: .immediate)
      }
    }
  }

  private static func decode<T: Decodable>(_ type: T.Type, _ json: String) throws -> T {
    try JSONDecoder().decode(type, from: Data(json.utf8))
  }
}
