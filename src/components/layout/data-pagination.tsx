"use client"

import { usePathname, useSearchParams } from "next/navigation"

import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination"

function getVisiblePages(current: number, last: number) {
  const pages = new Set([1, last, current - 1, current, current + 1])
  return [...pages]
    .filter((page) => page >= 1 && page <= last)
    .sort((a, b) => a - b)
}

export function DataPagination({
  currentPage = 1,
  lastPage = 1,
}: {
  currentPage?: number
  lastPage?: number
}) {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  if (lastPage <= 1) return null

  const hrefFor = (page: number) => {
    const params = new URLSearchParams(searchParams.toString())
    if (page <= 1) params.delete("page")
    else params.set("page", String(page))
    const query = params.toString()
    return query ? `${pathname}?${query}` : pathname
  }

  const pages = getVisiblePages(currentPage, lastPage)

  return (
    <Pagination className="pt-4">
      <PaginationContent>
        <PaginationItem>
          <PaginationPrevious
            disabled={currentPage <= 1}
            href={hrefFor(Math.max(1, currentPage - 1))}
            text="Trước"
          />
        </PaginationItem>
        {pages.map((page, index) => (
          <PaginationItem key={page} className="flex items-center">
            {index > 0 && page - pages[index - 1] > 1 ? (
              <PaginationEllipsis />
            ) : null}
            <PaginationLink
              href={hrefFor(page)}
              isActive={page === currentPage}
            >
              {page}
            </PaginationLink>
          </PaginationItem>
        ))}
        <PaginationItem>
          <PaginationNext
            disabled={currentPage >= lastPage}
            href={hrefFor(Math.min(lastPage, currentPage + 1))}
            text="Sau"
          />
        </PaginationItem>
      </PaginationContent>
    </Pagination>
  )
}
