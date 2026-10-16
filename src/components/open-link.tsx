/** Small external-link icon that opens a problem on its judge in a new tab. */
export function OpenLink({ url, name }: { url: string | null; name: string }) {
  if (!url) return null;
  return (
    <a
      href={url}
      target="_blank"
      rel="noreferrer"
      aria-label={`Open ${name} on its judge`}
      title="Open on the judge"
      className="inline-flex shrink-0 text-pencil hover:text-ink"
    >
      <svg aria-hidden viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M6 3H3v10h10v-3M9 2h5v5M14 2 7 9" />
      </svg>
    </a>
  );
}
