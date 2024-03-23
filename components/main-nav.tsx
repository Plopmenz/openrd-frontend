import * as React from "react"
import Image from "next/image"
import Link from "next/link"

import { NavItem } from "@/types/nav"
import { siteConfig } from "@/config/site"
import { cn } from "@/lib/utils"
import { usePathname } from 'next/navigation'

interface MainNavProps {
  items?: NavItem[]
}

export function MainNav({ items }: MainNavProps) {
  const pathname = usePathname()

  return (
    <div className="flex gap-6 md:gap-10">
      <Link href="/" className="flex items-center space-x-2">
        <Image alt="Logo" src="/icon.png" width={20} height={20} />
        <span className="inline-block font-bold">{siteConfig.name}</span>
      </Link>
      {items?.length ? (
        <nav className="flex gap-6">
          {items?.map(
            (item, index) =>
              item.href && (
                <Link
                  key={index}
                  href={item.href}
                  className={cn(
                    "flex items-center text-sm font-medium text-muted-foreground hover:text-[#000000d0] dark:hover:text-[#ffffffdc]",
                    item.disabled && "cursor-not-allowed opacity-80",
                    pathname.endsWith('/tasks') && item.title === 'Tasks' && "text-black dark:text-white",
                    pathname.endsWith('/') && item.title === 'Home' && "text-black dark:text-white",
                  )}
                >
                  {item.title}
                </Link>
              )
          )}
        </nav>
      ) : null}
    </div>
  )
}
