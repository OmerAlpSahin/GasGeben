# 🚀 Coin Fever: To Andromeda

A browser idle-clicker with a destination. You fly a rocket from Earth to the Andromeda galaxy, 2.4 million light-years away, one click at a time. No install, no build step, no server: open `index.html` in any modern browser. Progress saves automatically in the browser.

Everything in the game is play money. Nothing is bought or sold for real.

## How it plays

The game runs in chapters. Each planet is one:

1. **Docked.** The planet you're on fills the sky behind the ship. To leave you need fuel (coins) for the next leg, shown as a bar with a refuel countdown. Spend on fuel now, or on ship systems first? Your call. When you can afford it, a pulsing **LAUNCH** button starts a 3-2-1 countdown and liftoff.
2. **In flight.** Passive income is your cruising speed (autopilot ×1). **Clicking pushes the throttle** up to ×4 (more with relics); stop clicking and it decays back. Along the way: **events** with two choices and 20 seconds to decide (distress signals, derelicts, wormholes, solar flares, alien traders, a casino cruiser), plus supply pods, asteroids, pirates, drones, golden comets and, past the heliopause, black holes.
3. **Arrival.** The destination grows until it fills the screen, then a banner, a story line, a landing bonus and a trophy. From the Moon onward you **choose 1 of 3 planetary relics**: permanent perks such as Targeting Computer (+3% crit), Afterburner (+1 max throttle), Efficient Injectors (launch fuel -20%), or a random ship system ×2.
4. **Cash out** (prestige) any time to trade coins, systems and upgrades for Diamonds: permanent production and speed bonuses. Distance, relics and trophies are kept.
5. **Reach Andromeda** for the ending, then start New Game+ with warp ×3 forever.

Ship systems: Solar Panel → Fuel Cell → Mining Drone → Cargo Bay → Space Arcade → Orbital Casino → Galactic Bank → Star Exchange → Dark Matter Mine → Dyson Panel → Wormhole Toll. Late upgrades multiply ship speed (Ion Drive, Fusion Drive, Warp Drive, Alcubierre Engine).

## The journey

Launch Pad → Kármán Line → Space Station → The Moon → Mars → Asteroid Belt → Jupiter → Saturn → Uranus → Neptune → Pluto → Heliopause → Oort Cloud → Proxima Centauri → Sirius → Orion Nebula → Galactic Core → Intergalactic Void → **Andromeda**

Distances are real (roughly). Speed is shown in km/s, AU/s and eventually light-years per second. The Journey tab keeps a log with the date you reached each stop.

## The hooks, and why each one is there

| Hook | What it does | Why it works |
|---|---|---|
| A destination | Distance is a second score that only goes up, with a visible next planet growing as you approach | A journey gives the number a direction and a finish line |
| Dock and launch | Each planet is a chapter: land, refuel, decide, launch with a countdown | Chapters give structure; the fuel decision gives agency |
| Planetary relics | Choose 1 of 3 permanent perks at every planet | The roguelite "pick your upgrade" moment: the strongest hook in the genre |
| Throttle | Clicking pushes speed up to ×4; idle decays to autopilot ×1 | Active players go faster, so clicking never becomes pointless |
| Flight events | Two-choice cards with risk and reward and a 20 s timer | Stories, decisions and variance between planets |
| Planet skies | The sky blends from the planet you left to the one ahead; the origin shrinks behind you | You can see yourself travelling |
| Click juice | Flame flare, coin burst, floating number, click pitch rises with combo | Immediate multi-sensory reward for every action |
| Combo meter | Rapid clicks stack a multiplier up to ×3 (×5 upgraded) that drains if you stop | Punishes pausing; keeps hands moving |
| Critical clicks | 3% to 15% chance of ×10 / ×25, with screen shake | Variable-ratio reward, the same schedule slot machines use |
| Sweet spot | A sparkle hops around the hull; hitting it is a guaranteed crit | Turns mindless clicking into aiming |
| Golden comets | Appear at random for 13 seconds: Frenzy ×7, Click Frenzy ×77, Lucky payout, rare Jackpot | Random timed windows you don't want to miss |
| Supply pods | Float up across the stage: coins, +25 combo, ×2 rocket boost, rare gem | Moving targets you have to chase |
| Asteroids | Need 25 rapid clicks within 9 seconds, then burst with gold ore | Urgency plus a burst of effort with a big payoff |
| Space pirates | Snatch 5% of your coins and fly across the screen; catch them for 3× back | Loss aversion is stronger than reward seeking |
| Drones | Fast sine-wave flyover: cargo, click frenzy, frenzy, or rare golden drone | Harder target, bigger prize |
| Black holes | After the heliopause a gravity well grabs you: click the ship 30× in 10 seconds to slingshot out (×5 income) or lose 10% of your coins | Tension with real stakes, and a spectacular win |
| FEVER mode | Clicking fills a gauge; full gauge starts a 12 s coin rain with ×3 income and streaking stars | The pachinko "fever" peak that players chase |
| Lucky Spin | Bet 20 seconds of income on a 3-reel slot, ~54% of spins pay, ~98% expected return | Near-misses, tension reel, small wins that feel like wins |
| Next goal bar | Always shows the cheapest thing you can't afford yet, with a countdown | There is always something "almost" reachable |
| Arrival story beats | One line of story per planet, plus a landing bonus | Every threshold pays off in more than a toast |
| Trophies | 82 achievements, each +1% production forever | Collection drive plus a tangible reward per milestone |
| Prestige | Diamonds give +2% production each and make the ship faster | Long-term loop; every reset is faster than the last |
| Ending + New Game+ | Reaching Andromeda shows credits and stats; New Game+ multiplies warp ×3 | A finish line people can talk about, then a reason to keep going |
| Offline earnings | Systems keep working while away (50%, 100% with Night Shift, capped at 8h) | Returning feels rewarding |
| Daily gift | One claim per day, streak bonus up to +14% | Habit formation |
| Share card | 📸 button renders a 1200×630 image ("I reached Saturn…") and shares or downloads it | Shareable moments spread the game |

## Files

- `index.html` – page structure, including the SVG rocket
- `style.css` – theme, stage palettes, animations, responsive layout
- `game.js` – all game logic: content tables, journey, economy, arena entities, audio synthesis, particles, starfield, save/load

## Tuning

All balance lives at the top of `game.js`: `BUILDINGS`, `TIER_REQ`, `CLICK_UPG`, `SPECIALS`, `MILESTONES` (distances, colours, story lines), `MS_BOOST` (warp-lane multipliers for the long interstellar legs), `KM_PER_COIN` and `CLICK_THRUST` (how fast the ship flies per coin), `launchCost()` (fuel per leg, ×5.5 each planet), `PERKS` and `EVENTS`, and the `SYMBOLS` slot weights. The cost growth factor is `COST_GROWTH` (1.15).

Open the page with `#debug` on the URL to get a `window.CoinFever` object with `give(n)`, `addDistance(km)`, `spawnBlackhole()`, `startFever()`, `showEnding()` and more, for testing.

## Where to take it next

- Web first: itch.io, then Poki / CrazyGames, and a post on r/incremental_games.
- Steam once there is 2 to 3 hours of content: wrap with Electron or Tauri, add Steam achievements and cloud saves.
- Leaderboards ("fastest to Saturn this week") need a small backend such as Supabase or Firebase.
