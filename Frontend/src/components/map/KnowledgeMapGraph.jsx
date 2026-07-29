import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  forceCenter,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
} from 'd3-force'

const REAL_COLOR = 'rgba(13, 115, 119, 0.55)'
const REAL_FOCUS_COLOR = 'rgba(13, 115, 119, 0.9)'
const AFFINITY_COLOR = 'rgba(148, 163, 184, 0.4)'
const BG_TOP = '#e7f7f5'
const BG_MID = '#F4FAF9'
const BG_BOT = '#eef3f5'

function communityAnchors(communities, radius = 240) {
  const anchors = {}
  const list = [...communities].sort()
  const n = Math.max(list.length, 1)
  list.forEach((c, i) => {
    const angle = (2 * Math.PI * i) / n - Math.PI / 2
    anchors[c] = { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }
  })
  return anchors
}

function withAlpha(hex, alphaHex) {
  if (!hex || typeof hex !== 'string') return `#14919B${alphaHex}`
  if (hex.startsWith('#') && hex.length === 7) return `${hex}${alphaHex}`
  return hex
}

function seedPosition(node, anchors, index, total) {
  const anchor = anchors[node.community]
  if (anchor) {
    const jitter = ((index % 7) - 3) * 18
    return { x: anchor.x + jitter, y: anchor.y + ((index % 5) - 2) * 16 }
  }
  const angle = (2 * Math.PI * index) / Math.max(total, 1)
  return { x: Math.cos(angle) * 160, y: Math.sin(angle) * 160 }
}

export default function KnowledgeMapGraph({
  nodes = [],
  edges = [],
  focusId = null,
  communityName = null,
  pathNodeIds = null,
  pathEdgeIds = null,
  bridgePickMode = false,
  onNodeClick,
  onCommunityClick,
  showAffinity = false,
  communities = [],
}) {
  const wrapRef = useRef(null)
  const canvasRef = useRef(null)
  const simRef = useRef(null)
  const nodesRef = useRef([])
  const linksRef = useRef([])
  const transformRef = useRef({ k: 1, x: 0, y: 0 })
  const hoverRef = useRef(null)
  const dragRef = useRef(null)
  const panRef = useRef(null)
  const moved = useRef(false)
  const focusRef = useRef(focusId)
  const communityRef = useRef(communityName)
  const pathNodesRef = useRef(pathNodeIds)
  const pathEdgesRef = useRef(pathEdgeIds)
  const rafRef = useRef(0)
  const [hoverName, setHoverName] = useState(null)
  const [size, setSize] = useState({ w: 800, h: 520 })

  focusRef.current = focusId
  communityRef.current = communityName
  pathNodesRef.current = pathNodeIds
  pathEdgesRef.current = pathEdgeIds

  const communityList = useMemo(
    () =>
      communities.length
        ? communities
        : [...new Set(nodes.map((n) => n.community).filter(Boolean))],
    [communities, nodes]
  )
  const anchors = useMemo(() => communityAnchors(communityList), [communityList])

  const visibleEdges = useMemo(() => {
    const real = edges.filter((e) => e.type === 'real')
    const pathIdSet = pathEdgeIds?.length ? new Set(pathEdgeIds) : null

    // Bridge mode: always include every path edge (solid or dashed), bypass weight caps
    if (pathIdSet) {
      const byId = new Map()
      for (const e of real) byId.set(e.id, e)
      for (const e of edges) {
        if (pathIdSet.has(e.id)) byId.set(e.id, e)
      }
      return [...byId.values()]
    }

    if (!showAffinity) return real
    const affinity = edges
      .filter((e) => e.type === 'affinity')
      .sort((a, b) => (b.weight || 0) - (a.weight || 0))
    const limit = focusId ? 40 : 28
    const minW = focusId ? 0.28 : 0.36
    return [...real, ...affinity.filter((e) => (e.weight || 0) >= minW).slice(0, limit)]
  }, [edges, showAffinity, focusId, pathEdgeIds])

  // Measure container
  useEffect(() => {
    const el = wrapRef.current
    if (!el) return undefined
    const measure = () => {
      const rect = el.getBoundingClientRect()
      setSize({
        w: Math.max(320, Math.floor(rect.width)),
        h: Math.max(420, Math.floor(rect.height || 520)),
      })
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  // Build / rebuild simulation when graph topology changes
  useEffect(() => {
    if (!nodes.length) {
      nodesRef.current = []
      linksRef.current = []
      return undefined
    }

    const prevById = new Map(nodesRef.current.map((n) => [n.id, n]))
    const simNodes = nodes.map((n, index) => {
      const prev = prevById.get(n.id)
      const seeded = seedPosition(n, anchors, index, nodes.length)
      return {
        id: n.id,
        name: n.name,
        label: n.label,
        role: n.role,
        color: n.color || '#14919B',
        community: n.community,
        dimmed: Boolean(n.dimmed),
        highlighted: Boolean(n.highlighted),
        on_path: Boolean(n.on_path),
        x: prev?.x ?? seeded.x,
        y: prev?.y ?? seeded.y,
        vx: prev?.vx ?? 0,
        vy: prev?.vy ?? 0,
      }
    })

    const idSet = new Set(simNodes.map((n) => n.id))
    const simLinks = visibleEdges
      .filter((e) => idSet.has(e.source) && idSet.has(e.target))
      .map((e) => ({
        id: e.id,
        source: e.source,
        target: e.target,
        type: e.type,
        weight: e.weight || 0.5,
      }))

    nodesRef.current = simNodes
    linksRef.current = simLinks

    if (simRef.current) simRef.current.stop()

    const sim = forceSimulation(simNodes)
      .force(
        'link',
        forceLink(simLinks)
          .id((d) => d.id)
          .distance((l) => (l.type === 'real' ? 52 : 100))
          .strength((l) => (l.type === 'real' ? 0.55 : 0.08 + (l.weight || 0.3) * 0.1))
      )
      .force('charge', forceManyBody().strength(-210).distanceMax(480))
      .force('center', forceCenter(0, 0).strength(0.03))
      .force(
        'communityX',
        forceX((d) => anchors[d.community]?.x ?? 0).strength(0.07)
      )
      .force(
        'communityY',
        forceY((d) => anchors[d.community]?.y ?? 0).strength(0.07)
      )
      .velocityDecay(0.4)
      .alphaDecay(0.01)
      .alphaTarget(0.05)
      .alpha(0.6)

    simRef.current = sim

    return () => {
      sim.stop()
      if (simRef.current === sim) simRef.current = null
    }
  }, [nodes, visibleEdges, anchors])

  // Camera: focus / path / community / landscape
  useEffect(() => {
    const { w, h } = size
    if (!w || !h) return

    if (focusId) {
      const node = nodesRef.current.find((n) => n.id === focusId)
      if (!node || !Number.isFinite(node.x)) return
      const k = 2.1
      transformRef.current = {
        k,
        x: w / 2 - node.x * k,
        y: h / 2 - node.y * k,
      }
      simRef.current?.alphaTarget(0.08).restart()
      return
    }

    if (pathNodeIds?.length) {
      const pathSet = new Set(pathNodeIds)
      const members = nodesRef.current.filter((n) => pathSet.has(n.id))
      if (members.length) {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        members.forEach((n) => {
          if (!Number.isFinite(n.x)) return
          minX = Math.min(minX, n.x)
          maxX = Math.max(maxX, n.x)
          minY = Math.min(minY, n.y)
          maxY = Math.max(maxY, n.y)
        })
        if (Number.isFinite(minX)) {
          const bw = Math.max(maxX - minX, 80)
          const bh = Math.max(maxY - minY, 80)
          const k = Math.min(2.2, 0.85 * Math.min(w / bw, h / bh))
          const cx = (minX + maxX) / 2
          const cy = (minY + maxY) / 2
          transformRef.current = {
            k,
            x: w / 2 - cx * k,
            y: h / 2 - cy * k,
          }
          simRef.current?.alphaTarget(0.08).restart()
          return
        }
      }
    }

    if (communityName) {
      const members = nodesRef.current.filter((n) => n.community === communityName)
      if (members.length) {
        let minX = Infinity
        let maxX = -Infinity
        let minY = Infinity
        let maxY = -Infinity
        members.forEach((n) => {
          if (!Number.isFinite(n.x)) return
          minX = Math.min(minX, n.x)
          maxX = Math.max(maxX, n.x)
          minY = Math.min(minY, n.y)
          maxY = Math.max(maxY, n.y)
        })
        if (Number.isFinite(minX)) {
          const bw = Math.max(maxX - minX, 60)
          const bh = Math.max(maxY - minY, 60)
          const k = Math.min(2.0, 0.9 * Math.min(w / bw, h / bh))
          const cx = (minX + maxX) / 2
          const cy = (minY + maxY) / 2
          transformRef.current = {
            k,
            x: w / 2 - cx * k,
            y: h / 2 - cy * k,
          }
          simRef.current?.alphaTarget(0.08).restart()
          return
        }
      }
      const anchor = anchors[communityName]
      if (anchor) {
        const k = 1.6
        transformRef.current = {
          k,
          x: w / 2 - anchor.x * k,
          y: h / 2 - anchor.y * k,
        }
      }
      return
    }

    // Fit landscape loosely
    const ns = nodesRef.current
    if (!ns.length) return
    let minX = Infinity
    let maxX = -Infinity
    let minY = Infinity
    let maxY = -Infinity
    ns.forEach((n) => {
      if (!Number.isFinite(n.x)) return
      minX = Math.min(minX, n.x)
      maxX = Math.max(maxX, n.x)
      minY = Math.min(minY, n.y)
      maxY = Math.max(maxY, n.y)
    })
    if (!Number.isFinite(minX)) return
    const bw = Math.max(maxX - minX, 80)
    const bh = Math.max(maxY - minY, 80)
    const k = Math.min(1.2, 0.85 * Math.min(w / bw, h / bh))
    const cx = (minX + maxX) / 2
    const cy = (minY + maxY) / 2
    transformRef.current = {
      k,
      x: w / 2 - cx * k,
      y: h / 2 - cy * k,
    }
  }, [focusId, communityName, pathNodeIds, size, nodes, anchors])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const { w, h } = size
    if (canvas.width !== Math.floor(w * dpr) || canvas.height !== Math.floor(h * dpr)) {
      canvas.width = Math.floor(w * dpr)
      canvas.height = Math.floor(h * dpr)
      canvas.style.width = `${w}px`
      canvas.style.height = `${h}px`
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    const grad = ctx.createLinearGradient(0, 0, w, h)
    grad.addColorStop(0, BG_TOP)
    grad.addColorStop(0.45, BG_MID)
    grad.addColorStop(1, BG_BOT)
    ctx.fillStyle = grad
    ctx.fillRect(0, 0, w, h)

    const { k, x: tx, y: ty } = transformRef.current
    ctx.save()
    ctx.translate(tx, ty)
    ctx.scale(k, k)

    const focus = focusRef.current
    const hover = hoverRef.current
    const pathSet = pathNodesRef.current ? new Set(pathNodesRef.current) : null
    const pathEdgeSet = pathEdgesRef.current ? new Set(pathEdgesRef.current) : null
    const activeCommunity = communityRef.current
    const links = linksRef.current
    const ns = nodesRef.current

    // Community labels (clickable)
    if (!focus && k > 0.45) {
      Object.entries(anchors).forEach(([name, pos]) => {
        const active = activeCommunity === name
        ctx.save()
        ctx.globalAlpha = active ? 0.7 : 0.38
        ctx.font = `${active ? 700 : 600} ${Math.max(11, 14 / k)}px Georgia, serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = active ? '#0D7377' : '#1B3A4B'
        ctx.fillText(name, pos.x, pos.y)
        ctx.restore()
      })
    }

    // Links
    links.forEach((link) => {
      const src = typeof link.source === 'object' ? link.source : ns.find((n) => n.id === link.source)
      const tgt = typeof link.target === 'object' ? link.target : ns.find((n) => n.id === link.target)
      if (!src || !tgt || !Number.isFinite(src.x) || !Number.isFinite(tgt.x)) return

      const onPath = pathEdgeSet
        ? pathEdgeSet.has(link.id)
        : pathSet && pathSet.has(src.id) && pathSet.has(tgt.id)
      const involvesFocus = focus && (src.id === focus || tgt.id === focus)
      const bothDimmed = src.dimmed && tgt.dimmed && !involvesFocus && !onPath
      const isAffinity = link.type === 'affinity'
      const offPathContext = Boolean(pathEdgeSet) && !onPath

      ctx.beginPath()
      ctx.moveTo(src.x, src.y)
      ctx.lineTo(tgt.x, tgt.y)
      if (isAffinity) {
        ctx.setLineDash(onPath ? [7 / k, 6 / k] : [5 / k, 5.5 / k])
        ctx.strokeStyle = onPath ? 'rgba(13, 115, 119, 0.95)' : AFFINITY_COLOR
        ctx.globalAlpha = bothDimmed || offPathContext ? 0.06 : onPath ? 1 : 0.55
        ctx.lineWidth = ((onPath ? 2.8 : 0.8) + (link.weight || 0.3)) / k
      } else {
        ctx.setLineDash([])
        ctx.strokeStyle = onPath || involvesFocus ? REAL_FOCUS_COLOR : REAL_COLOR
        ctx.globalAlpha = bothDimmed || offPathContext ? 0.08 : 1
        ctx.lineWidth = ((onPath ? 3.2 : 1.2) + (link.weight || 0.5) * 1.4) / k
      }
      ctx.stroke()
      ctx.globalAlpha = 1
      ctx.setLineDash([])
    })

    // Nodes
    ns.forEach((node) => {
      if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return
      const isFocus = focus === node.id
      const isHover = hover === node.id
      const onPath = pathSet ? pathSet.has(node.id) : node.on_path
      const dim = node.dimmed && !isFocus && !isHover && !onPath
      const r = isFocus || onPath ? 10 : isHover || node.highlighted ? 7.5 : 5.8

      ctx.save()
      ctx.globalAlpha = dim ? 0.22 : 1

      if (!dim) {
        const glowR = r * (isFocus || onPath ? 4 : 3)
        const glow = ctx.createRadialGradient(node.x, node.y, 0, node.x, node.y, glowR)
        glow.addColorStop(0, withAlpha(node.color, '66'))
        glow.addColorStop(0.5, withAlpha(node.color, '22'))
        glow.addColorStop(1, withAlpha(node.color, '00'))
        ctx.beginPath()
        ctx.arc(node.x, node.y, glowR, 0, Math.PI * 2)
        ctx.fillStyle = glow
        ctx.fill()
      }

      if (isFocus || onPath) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 6, 0, Math.PI * 2)
        ctx.strokeStyle = withAlpha(node.color, '77')
        ctx.lineWidth = 2 / k
        ctx.stroke()
      }

      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, Math.PI * 2)
      ctx.fillStyle = node.color
      ctx.fill()
      ctx.strokeStyle = isFocus || isHover || onPath ? '#fff' : 'rgba(255,255,255,0.7)'
      ctx.lineWidth = (isFocus || onPath ? 2.4 : 1.2) / k
      ctx.stroke()

      const showLabel =
        isFocus ||
        isHover ||
        onPath ||
        k > 1.2 ||
        (node.highlighted && !dim && k > 0.85)
      if (showLabel) {
        const fontSize = Math.max(11, 12.5 / Math.sqrt(k))
        ctx.font = `${isFocus || onPath ? 600 : 500} ${fontSize}px system-ui, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        ctx.fillStyle = dim ? 'rgba(27,58,75,0.3)' : 'rgba(27,58,75,0.9)'
        ctx.fillText(isFocus || isHover || onPath ? node.name : node.label, node.x, node.y + r + 5)
      }
      ctx.restore()
    })

    ctx.restore()
  }, [anchors, size])

  // Animation loop
  useEffect(() => {
    let alive = true
    const tick = () => {
      if (!alive) return
      draw()
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => {
      alive = false
      cancelAnimationFrame(rafRef.current)
    }
  }, [draw])

  const toGraph = useCallback((clientX, clientY) => {
    const rect = canvasRef.current.getBoundingClientRect()
    const { k, x, y } = transformRef.current
    return {
      x: (clientX - rect.left - x) / k,
      y: (clientY - rect.top - y) / k,
    }
  }, [])

  const hitTest = useCallback((gx, gy) => {
    const { k } = transformRef.current
    const hitR = 14 / k
    let best = null
    let bestD = hitR * hitR
    nodesRef.current.forEach((n) => {
      const dx = n.x - gx
      const dy = n.y - gy
      const d = dx * dx + dy * dy
      if (d <= bestD) {
        bestD = d
        best = n
      }
    })
    return best
  }, [])

  const hitTestCommunity = useCallback(
    (gx, gy) => {
      const { k } = transformRef.current
      const hitR = 36 / k
      let best = null
      let bestD = hitR * hitR
      Object.entries(anchors).forEach(([name, pos]) => {
        const dx = pos.x - gx
        const dy = pos.y - gy
        const d = dx * dx + dy * dy
        if (d <= bestD) {
          bestD = d
          best = name
        }
      })
      return best
    },
    [anchors]
  )

  // Pointer interactions
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return undefined

    const onWheel = (e) => {
      e.preventDefault()
      const rect = canvas.getBoundingClientRect()
      const { k, x, y } = transformRef.current
      const mx = e.clientX - rect.left
      const my = e.clientY - rect.top
      const nextK = Math.min(5, Math.max(0.3, k * (e.deltaY < 0 ? 1.08 : 0.92)))
      const gx = (mx - x) / k
      const gy = (my - y) / k
      transformRef.current = {
        k: nextK,
        x: mx - gx * nextK,
        y: my - gy * nextK,
      }
    }

    const onDown = (e) => {
      const g = toGraph(e.clientX, e.clientY)
      const hit = hitTest(g.x, g.y)
      moved.current = false
      if (hit) {
        dragRef.current = {
          id: hit.id,
          dx: hit.x - g.x,
          dy: hit.y - g.y,
          startX: e.clientX,
          startY: e.clientY,
        }
        hit.fx = hit.x
        hit.fy = hit.y
        simRef.current?.alphaTarget(0.15).restart()
        canvas.style.cursor = 'grabbing'
      } else {
        panRef.current = {
          x: e.clientX,
          y: e.clientY,
          tx: transformRef.current.x,
          ty: transformRef.current.y,
        }
        canvas.style.cursor = 'grabbing'
      }
    }

    const onMove = (e) => {
      if (dragRef.current || panRef.current) {
        const sx = dragRef.current?.startX ?? panRef.current?.x
        const sy = dragRef.current?.startY ?? panRef.current?.y
        if (sx != null && (Math.abs(e.clientX - sx) > 4 || Math.abs(e.clientY - sy) > 4)) {
          moved.current = true
        }
      }

      const g = toGraph(e.clientX, e.clientY)

      if (dragRef.current) {
        const node = nodesRef.current.find((n) => n.id === dragRef.current.id)
        if (node) {
          node.fx = g.x + dragRef.current.dx
          node.fy = g.y + dragRef.current.dy
          node.x = node.fx
          node.y = node.fy
        }
        return
      }

      if (panRef.current) {
        transformRef.current = {
          ...transformRef.current,
          x: panRef.current.tx + (e.clientX - panRef.current.x),
          y: panRef.current.ty + (e.clientY - panRef.current.y),
        }
        return
      }

      const hit = hitTest(g.x, g.y)
      const nextId = hit?.id || null
      if (hoverRef.current !== nextId) {
        hoverRef.current = nextId
        setHoverName(hit?.name || null)
        if (hit) {
          canvas.style.cursor = 'pointer'
        } else if (hitTestCommunity(g.x, g.y)) {
          canvas.style.cursor = 'pointer'
          setHoverName(null)
        } else {
          canvas.style.cursor = bridgePickMode ? 'crosshair' : 'grab'
        }
      }
    }

    const onUp = () => {
      if (dragRef.current) {
        const node = nodesRef.current.find((n) => n.id === dragRef.current.id)
        if (node) {
          node.fx = null
          node.fy = null
        }
        dragRef.current = null
        simRef.current?.alphaTarget(0.05)
      }
      panRef.current = null
      canvas.style.cursor = hoverRef.current ? 'pointer' : bridgePickMode ? 'crosshair' : 'grab'
    }

    const onClick = (e) => {
      if (moved.current) return
      const g = toGraph(e.clientX, e.clientY)
      const hit = hitTest(g.x, g.y)
      if (hit) {
        onNodeClick?.(hit)
        return
      }
      if (!focusRef.current) {
        const community = hitTestCommunity(g.x, g.y)
        if (community) onCommunityClick?.(community)
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    canvas.addEventListener('pointerdown', onDown)
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    canvas.addEventListener('click', onClick)

    return () => {
      canvas.removeEventListener('wheel', onWheel)
      canvas.removeEventListener('pointerdown', onDown)
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      canvas.removeEventListener('click', onClick)
    }
  }, [
    hitTest,
    hitTestCommunity,
    onNodeClick,
    onCommunityClick,
    toGraph,
    size.w,
    size.h,
    bridgePickMode,
  ])

  if (!nodes.length) {
    return (
      <div className="relative w-full h-[520px] min-h-[420px] flex items-center justify-center text-sm text-rhip-muted bg-gradient-to-br from-rhip-lightBg via-white to-rhip-lightTeal/30">
        No public profiles on the map yet.
      </div>
    )
  }

  return (
    <div
      ref={wrapRef}
      className="relative w-full h-[min(70vh,640px)] min-h-[420px] overflow-hidden"
    >
      <canvas ref={canvasRef} className="block w-full h-full touch-none" />
      <div className="pointer-events-none absolute bottom-3 left-4 right-4 flex justify-between text-[11px] text-rhip-muted/80">
        <span>Drag · pan · zoom · click community labels</span>
        <span>
          {bridgePickMode
            ? 'Click a person to complete the bridge'
            : hoverName
              ? `Click to focus ${hoverName}`
              : 'Living Knowledge Map'}
        </span>
      </div>
    </div>
  )
}
