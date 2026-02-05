import { useEffect, useRef, useCallback } from 'react'
import { useStreamStore } from '../store/stream-store'
import type { ServerEvent } from '../types'
import type { TTSPipeline } from '../services/tts-pipeline'
import { WS_URL } from '../constants'

const RECONNECT_CONFIG = {
  initialDelay: 1000,
  maxDelay: 30000,
  backoffMultiplier: 2,
}

export function useWebSocket(pipeline: TTSPipeline) {
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectDelay = useRef(RECONNECT_CONFIG.initialDelay)
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const mountedRef = useRef(true)
  const isLiveRef = useRef(false)

  const {
    setConnectionStatus,
    setState,
    updateState,
    addActivity,
    addEventLog,
    setIsLive,
  } = useStreamStore()

  const handleMessage = useCallback(
    (event: MessageEvent) => {
      try {
        const msg = JSON.parse(event.data) as ServerEvent
        switch (msg.type) {
          case 'state:full':
            setState(msg.data)
            addEventLog('state', `Full state received (phase: ${msg.data.phase})`)
            pipeline.reset()
            isLiveRef.current = false
            setIsLive(false)
            setTimeout(() => {
              isLiveRef.current = true
              setIsLive(true)
            }, 500)
            break
          case 'state:update':
            updateState(msg.data)
            if (msg.data.phase) {
              addEventLog('state', `Phase: ${msg.data.phase}`)
            }
            break
          case 'agent:activity':
            addActivity(msg.data)
            addEventLog(
              msg.data.type,
              msg.data.type === 'tool'
                ? `[${msg.data.toolName}] ${msg.data.content.substring(0, 80)}`
                : msg.data.content.substring(0, 100),
            )
            if (isLiveRef.current && msg.data.type === 'text') {
              pipeline.onTextDelta(msg.data.content)
            }
            if (msg.data.type === 'tool' && msg.data.toolStatus === 'running') {
              pipeline.onNewGeneration()
            }
            break
          case 'game:event':
            addEventLog('game', `${msg.data.type}: ${msg.data.gameId}`)
            break
          case 'error':
            addEventLog('error', msg.message)
            break
        }
      } catch {
        // Invalid message
      }
    },
    [setState, updateState, addActivity, addEventLog, setIsLive, pipeline],
  )

  const connect = useCallback(() => {
    if (!mountedRef.current) return

    setConnectionStatus('connecting')
    const ws = new WebSocket(WS_URL)
    wsRef.current = ws

    ws.onopen = () => {
      setConnectionStatus('connected')
      reconnectDelay.current = RECONNECT_CONFIG.initialDelay
      addEventLog('system', 'WebSocket connected')
    }

    ws.onmessage = handleMessage

    ws.onclose = () => {
      if (!mountedRef.current) return
      if (wsRef.current !== ws) return
      setConnectionStatus('reconnecting')
      addEventLog('system', 'WebSocket disconnected, reconnecting...')
      scheduleReconnect()
    }

    ws.onerror = () => {
      // onclose will fire after this
    }
  }, [setConnectionStatus, handleMessage, addEventLog])

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current) return
    if (reconnectTimer.current) clearTimeout(reconnectTimer.current)

    reconnectTimer.current = setTimeout(() => {
      reconnectTimer.current = null
      connect()
    }, reconnectDelay.current)

    reconnectDelay.current = Math.min(
      reconnectDelay.current * RECONNECT_CONFIG.backoffMultiplier,
      RECONNECT_CONFIG.maxDelay,
    )
  }, [connect])

  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false
      if (reconnectTimer.current) {
        clearTimeout(reconnectTimer.current)
      }
      wsRef.current?.close()
    }
  }, [connect])
}
