import type { ReactNode } from "react"
import {
  BadgeCheckIcon,
  MessageCircleIcon,
  ShieldCheckIcon,
  StoreIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"

const benefits = [
  {
    icon: StoreIcon,
    title: "Nhiều gian hàng",
    description: "Khám phá sản phẩm từ các cửa hàng trên cùng một nền tảng.",
  },
  {
    icon: MessageCircleIcon,
    title: "Trao đổi trực tiếp",
    description: "Hỏi người bán về sản phẩm trước khi quyết định.",
  },
  {
    icon: ShieldCheckIcon,
    title: "Thông tin minh bạch",
    description: "Theo dõi đánh giá, thông báo và trạng thái tài khoản.",
  },
  {
    icon: BadgeCheckIcon,
    title: "Dễ dàng bán hàng",
    description: "Nâng cấp tài khoản và quản lý cửa hàng tập trung.",
  },
]

export function AuthShell({
  title,
  description,
  children,
}: {
  title: string
  description: string
  children: ReactNode
}) {
  return (
    <div className="grid min-h-[calc(100svh-14rem)] gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
      <section className="relative hidden overflow-hidden rounded-3xl bg-foreground p-10 text-background lg:block">
        <div className="absolute -top-24 -right-24 size-72 rounded-full bg-primary/30 blur-3xl" />
        <div className="relative space-y-8">
          <Badge
            className="border-background/20 bg-background/10 text-background"
            variant="outline"
          >
            Deal Hay Marketplace
          </Badge>
          <div className="space-y-4">
            <h1 className="font-heading text-4xl leading-tight font-semibold tracking-tight text-balance">
              {title}
            </h1>
            <p className="max-w-xl text-base leading-7 text-background/65">
              {description}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {benefits.map((benefit) => (
              <Card
                key={benefit.title}
                className="border-background/10 bg-background/5 text-background ring-0"
                size="sm"
              >
                <CardContent>
                  <benefit.icon className="size-5 text-primary" />
                  <div>
                    <p className="font-medium">{benefit.title}</p>
                    <p className="mt-1 text-xs leading-5 text-background/55">
                      {benefit.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto w-full max-w-md">
        <div className="mb-6 space-y-2 lg:hidden">
          <Badge variant="secondary">Deal Hay Marketplace</Badge>
          <h1 className="font-heading text-3xl font-semibold">{title}</h1>
          <p className="text-sm leading-6 text-muted-foreground">
            {description}
          </p>
        </div>
        {children}
      </section>
    </div>
  )
}
