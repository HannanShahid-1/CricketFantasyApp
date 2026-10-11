import { useEffect, useState } from 'react'
import { loadData } from './engine/data'
import { setData, useApp } from './store'
import { Logo } from './ui/common'
import { DraftRoom } from './ui/DraftRoom'
import { AddModal } from './ui/modals/AddModal'
import { LiveMatch } from './ui/modals/LiveMatch'
import { MatchModal } from './ui/modals/MatchModal'
import { PlayerModal } from './ui/modals/PlayerModal'
import { TradeModal } from './ui/modals/TradeModal'
import { Setup } from './ui/Setup'
import { Shell } from './ui/Shell'

export default function App() {
  const [ready, setReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const league = useApp((s) => s.league)
  const { playerModal, matchModal, liveMatch, tradeWith, addTarget, toast } = useApp()

  useEffect(() => {
    loadData()
      .then((d) => {
        setData(d)
        const l = useApp.getState().league
        if (l && l.dataVersion !== d.version) useApp.getState().reset()
        setReady(true)
      })
      .catch((e) => setError(String(e)))
  }, [])

  if (!ready) {
    return (
      <div className="outfield splash">
        <div className="col" style={{ alignItems: 'center', gap: 16 }}>
          <Logo size={56} spin />
          <div className="up dim">{error ?? 'Rolling the pitch…'}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="outfield">
      {!league ? <Setup /> : league.phase === 'draft' ? <DraftRoom /> : <Shell />}
      {playerModal !== null && <PlayerModal pid={playerModal} />}
      {matchModal !== null && <MatchModal mi={matchModal} />}
      {liveMatch !== null && <LiveMatch mi={liveMatch} />}
      {tradeWith !== null && <TradeModal initial={tradeWith} />}
      {addTarget !== null && <AddModal pid={addTarget} />}
      {toast && <Toast key={toast.id} text={toast.text} tone={toast.tone} />}
    </div>
  )
}

function Toast({ text, tone }: { text: string; tone: 'ok' | 'bad' | 'info' }) {
  const [show, setShow] = useState(true)
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 3200)
    return () => clearTimeout(t)
  }, [])
  if (!show) return null
  return (
    <div className={`toast ${tone}`}>
      <Logo size={18} />
      {text}
    </div>
  )
}
