"use client";

import { useEffect, useRef } from "react";

// Scroll-reveal wrapper. The hidden state and transition live in globals.css,
// gated on `(prefers-reduced-motion: no-preference) and (scripting: enabled)`,
// so reduced-motion visitors and no-JS visitors always get the full static
// page. This component only flips `data-revealed` the first time the element
// enters the viewport; the CSS transition does the rest.

type RevealFrom = "up" | "left" | "right" | "scale";

interface RevealProps {
  children: React.ReactNode;
  className?: string;
  // Direction the content travels in from; selects the matching CSS transform.
  from?: RevealFrom;
  // Transition delay in ms, used to stagger sibling reveals.
  delayMs?: number;
  // Rendered element. `li` lets list items reveal without invalid div-in-list markup.
  as?: "div" | "li";
}

const Reveal: React.FC<RevealProps> = ({
  children,
  className,
  from = "up",
  delayMs = 0,
  as: Tag = "div",
}) => {
  const ref = useRef<HTMLDivElement & HTMLLIElement>(null);

  useEffect(() => {
    const node = ref.current;
    if (node == null) return;

    // Reduced-motion CSS never hides the element, but set the attribute anyway
    // so the DOM state is consistent for both motion preferences.
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      node.setAttribute("data-revealed", "");
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.setAttribute("data-revealed", "");
            observer.unobserve(entry.target);
          }
        }
      },
      // Fire slightly before the element is meaningfully on screen so the
      // transition is visible but content never feels late.
      { rootMargin: "0px 0px -10% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      ref={ref}
      data-reveal={from}
      className={className}
      style={{ "--reveal-delay": `${delayMs}ms` } as React.CSSProperties}
    >
      {children}
    </Tag>
  );
};

export default Reveal;
