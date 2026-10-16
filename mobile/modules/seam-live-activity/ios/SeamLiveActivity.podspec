Pod::Spec.new do |s|
  s.name           = 'SeamLiveActivity'
  s.version        = '1.0.0'
  s.summary        = 'Starts and updates the Seam matchup Live Activity'
  s.author         = 'Seam'
  s.homepage       = 'https://github.com/'
  s.license        = 'MIT'
  s.platforms      = { :ios => '16.4' }
  s.swift_version  = '5.9'
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.source_files = '**/*.swift'
  s.pod_target_xcconfig = { 'DEFINES_MODULE' => 'YES' }
end
