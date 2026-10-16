import { Suspense } from "react";
import { UnlockForm } from "./unlock-form";

export default function UnlockPage({ searchParams }: PageProps<"/unlock">) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 py-12">
      <h1 className="font-display text-5xl font-semibold tracking-tight">upsolve</h1>
      <p className="mt-2 text-pencil">Enter your passcode to open your tracker.</p>
      <Suspense fallback={<UnlockForm next="/today" />}>
        <UnlockFormWithNext searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function UnlockFormWithNext({ searchParams }: Pick<PageProps<"/unlock">, "searchParams">) {
  const { next } = await searchParams;
  return <UnlockForm next={typeof next === "string" ? next : "/today"} />;
}
