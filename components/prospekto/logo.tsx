/* eslint-disable @next/next/no-html-link-for-pages -- Brand navigation must work before hydration. */
export function Logo({ plain = false, link = true }: { plain?: boolean; link?: boolean }) {
  const content = (
    <img src="/brand/prospekto-wordmark.svg?v=20260930-original" alt="" width={140} height={32} />
  );
  const className = `brand${plain ? ' brand-plain' : ''}`;

  return link ? (
    <a href="/" className={className} aria-label="Prospekto — úvod">
      {content}
    </a>
  ) : (
    <span className={className} role="img" aria-label="Prospekto">
      {content}
    </span>
  );
}
