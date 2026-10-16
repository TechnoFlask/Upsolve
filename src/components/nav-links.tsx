"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Suspense } from "react";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/", label: "Problems" },
  { href: "/contests", label: "Contests" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/sync", label: "Sync" },
];

// The links prerender into the static shell; only the "current page"
// highlight waits for the URL.
export function NavLinks() {
  return (
    <Suspense fallback={<Links pathname={null} />}>
      <ActiveLinks />
    </Suspense>
  );
}

function ActiveLinks() {
  return <Links pathname={usePathname()} />;
}

function Links({ pathname }: { pathname: string | null }) {
  return (
    <nav className="order-last flex w-full gap-5 sm:order-none sm:w-auto sm:gap-4">
      {LINKS.map((l) => {
        const active = pathname != null && (l.href === "/" ? pathname === "/" : pathname.startsWith(l.href));
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={active ? "text-ink" : "text-pencil hover:text-ink"}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
