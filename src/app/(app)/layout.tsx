import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { lock } from "../unlock/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      {/* Phones: wordmark and Lock on one row, nav below. */}
      <header className="flex flex-wrap items-center gap-x-6 gap-y-2 py-3 sm:h-14 sm:flex-nowrap sm:py-0">
        <Link href="/today" className="shrink-0 font-display text-xl font-semibold tracking-tight">
          upsolve
        </Link>
        <NavLinks />
        <form action={lock} className="ml-auto shrink-0">
          <button type="submit" className="text-meta text-pencil hover:text-ink">
            Lock
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
