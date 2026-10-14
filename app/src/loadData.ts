import { buildData, type Data, type PlayerBio, type PlayerMedia } from './engine/data'
import type { RawData } from './engine/types'

/** Web: fetch the data files from public/data. Photos and bios are optional so a failed request can't block loading. */
export async function loadData(): Promise<Data> {
  const url = (f: string) => `${import.meta.env.BASE_URL}data/${f}`
  const [raw, media, bios] = await Promise.all([
    fetch(url('ipl.json')).then((r) => {
      if (!r.ok) throw new Error(`Couldn't load data/ipl.json (${r.status})`)
      return r.json() as Promise<RawData>
    }),
    fetch(url('player-media.json'))
      .then((r): Promise<PlayerMedia> => (r.ok ? r.json() : Promise.resolve({ players: {}, teams: {} })))
      .catch((): PlayerMedia => ({ players: {}, teams: {} })),
    fetch(url('player-bios.json'))
      .then((r): Promise<Record<string, PlayerBio>> => (r.ok ? r.json() : Promise.resolve({})))
      .catch(() => ({}) as Record<string, PlayerBio>),
  ])
  return buildData(raw, media, bios)
}
