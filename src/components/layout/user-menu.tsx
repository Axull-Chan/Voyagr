"use client"

import { LogOut } from "lucide-react"

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { signOutAction } from "@/features/auth/actions/auth.actions"

function getInitials(fullName: string | null, email: string) {
  const trimmed = fullName?.trim()
  if (trimmed) {
    const parts = trimmed.split(/\s+/)
    const first = parts[0]?.[0] ?? ""
    const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : ""
    return (first + last || trimmed.slice(0, 2)).toUpperCase()
  }
  return email.slice(0, 2).toUpperCase()
}

export function UserMenu({
  email,
  fullName,
  avatarUrl,
}: {
  email: string
  fullName: string | null
  avatarUrl: string | null
}) {
  const initials = getInitials(fullName, email)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger className="rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <Avatar>
          {avatarUrl && (
            <AvatarImage src={avatarUrl} alt={fullName ?? email} />
          )}
          <AvatarFallback>{initials}</AvatarFallback>
        </Avatar>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <div className="flex flex-col px-1.5 py-1">
          <span className="font-medium text-foreground">
            {fullName ?? "Traveler"}
          </span>
          <span className="truncate text-xs text-muted-foreground">
            {email}
          </span>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            void signOutAction()
          }}
        >
          <LogOut /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
