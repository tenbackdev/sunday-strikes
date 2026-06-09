import { EditableFrameGrid } from './Scorecard'
import { computeScores } from '../lib/parseGame'

const RAW_FRAMES = [
  { frame: 1,  balls: ['X', null, null],  split: false, splitPickedUp: false },
  { frame: 2,  balls: ['7', '/', null],   split: false, splitPickedUp: false },
  { frame: 3,  balls: ['9', '-', null],   split: false, splitPickedUp: false },
  { frame: 4,  balls: ['X', null, null],  split: false, splitPickedUp: false },
  { frame: 5,  balls: ['X', null, null],  split: false, splitPickedUp: false },
  { frame: 6,  balls: ['6', '3', null],   split: true,  splitPickedUp: false },
  { frame: 7,  balls: ['7', '/', null],   split: false, splitPickedUp: false },
  { frame: 8,  balls: ['X', null, null],  split: false, splitPickedUp: false },
  { frame: 9,  balls: ['8', '1', null],   split: false, splitPickedUp: false },
  { frame: 10, balls: ['X', 'X', '9'],    split: false, splitPickedUp: false },
]

const MOCK_FRAMES = computeScores(RAW_FRAMES)

export default function ScorecardTestFixture() {
  return (
    <div
      data-testid="test-fixture"
      style={{ background: 'var(--bg, #fff)', minHeight: '100dvh', display: 'flex', alignItems: 'flex-end', justifyContent: 'center' }}
    >
      {/* Simulates the modal's scrollable container */}
      <div
        data-testid="modal-scroll"
        style={{
          width: '100%',
          maxWidth: 448,
          maxHeight: '92vh',
          overflowY: 'auto',
          background: 'var(--card, #fff)',
          borderRadius: '16px 16px 0 0',
          padding: 20,
        }}
      >
        <p style={{ marginBottom: 12, fontSize: 14, fontWeight: 600 }}>Scorecard Edit Test</p>
        <EditableFrameGrid
          frames={MOCK_FRAMES}
          onChange={() => {}}
        />
        {/* Extra content so the container is actually scrollable */}
        <div style={{ height: 300 }} />
      </div>
    </div>
  )
}
