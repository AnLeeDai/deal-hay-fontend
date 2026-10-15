"use server"

import { getProvinces, getWards } from "@/api/lookups/queries"
import type { Province, Ward } from "@/api/lookups/types"

type LookupResult<T> = { data: T[]; error?: string }

export async function loadProvincesAction(): Promise<LookupResult<Province>> {
  try {
    return { data: await getProvinces() }
  } catch {
    return {
      data: [],
      error: "Không tải được danh sách tỉnh/thành. Vui lòng thử lại.",
    }
  }
}

export async function loadWardsAction(
  provinceCode: string
): Promise<LookupResult<Ward>> {
  if (!/^\d+$/.test(provinceCode)) {
    return { data: [], error: "Vui lòng chọn tỉnh/thành hợp lệ." }
  }

  try {
    return { data: await getWards(provinceCode) }
  } catch {
    return {
      data: [],
      error: "Không tải được danh sách phường/xã. Vui lòng thử lại.",
    }
  }
}
