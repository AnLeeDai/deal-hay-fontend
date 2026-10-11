"use client"

import { useTransition } from "react"
import { LockIcon, LockOpenIcon, UsersIcon } from "lucide-react"
import { toast } from "sonner"

import { DataPagination } from "@/components/layout/data-pagination"
import { EmptyState } from "@/components/layout/empty-state"
import { PageHeader } from "@/components/layout/page-header"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { UserAvatar } from "@/components/user-avatar"
import { toggleUserLockAction } from "@/modules/admin/actions"
import { AdminNavigation } from "@/modules/admin/components/admin-navigation"
import type { User } from "@/types/auth"
import type { PaginatedResponse } from "@/types/common"

const roleLabels: Record<string, string> = {
  administrator: "Quản trị viên",
  shop_owner: "Chủ cửa hàng",
  customer: "Khách hàng",
}

export function AdminUsersClient({
  users,
}: {
  users: PaginatedResponse<User>
}) {
  const [pending, startTransition] = useTransition()

  return (
    <div className="space-y-8">
      <PageHeader
        title="Quản lý người dùng"
        description="Kiểm soát trạng thái tài khoản và quyền truy cập trên toàn hệ thống."
      />
      <AdminNavigation />

      {users.data.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UsersIcon className="size-5 text-primary" /> Danh sách tài khoản
            </CardTitle>
            <CardDescription>
              {users.total} người dùng trong hệ thống
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Người dùng</TableHead>
                  <TableHead className="hidden md:table-cell">
                    Vai trò
                  </TableHead>
                  <TableHead>Trạng thái</TableHead>
                  <TableHead className="text-right">Thao tác</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.data.map((user) => {
                  const isActive = Number(user.is_active) === 1
                  return (
                    <TableRow key={user.id}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <UserAvatar
                            name={user.full_name}
                            src={user.avatar_url}
                          />
                          <div className="min-w-0">
                            <p className="truncate font-medium">
                              {user.full_name}
                            </p>
                            <p className="max-w-52 truncate text-xs text-muted-foreground">
                              {user.email} · {user.user_code}
                            </p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline">
                          {roleLabels[user.role] ?? user.role}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={isActive ? "secondary" : "destructive"}>
                          {isActive ? "Hoạt động" : "Đã khoá"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        {user.role !== "administrator" ? (
                          <Button
                            aria-label={
                              isActive
                                ? `Khoá ${user.full_name}`
                                : `Mở khoá ${user.full_name}`
                            }
                            disabled={pending}
                            size="sm"
                            variant={isActive ? "destructive" : "outline"}
                            onClick={() =>
                              startTransition(async () => {
                                try {
                                  await toggleUserLockAction(
                                    user.id,
                                    isActive ? "lock" : "unlock",
                                    isActive
                                      ? "Khoá bởi quản trị viên"
                                      : undefined
                                  )
                                  toast.success(
                                    "Đã cập nhật trạng thái tài khoản."
                                  )
                                } catch {
                                  toast.error(
                                    "Không thể cập nhật trạng thái tài khoản."
                                  )
                                }
                              })
                            }
                          >
                            {isActive ? <LockIcon /> : <LockOpenIcon />}
                            <span className="hidden lg:inline">
                              {isActive ? "Khoá" : "Mở khoá"}
                            </span>
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">
                            Được bảo vệ
                          </span>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
            <DataPagination
              currentPage={users.current_page}
              lastPage={users.last_page}
            />
          </CardContent>
        </Card>
      ) : (
        <EmptyState
          title="Chưa có dữ liệu người dùng"
          description="Người dùng mới sẽ xuất hiện tại đây."
        />
      )}
    </div>
  )
}
