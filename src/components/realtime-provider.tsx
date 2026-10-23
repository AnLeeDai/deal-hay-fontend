"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import type { Dispatch, SetStateAction } from "react"
import type Echo from "laravel-echo"
import type { ConnectionStatus } from "laravel-echo"
import { useRouter } from "next/navigation"
import { toast } from "sonner"

import type { RealtimeConfig } from "@/api/chats/types"
import { refreshUnreadCountsAction } from "@/modules/chats/actions"
import { loadRealtimeConfigAction } from "@/modules/realtime/actions"
import { useNotificationSound } from "@/modules/realtime/hooks/use-notification-sound"
import { useUnreadTabTitle } from "@/modules/realtime/hooks/use-unread-tab-title"
import type { UnreadCounts } from "@/types/auth"

type RealtimeConnection = {
  echo: Echo<"reverb"> | null
  status: ConnectionStatus
  socketId?: string
  subscriptionVersion: number
}

type RealtimeContextValue = RealtimeConnection & {
  reconnect: () => void
  heartbeatIntervalSeconds: number
  unreadCounts: UnreadCounts
  setUnreadCounts: Dispatch<SetStateAction<UnreadCounts>>
  synchronizeUnreadCounts: () => Promise<void>
  notificationSoundEnabled: boolean
  toggleNotificationSound: () => void
}

const RealtimeContext = createContext<RealtimeContextValue | null>(null)

type ConfigOverride = {
  source: RealtimeConfig | null
  value: RealtimeConfig | null
}

export function RealtimeProvider({
  config,
  currentUserId,
  initialUnreadCounts,
  children,
}: {
  config: RealtimeConfig | null
  currentUserId?: string
  initialUnreadCounts: UnreadCounts
  children: React.ReactNode
}) {
  const router = useRouter()
  const [generation, setGeneration] = useState(0)
  const [configOverride, setConfigOverride] = useState<ConfigOverride | null>(
    null
  )
  const [loadingConfig, setLoadingConfig] = useState(false)
  const loadingConfigRequest = useRef(false)
  const effectiveConfig =
    configOverride && configOverride.source === config
      ? configOverride.value
      : config
  const [unreadCounts, updateUnreadCounts] = useState(initialUnreadCounts)
  const seenEvents = useRef({
    userId: currentUserId,
    messages: new Set<string>(),
    notifications: new Set<string>(),
  })
  const {
    notificationSoundEnabled,
    toggleNotificationSound,
    playNotificationSound,
  } = useNotificationSound(currentUserId)
  useUnreadTabTitle(
    currentUserId ? unreadCounts.messages + unreadCounts.notifications : 0
  )
  const unreadRevision = useRef(0)
  const mounted = useRef(false)
  const unreadRefreshRequested = useRef(false)
  const unreadSynchronization = useRef<Promise<void> | null>(null)
  const setUnreadCounts = useCallback<Dispatch<SetStateAction<UnreadCounts>>>(
    (nextCounts) => {
      unreadRevision.current += 1
      updateUnreadCounts(nextCounts)
    },
    []
  )
  const synchronizeUnreadCounts = useCallback((): Promise<void> => {
    unreadRevision.current += 1
    unreadRefreshRequested.current = true
    if (unreadSynchronization.current) return unreadSynchronization.current

    const synchronize = async () => {
      try {
        while (unreadRefreshRequested.current && mounted.current) {
          unreadRefreshRequested.current = false
          const revision = unreadRevision.current
          const counts = await refreshUnreadCountsAction()
          if (!mounted.current) return

          // A newer event or read invalidates the response already in flight.
          if (revision !== unreadRevision.current) {
            unreadRefreshRequested.current = true
            continue
          }
          if (counts) setUnreadCounts(counts)
        }
      } catch {
        // Keep the current counters when an individual synchronization fails.
      } finally {
        unreadSynchronization.current = null
      }
    }

    const request = Promise.resolve().then(synchronize)
    unreadSynchronization.current = request
    return request
  }, [setUnreadCounts])
  const [connection, setConnection] = useState<RealtimeConnection>(() => ({
    echo: null,
    status: currentUserId ? (config ? "connecting" : "failed") : "disconnected",
    subscriptionVersion: 0,
  }))
  const host = effectiveConfig?.host
  const key = effectiveConfig?.key
  const port = effectiveConfig?.port
  const scheme = effectiveConfig?.scheme
  const heartbeatIntervalSeconds =
    effectiveConfig?.heartbeat_interval_seconds ?? 45

  const reconnect = useCallback(() => {
    if (!currentUserId || loadingConfigRequest.current) return
    loadingConfigRequest.current = true
    setLoadingConfig(true)
    setConnection((previous) => ({
      echo: null,
      status: "connecting",
      subscriptionVersion: previous.subscriptionVersion,
    }))

    void loadRealtimeConfigAction()
      .catch(() => null)
      .then((nextConfig) => {
        if (!mounted.current) return

        setConfigOverride({ source: config, value: nextConfig })
        setLoadingConfig(false)
        setConnection((previous) => ({
          echo: null,
          status: nextConfig ? "connecting" : "failed",
          subscriptionVersion: previous.subscriptionVersion,
        }))
        setGeneration((previous) => previous + 1)
      })
      .finally(() => {
        loadingConfigRequest.current = false
      })
  }, [config, currentUserId])

  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
      unreadRefreshRequested.current = false
    }
  }, [])

  useEffect(() => {
    if (loadingConfig || !currentUserId || !host || !key || !port || !scheme) {
      return
    }

    let disposed = false
    let instance: Echo<"reverb"> | undefined
    let unsubscribeConnection: (() => void) | undefined
    let accountSubscribed = false
    let subscriptionFailed = false
    let hasSubscribed = false
    if (seenEvents.current.userId !== currentUserId) {
      seenEvents.current = {
        userId: currentUserId,
        messages: new Set<string>(),
        notifications: new Set<string>(),
      }
    }
    const seenMessageIds = seenEvents.current.messages
    const seenNotificationIds = seenEvents.current.notifications

    const rememberEvent = (ids: Set<string>, id: string) => {
      if (ids.has(id)) return false
      ids.add(id)
      if (ids.size > 1000) {
        const oldestId = ids.values().next().value
        if (oldestId) ids.delete(oldestId)
      }
      return true
    }

    void Promise.all([import("laravel-echo"), import("pusher-js")])
      .then(([{ default: EchoClient }, { default: Pusher }]) => {
        if (disposed) return

        instance = new EchoClient<"reverb">({
          broadcaster: "reverb",
          key,
          wsHost: host,
          wsPort: port,
          wssPort: port,
          forceTLS: scheme === "https",
          enabledTransports: ["ws", "wss"],
          authEndpoint: "/api/broadcasting/auth",
          auth: { headers: { Accept: "application/json" } },
          Pusher,
          withoutInterceptors: true,
        })

        const synchronizeConnection = (transportStatus: ConnectionStatus) => {
          if (disposed) return

          if (transportStatus !== "connected") {
            accountSubscribed = false
            subscriptionFailed = false
          }

          let status = transportStatus
          if (transportStatus === "connected") {
            status = subscriptionFailed
              ? "failed"
              : accountSubscribed
                ? "connected"
                : hasSubscribed
                  ? "reconnecting"
                  : "connecting"
          } else if (transportStatus === "connecting" && hasSubscribed) {
            status = "reconnecting"
          }

          setConnection((previous) => ({
            ...previous,
            echo: instance ?? null,
            status,
            socketId: status === "connected" ? instance?.socketId() : undefined,
          }))
        }

        instance
          .private(`user-chat.${currentUserId}`)
          .listen(".message.sent", (payload: unknown) => {
            if (
              disposed ||
              !payload ||
              typeof payload !== "object" ||
              !("id" in payload) ||
              typeof payload.id !== "string" ||
              !("sender" in payload) ||
              !payload.sender ||
              typeof payload.sender !== "object" ||
              !("id" in payload.sender) ||
              typeof payload.sender.id !== "string" ||
              payload.sender.id === currentUserId ||
              !("read_at" in payload) ||
              payload.read_at ||
              !rememberEvent(seenMessageIds, payload.id)
            ) {
              return
            }

            setUnreadCounts((previous) => ({
              ...previous,
              messages: previous.messages + 1,
            }))
            playNotificationSound(`message:${payload.id}`)
            void synchronizeUnreadCounts()
          })
          .listen(".messages.read", (payload: unknown) => {
            if (
              !disposed &&
              payload &&
              typeof payload === "object" &&
              "reader_id" in payload &&
              payload.reader_id === currentUserId
            ) {
              void synchronizeUnreadCounts()
            }
          })
          .subscribed(() => {
            if (disposed) return

            accountSubscribed = true
            subscriptionFailed = false
            hasSubscribed = true
            setConnection((previous) => ({
              echo: instance ?? null,
              status: "connected",
              socketId: instance?.socketId(),
              subscriptionVersion: previous.subscriptionVersion + 1,
            }))
            void synchronizeUnreadCounts()
          })
          .error(() => {
            if (disposed) return

            accountSubscribed = false
            subscriptionFailed = true
            setConnection((previous) => ({
              ...previous,
              echo: instance ?? null,
              status: "failed",
              socketId: undefined,
            }))
          })

        instance
          .private(`user-notifications.${currentUserId}`)
          .listen(".notification.created", (payload: unknown) => {
            if (
              disposed ||
              !payload ||
              typeof payload !== "object" ||
              !("id" in payload) ||
              typeof payload.id !== "string" ||
              ("read_at" in payload && payload.read_at) ||
              !rememberEvent(seenNotificationIds, payload.id)
            ) {
              return
            }

            setUnreadCounts((previous) => ({
              ...previous,
              notifications: previous.notifications + 1,
            }))
            playNotificationSound(`notification:${payload.id}`)
            if ("title" in payload && typeof payload.title === "string") {
              toast(payload.title, {
                id: payload.id,
                description:
                  "body" in payload && typeof payload.body === "string"
                    ? payload.body
                    : undefined,
                action: {
                  label: "Xem",
                  onClick: () => router.push("/notifications"),
                },
              })
            }
            void synchronizeUnreadCounts()
          })
          .listen(".notifications.read", () => void synchronizeUnreadCounts())
          .subscribed(() => void synchronizeUnreadCounts())

        unsubscribeConnection = instance.connector.onConnectionChange(
          synchronizeConnection
        )
        synchronizeConnection(instance.connectionStatus())
      })
      .catch(() => {
        if (disposed) return
        setConnection((previous) => ({
          ...previous,
          echo: null,
          status: "failed",
          socketId: undefined,
        }))
      })

    return () => {
      disposed = true
      unsubscribeConnection?.()
      instance?.disconnect()
    }
  }, [
    currentUserId,
    generation,
    host,
    key,
    loadingConfig,
    port,
    playNotificationSound,
    scheme,
    router,
    setUnreadCounts,
    synchronizeUnreadCounts,
  ])

  const value = useMemo(
    () => ({
      ...connection,
      reconnect,
      heartbeatIntervalSeconds,
      unreadCounts,
      setUnreadCounts,
      synchronizeUnreadCounts,
      notificationSoundEnabled,
      toggleNotificationSound,
    }),
    [
      connection,
      reconnect,
      heartbeatIntervalSeconds,
      unreadCounts,
      setUnreadCounts,
      synchronizeUnreadCounts,
      notificationSoundEnabled,
      toggleNotificationSound,
    ]
  )

  return (
    <RealtimeContext.Provider value={value}>
      {children}
    </RealtimeContext.Provider>
  )
}

export function useRealtime() {
  const context = useContext(RealtimeContext)
  if (!context) {
    throw new Error("useRealtime must be used within RealtimeProvider")
  }
  return context
}
