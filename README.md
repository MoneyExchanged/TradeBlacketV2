# TradeBlacket server

This server runs the TradeBlacket website and is the website's side of Trade Empire's SiteWallet bridge. It needs Node 22.5 or newer and has no npm dependencies.

```
cp .env.example .env      # then paste the secret (see below)
npm test                  # 19 checks against the game protocol
npm start
```

## What it does

| Route | Who calls it | What it does |
|---|---|---|
| `POST /api/public/game/rodux-deposits` | Trade Empire game servers | Credits Rodux a player sent from the game |
| `POST /api/public/game/rodux-withdrawals` | Trade Empire game servers | Approves or refuses a "Bring back" request, and debits the player if approved |
| `POST /api/auth/start`, `/api/auth/verify`, `/api/auth/logout` | Website | Sign-in with a phrase the player puts in their Roblox About section |
| `GET /api/me` | Website | Returns the player's wallet and recent transfers |
| `GET /*` | Browsers | Serves the site from `public/` |

The two game routes follow `ReplicatedStorage.Modules.SiteWalletRules` exactly:

- **Signature.** The body is `{idempotency_key, roblox_user_id, amount}`. The `X-TE-Signature` header must be the lowercase hex HMAC-SHA256 of the raw body, keyed with `GAME_WEBHOOK_SECRET`. A bad signature gets a 401, so the game hands a deposit back.
- **Each key is applied once.** A repeated key gets the same answer it got the first time.
- **Withdrawal cap.** A withdrawal can't exceed `min(balance − bonus lock, deposited − withdrawn)`. The game enforces the same cap again on its side.
- **Responses.** A refusal returns 4xx with `{error}`, which the game shows to the player. A crash returns 5xx, and the game retries with the same key.

## Offline transfers (deposit and withdraw from the website)

When a player is **not** in Trade Empire, the website can move Rodux straight to and from their save
through Roblox Open Cloud, and show their Trade Empire balance. `gamebridge.js` explains how this stays
safe: it only writes a save no game server has open, every write is conditional on the version it
read, it keeps the game's own `siteWallet` books, and each transfer is stamped into the save so an
interrupted one is resolved by reading the save back. Players who are in the game use the in-game
TradeBlacket button as before.

It needs an Open Cloud API key in `ROBLOX_OPEN_CLOUD_KEY` with DataStore **Read Entry** and
**Update Entry** permission for the Trade Empire experience. Optional: `ROBLOX_UNIVERSE_ID`
(default 10108739296, the dev place) and `ROBLOX_DATASTORE` (default `PlayerStore_v1`).
Without a key the website falls back to in-game transfers only. `npm run test:bridge` runs it
against a fake data store.

## Limiteds, coinflips and limits

- **Limiteds wallet** (`items.js`): reads the player's Trade Empire inventory from `PlayerStore_v1` and moves chosen copies between the save and the site, with the same staged, stamped, conditional-write safety as Rodux. Item names and values come from `ItemStore_v1`. Items are refused while the player is in game, while game mail (such as a market sale) is waiting, while held (3 days), or while listed on `MarketStore_v1`.
  - The Open Cloud key needs **Read Entry** on `ItemStore_v1`, `MarketStore_v1` and `ProfileMail_v1`, on top of read/create/update on `PlayerStore_v1`.
- **Limited Flip**: player-versus-player coinflips with items. The joiner matches the creator's value within 10%. The result is `sha256(seed:joinerId:flipId)`, first byte, even = Crown, with the seed's hash shown up front. No house fee; items only change owner, so supply never changes.
- **Responsible play** (`limits.js`): screen time, reality checks, deposit caps, item caps, largest bet, loss limit, breaks and self-exclusion. Stricter changes apply now, looser ones after 24 hours. Withdrawals are never blocked. The loss limit uses the net the browser reports until games move to the server.
- **Legal**: TradeBlacket is for players aged 18 and over (Terms version `2026-10-14.2`; existing players confirm their age and re-accept, and can always withdraw). Terms of Service, License Agreement and Trade Empire Currency Deduction Service live in `public/account.js`. Acceptance is stored per user (`tos_version`, `cds_version`). Have them reviewed by a lawyer.

## Studio games (LuckyStreak)

`provider.js` connects LuckyStreak's slots and casino games to the Rodux balance as a seamless wallet. It is switched off until the `LUCKYSTREAK_*` variables are set (see `.env.example`); until then the Slots page shows TradeBlacket's own slots.

- **Wallet endpoints** LuckyStreak calls: `POST /api/provider/luckystreak/{balance,debit,credit,rollback}`. Each call must carry a valid Hawk header (shared id and key, 60-second clock window, single-use nonce, signed body). Optional IP allowlist: `LUCKYSTREAK_ALLOW_IPS`.
- **Exactly once:** every transaction id is applied once and repeats get the first answer. A refund undoes a bet once; a refund that arrives before its bet blocks that bet. Wins can't be rolled back.
- **Limits:** bets go through the Terms check, breaks, self-exclusion, the largest-bet limit and the daily loss limit (counted on the server for studio games).
- **Withdrawals** stay capped at what a player deposited, whatever studio games pay out.
- **Lobby and launch:** `GET /api/games` lists games (cached 10 minutes); `POST /api/games/launch` creates a single-use player session and asks LuckyStreak for the game link, which opens full screen.
- **When LuckyStreak's API document arrives:** match their field names in `FIELDS` and the answer shape in `reply()` in `provider.js`, and set the launch and games paths. Then give LuckyStreak the wallet URL `https://<your domain>/api/provider/luckystreak/` and run `npm run test:provider`.

## Site waitlist

The whole site is invite-only while `SITE_WAITLIST` is on (the default). Players sign in with Roblox first, then see a waitlist screen instead of the site: they join, keep the place they joined in (#1 is first in), and get in when an admin lets the next players in or with a site access code. The server enforces this too: deposits, games, cases, selling and listing are refused for players without access. Withdrawals always work, so nobody's Rodux or items are ever stuck. Admins always have access and get an Admin page (Account → Admin) with Site and Slots tabs. Site codes and Slots codes are separate. Set `SITE_WAITLIST=off` to open the site to everyone.

## Slots waitlist

Slots are closed for now (`waitlist.js`). Players join a waitlist and keep the place they joined in; the first to join is #1. They get in when an admin lets the next players in, or straight away with an access code (`TB-XXXXX-XXXXX`). Admins are the Roblox accounts in `ADMIN_ROBLOX_IDS` (default: the owner, 496295513); an admin sees an Admin section on the Slots page to make codes, let players in and remove access. Studio games can only be launched by players with access.

## Limiteds market, selling, profiles, support

- **Limiteds market** (`items.js`): players list real Trade Empire copies they hold on the site for Rodux. Buying moves that exact copy to the buyer's Limiteds, where it can be withdrawn to their save. The seller's Rodux counts as deposited, so it can be withdrawn; the buyer's spent Rodux stops counting.
- **Sell to TradeBlacket**: 90% of the item's Trade Empire value, paid as withdrawable Rodux. TradeBlacket lists the copy at full value. Nothing is ever created or destroyed.
- **TradePlus** (`social.js`): read from the save (`Data.subscription = { tier, expiration }`); any active tier unlocks profile themes (banner, accents, effect, name style). Admins count as Diamond.
- **Wallet ID**: `TBW-XXXX-XXXX`, derived from the Roblox id with the server secret. Safe to share; used by support.
- **Support**: tickets with replies; admins see all tickets and answer as TradeBlacket Support.
- **Pictures**: `/img/asset/<id>` (item icons) and `/img/avatar/<userId>` (Roblox headshots) redirect to Roblox's current image, cached six hours.

## Going live

1. **Host it over https.** Roblox only calls https addresses. Any Node host works (Railway, Fly.io, Render, a VPS behind Caddy). Keep `tradeblacket.db` on a persistent disk and back it up.
2. **Set the secret.** In `.env`, set `GAME_WEBHOOK_SECRET` to the `SECRET` already in `ServerStorage.SiteWalletConfig` in Studio. Never put it anywhere a player can reach it.
3. **Point the game at the server.** In `ServerStorage.SiteWalletConfig`, replace `YOUR-SITE` in both URLs with your domain. Until you do, the game's transport refuses to send.
4. **Switch the bridge on.** In `ServerScriptService.Players.SiteWallet`, set `ENABLED = true`, then `WITHDRAWALS_ENABLED = true`. These are the only game edits needed.
5. **Allow HTTP requests.** In Game Settings → Security, turn on Allow HTTP Requests.
6. **Change the place id.** Set `TE.place` at the top of `public/wallet.js` to the live game's place id, so the website's "Open Trade Empire" button goes to it.

## Before real players use it

Game results are still decided in the browser, and the site's play balance lives in the browser too. The server already holds the authoritative wallet: what each player sent in and took back. But a player could edit their browser balance, and withdrawals are only checked against the server's numbers. Before launch, the bets need to be settled on the server:

- Move each game's outcome to a server route.
- Store `balance` changes in the `users` table.
- Have the client only display the result.

Until that's done, keep the bridge switched off in the live game.
