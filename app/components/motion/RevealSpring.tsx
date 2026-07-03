"use client";

import { m } from "motion/react";

// Spring-physics scroll reveal: fades and rises the first time the element
// enters the viewport. Must render inside MotionProvider (LazyMotion). With
// MotionConfig reducedMotion="user", reduced-motion visitors get a plain
// opacity fade with no movement.

interface RevealSpringProps {
  children: React.ReactNode;
  className?: string;
  // Delay in seconds, for staggering sibling reveals.
  delay?: number;
  // Initial vertical offset in px.
  y?: number;
}

const RevealSpring: React.FC<RevealSpringProps> = ({ children, className, delay = 0, y = 36 }) => (
  <m.div
    className={className}
    initial={{ opacity: 0, y }}
    whileInView={{ opacity: 1, y: 0 }}
    // Positive bottom margin prefires the reveal ~200px before the element
    // scrolls into view, so content never feels late and tall-viewport
    // captures (previews, screenshots) resolve more of the page.
    viewport={{ once: true, amount: 0.1, margin: "0px 0px 200px 0px" }}
    transition={{ type: "spring", stiffness: 90, damping: 16, delay }}
  >
    {children}
  </m.div>
);

export default RevealSpring;
