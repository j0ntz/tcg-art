import { getShowcaseCards, type Card } from "@/lib/pokemon";
import Hero from "./components/Hero";
import HowItWorks from "./components/HowItWorks";
import BuildYourBinder from "./components/BuildYourBinder";
import Pricing from "./components/Pricing";

// Landing page (`/`), modeled on artfindertcg.com: hero with a real search entry
// point, how-it-works, a binder tease, and the freemium pricing table. The actual
// search app lives at /search.
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
      <Hero showcase={showcase} />
      <HowItWorks />
      <BuildYourBinder />
      <Pricing />
    </main>
  );
};

export default Home;
