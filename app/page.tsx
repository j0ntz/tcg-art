import { getShowcaseCards, type Card } from "@/lib/pokemon";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import BuildYourBinder from "./components/BuildYourBinder";
import Pricing from "./components/Pricing";
import MotionProvider from "./components/motion/MotionProvider";

// Landing page (`/`), modeled on artfindertcg.com: hero with a real search entry
// point, how-it-works, a binder tease, and the freemium pricing table. The actual
// search app lives at /search. Sign-up CTAs (header + pricing) point at /signup.
// MotionProvider supplies the shared LazyMotion/reduced-motion context that the
// hero springs and section reveals run in.
const Home = async () => {
  let showcase: Card[] = [];
  try {
    showcase = await getShowcaseCards(5);
  } catch {
    // Best-effort art only. A failed/rate-limited API call should not break the
    // landing page, so fall back to a text-only hero.
    showcase = [];
  }

  return (
    <main className="flex flex-1 flex-col">
      <MotionProvider>
        <Hero showcase={showcase} />
        <HowItWorks />
        <BuildYourBinder />
        <Pricing />
      </MotionProvider>
    </main>
  );
};

export default Home;
