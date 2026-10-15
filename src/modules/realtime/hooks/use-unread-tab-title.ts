"use client"

import { useEffect } from "react"

export function useUnreadTabTitle(totalUnread: number) {
  useEffect(() => {
    if (totalUnread <= 0) return

    let pageTitle = document.title
    let appliedTitle: string | undefined
    let titleElement: HTMLTitleElement | null = null

    const updateTitle = () => {
      const currentTitle = document.title
      if (currentTitle === appliedTitle) return

      // Next can replace the route metadata while the unread count stays the same.
      pageTitle = currentTitle
      document.title = pageTitle
        ? `(${totalUnread}) ${pageTitle}`
        : `(${totalUnread})`
      appliedTitle = document.title
      titleElement = document.head.querySelector("title")
    }

    const observer = new MutationObserver(updateTitle)
    observer.observe(document.head, {
      childList: true,
      characterData: true,
      subtree: true,
    })
    updateTitle()

    return () => {
      observer.disconnect()
      // React can detach a hoisted title before cleanup, then reuse that node.
      // Restore only our own text and preserve newer route metadata.
      if (titleElement && titleElement.textContent === appliedTitle) {
        titleElement.textContent = pageTitle
      }
    }
  }, [totalUnread])
}
