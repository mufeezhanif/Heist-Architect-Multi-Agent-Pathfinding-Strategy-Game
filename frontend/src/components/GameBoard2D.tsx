import { useMemo, useState } from 'react'
import { useGameStore } from '../store/gameStore'
import { sendWS } from '../api/client'

const ROLE_COLORS: Record<string, string> = {
  hacker: '#00ff66',
  thief: '#ff003c',
  muscle: '#f3b700',
}

const CELL_KIND_COLORS: Record<string, string> = {
  wall: '#1f2a44',
  floor: '#0f1a2d',
  corridor: '#13233b',
  door: '#4b2240',
  entry: '#0b3040',
  extraction: '#3d2613',
}

function bayesColor(prob: number): string {
  if (prob <= 0) return 'transparent'
  if (prob < 0.3) {
    const t = Math.round(180 + prob * 160)
    return `rgba(26, ${t}, 255, ${0.16 + prob * 0.35})`
  }
  if (prob < 0.6) {
    return `rgba(255, 188, 60, ${0.2 + prob * 0.3})`
  }
  return `rgba(255, 70, 60, ${0.22 + prob * 0.36})`
}

export default function GameBoard2D() {
  const building = useGameStore((s) => s.building)
  const crew = useGameStore((s) => s.crew)
  const guards = useGameStore((s) => s.guards)
  const waypoints = useGameStore((s) => s.waypoints)
  const selectedAgent = useGameStore((s) => s.selectedAgent)
  const setWaypoint = useGameStore((s) => s.setWaypoint)
  const setPendingMove = useGameStore((s) => s.setPendingMove)
  const moveMode = useGameStore((s) => s.moveMode)
  const planning = useGameStore((s) => s.planning)
  const setPlanning = useGameStore((s) => s.setPlanning)
  const clearCBSEvents = useGameStore((s) => s.clearCBSEvents)
  const clearNarration = useGameStore((s) => s.clearNarration)
  const isTutorial = useGameStore((s) => s.isTutorial)
  const tutorialStep = useGameStore((s) => s.tutorialStep)
  const advanceTutorial = useGameStore((s) => s.advanceTutorial)
  const paths = useGameStore((s) => s.paths)
  const showSecurityLabels = useGameStore((s) => s.showSecurityLabels)
  const showBayesian = useGameStore((s) => s.showBayesian)
  const bayesianHeatmap = useGameStore((s) => s.bayesianHeatmap)
  const objectivesCompleted = useGameStore((s) => s.objectivesCompleted)

  const [hoverCell, setHoverCell] = useState<[number, number] | null>(null)

  if (!building) return null

  const width = building.width
  const height = building.height
  const cellSize = `min(30px, calc((100vh - 250px) / ${height}), calc((100vw - 760px) / ${width}))`

  const crewByPos = useMemo(() => {
    const map = new Map<string, (typeof crew)[number]>()
    for (const agent of crew) {
      if (!agent.alive) continue
      map.set(`${agent.pos[0]},${agent.pos[1]}`, agent)
    }
    return map
  }, [crew])

  const guardByPos = useMemo(() => {
    const map = new Map<string, (typeof guards)[number]>()
    for (const guard of guards) {
      if (guard.knocked_out) continue
      map.set(`${guard.pos[0]},${guard.pos[1]}`, guard)
    }
    return map
  }, [guards])

  const waypointByPos = useMemo(() => {
    const map = new Map<string, string>()
    for (const [agentId, pos] of Object.entries(waypoints)) {
      map.set(`${pos[0]},${pos[1]}`, agentId)
    }
    return map
  }, [waypoints])

  const cameraVisionCells = useMemo(() => {
    const out = new Set<string>()
    for (const camera of building.cameras) {
      if (!camera.active) continue
      for (const [x, y] of camera.vision || []) {
        out.add(`${x},${y}`)
      }
    }
    return out
  }, [building.cameras])

  const guardVisionCells = useMemo(() => {
    const out = new Set<string>()
    for (const guard of guards) {
      for (const [x, y] of guard.vision || []) {
        out.add(`${x},${y}`)
      }
    }
    return out
  }, [guards])

  const objectiveByPos = useMemo(() => {
    const map = new Map<string, { id: string; label: string }>()
    for (const obj of building.objectives) {
      map.set(`${obj.pos[0]},${obj.pos[1]}`, { id: obj.id, label: obj.label })
    }
    return map
  }, [building.objectives])

  const handleCellClick = (x: number, y: number) => {
    if (!selectedAgent || planning) return
    const cell = building.grid[y]?.[x]
    if (!cell || !cell.walkable) return

    if (moveMode === 'quick') {
      setPendingMove(selectedAgent, [x, y])
      setWaypoint(selectedAgent, [x, y])

      const wp = { ...useGameStore.getState().waypoints, [selectedAgent]: [x, y] as [number, number] }
      setPlanning(true)
      clearCBSEvents()
      clearNarration()
      sendWS({ action: 'plan', waypoints: wp })
      useGameStore.setState({ _autoExecuteAfterPlan: true } as Record<string, unknown>)
    } else {
      setWaypoint(selectedAgent, [x, y])
    }

    if (isTutorial && tutorialStep === 3) {
      advanceTutorial()
    }
  }

  const selectedRole = crew.find((c) => c.agent_id === selectedAgent)?.role
  const hoverColor = selectedRole ? (ROLE_COLORS[selectedRole] || '#00d4ff') : '#00d4ff'

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        overflow: 'auto',
        padding: '16px',
        background:
          'radial-gradient(circle at 20% 0%, rgba(0,212,255,0.08), transparent 35%), radial-gradient(circle at 80% 100%, rgba(255,80,40,0.08), transparent 40%), linear-gradient(135deg, #070d18, #0c1220 65%, #101827)',
      }}
    >
      <div
        style={{
          position: 'relative',
          width: `calc(${cellSize} * ${width})`,
          height: `calc(${cellSize} * ${height})`,
          margin: '0 auto',
          border: '1px solid rgba(141, 169, 196, 0.35)',
          borderRadius: 10,
          boxShadow: '0 18px 40px rgba(0,0,0,0.35)',
          overflow: 'hidden',
          background: '#0b1322',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, ${cellSize})`,
            gridTemplateRows: `repeat(${height}, ${cellSize})`,
          }}
        >
          {Array.from({ length: height }).flatMap((_, y) =>
            Array.from({ length: width }).map((__, x) => {
              const key = `${x},${y}`
              const cell = building.grid[y]?.[x]
              const base = CELL_KIND_COLORS[cell?.type || 'floor'] || CELL_KIND_COLORS.floor
              const isWalkable = !!cell?.walkable
              const isHover = hoverCell && hoverCell[0] === x && hoverCell[1] === y
              const guardVision = guardVisionCells.has(key)
              const cameraVision = cameraVisionCells.has(key)
              const bayes = showBayesian ? (bayesianHeatmap[key] || 0) : 0
              const objective = objectiveByPos.get(key)
              const objectiveDone = objective ? objectivesCompleted.includes(objective.id) : false

              return (
                <button
                  key={key}
                  onMouseEnter={() => setHoverCell([x, y])}
                  onMouseLeave={() => setHoverCell(null)}
                  onClick={() => handleCellClick(x, y)}
                  disabled={!selectedAgent || !isWalkable || planning}
                  title={`(${x}, ${y})`}
                  style={{
                    width: '100%',
                    height: '100%',
                    border: '1px solid rgba(255,255,255,0.06)',
                    background: isWalkable ? base : '#202836',
                    padding: 0,
                    position: 'relative',
                    cursor: !selectedAgent || !isWalkable || planning ? 'default' : 'pointer',
                    boxShadow: isHover && selectedAgent ? `inset 0 0 0 2px ${hoverColor}` : 'none',
                  }}
                >
                  {cameraVision && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 1,
                        background: 'rgba(255, 0, 75, 0.12)',
                        border: '1px dashed rgba(255, 0, 75, 0.3)',
                      }}
                    />
                  )}
                  {guardVision && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 2,
                        background: 'rgba(255, 85, 0, 0.12)',
                      }}
                    />
                  )}
                  {bayes > 0 && (
                    <span
                      style={{
                        position: 'absolute',
                        inset: 0,
                        background: bayesColor(bayes),
                      }}
                    />
                  )}
                  {objective && !objectiveDone && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '0.62rem',
                        fontWeight: 700,
                        color: '#8cf9cb',
                        textShadow: '0 1px 2px rgba(0,0,0,0.8)',
                        pointerEvents: 'none',
                      }}
                    >
                      OBJ
                    </span>
                  )}
                  {cell?.sensor && showSecurityLabels && (
                    <span
                      style={{
                        position: 'absolute',
                        right: 1,
                        top: 1,
                        fontSize: '0.48rem',
                        color: '#ffd67f',
                        pointerEvents: 'none',
                      }}
                    >
                      S
                    </span>
                  )}
                </button>
              )
            }),
          )}
        </div>

        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
        >
          {Object.entries(paths).map(([agentId, points]) => {
            if (!points || points.length < 2) return null
            const color = ROLE_COLORS[agentId] || '#ffffff'
            const pathData = points.map(([x, y]) => `${x + 0.5},${y + 0.5}`).join(' ')
            return (
              <polyline
                key={`path-${agentId}`}
                points={pathData}
                fill="none"
                stroke={color}
                strokeWidth={0.14}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.85}
              />
            )
          })}
          {Object.entries(waypoints).map(([agentId, [x, y]]) => {
            const color = ROLE_COLORS[agentId] || '#ffffff'
            return (
              <circle
                key={`wp-${agentId}`}
                cx={x + 0.5}
                cy={y + 0.5}
                r={0.24}
                fill="none"
                stroke={color}
                strokeWidth={0.13}
                opacity={0.95}
              />
            )
          })}
        </svg>

        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'grid',
            gridTemplateColumns: `repeat(${width}, ${cellSize})`,
            gridTemplateRows: `repeat(${height}, ${cellSize})`,
            pointerEvents: 'none',
          }}
        >
          {Array.from({ length: height }).flatMap((_, y) =>
            Array.from({ length: width }).map((__, x) => {
              const key = `${x},${y}`
              const camera = building.cameras.find((cam) => cam.pos[0] === x && cam.pos[1] === y)
              const crewUnit = crewByPos.get(key)
              const guard = guardByPos.get(key)
              const waypointOwner = waypointByPos.get(key)
              const isSelected = crewUnit && selectedAgent === crewUnit.agent_id
              return (
                <div key={`unit-${key}`} style={{ position: 'relative' }}>
                  {camera && (
                    <span
                      title={`Camera ${camera.id}`}
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '0.65rem',
                        color: camera.active ? '#ff6b8d' : '#6c7386',
                        opacity: 0.95,
                      }}
                    >
                      CAM
                    </span>
                  )}
                  {waypointOwner && !crewUnit && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        fontSize: '0.55rem',
                        color: ROLE_COLORS[waypointOwner] || '#fff',
                        opacity: 0.8,
                      }}
                    >
                      WP
                    </span>
                  )}
                  {guard && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '72%',
                        height: '72%',
                        borderRadius: 8,
                        background: guard.knocked_out ? 'rgba(120,120,120,0.5)' : 'rgba(255,40,70,0.9)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        fontSize: '0.5rem',
                        fontWeight: 800,
                        boxShadow: '0 0 10px rgba(255,40,70,0.4)',
                      }}
                    >
                      G
                    </span>
                  )}
                  {crewUnit && (
                    <span
                      style={{
                        position: 'absolute',
                        left: '50%',
                        top: '50%',
                        transform: 'translate(-50%, -50%)',
                        width: '74%',
                        height: '74%',
                        borderRadius: 6,
                        background: ROLE_COLORS[crewUnit.role] || '#ffffff',
                        border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.55)',
                        color: '#041224',
                        fontSize: '0.52rem',
                        fontWeight: 900,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        boxShadow: isSelected ? `0 0 14px ${ROLE_COLORS[crewUnit.role] || '#fff'}` : 'none',
                      }}
                    >
                      {crewUnit.role.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                </div>
              )
            }),
          )}
        </div>
      </div>
    </div>
  )
}