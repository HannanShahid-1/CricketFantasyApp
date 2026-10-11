import { DraftBoard } from '../DraftRoom'

export function DraftRecapView() {
  return (
    <>
      <div className="page-title">
        <h1>Draft Board</h1>
        <div className="sub">Snake draft results · your picks are outlined</div>
      </div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <DraftBoard />
      </div>
    </>
  )
}
