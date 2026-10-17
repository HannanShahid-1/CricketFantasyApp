// Tournament choices are separate from a fantasy league's name and format.
// IPL is the only data/rules adapter available today; future choices never create an IPL league by accident.
export const COMPETITIONS = [
  { id: 'ipl', name: 'Indian Premier League', short: 'IPL', format: 'T20', region: 'India', available: true, logo: require('../../assets/competitions/ipl.png') },
  { id: 'bbl', name: 'Big Bash League', short: 'BBL', format: 'T20', region: 'Australia', available: false, logo: require('../../assets/competitions/bbl.png') },
  { id: 'hundred', name: 'The Hundred', short: 'The Hundred', format: '100-ball', region: 'England', available: false, logo: require('../../assets/competitions/hundred.svg') },
  { id: 't20wc', name: 'T20 World Cup', short: 'T20 World Cup', format: 'T20', region: 'International', available: false, logo: require('../../assets/competitions/t20-world-cup.svg') },
  { id: 'odiwc', name: 'ODI World Cup', short: 'ODI World Cup', format: 'ODI', region: 'International', available: false, logo: require('../../assets/competitions/odi-world-cup.png') },
] as const
export type Competition = typeof COMPETITIONS[number]
export const IPL = COMPETITIONS[0]
