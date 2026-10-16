import Link from "next/link";
import { NavLinks } from "@/components/nav-links";
import { lock } from "../unlock/actions";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
      <header className="flex h-14 items-center gap-6">
        <Link href="/" className="font-display text-xl font-semibold tracking-tight">
          upsolve
        </Link>
        <NavLinks />
        <form action={lock} className="ml-auto">
          <button type="submit" className="text-meta text-pencil hover:text-ink">
            Lock
          </button>
        </form>
      </header>
      {children}
    </div>
  );
}
