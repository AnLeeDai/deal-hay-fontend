export const lookupRoutes = {
  provinces: "/addresses/provinces",
  wards: (provinceCode: string) => `/addresses/provinces/${provinceCode}/wards`,
} as const
