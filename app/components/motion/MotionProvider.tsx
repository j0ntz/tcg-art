"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

// Shared motion context for the landing page. LazyMotion + m.* keeps the
// animation runtime to the tree-shaken domAnimation bundle (strict mode makes
// an accidental full `motion.*` import a build-time error), and MotionConfig
// honors the visitor's prefers-reduced-motion setting for every descendant.
const MotionProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <LazyMotion features={domAnimation} strict>
    <MotionConfig reducedMotion="user">{children}</MotionConfig>
  </LazyMotion>
);

export default MotionProvider;
