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

## Support and account standing

`account.js` and the support part of `social.js`.

- **tradeblacket.com/support** is a help desk. A new ticket carries the player's whole account: the public Roblox profile (name, account age, verified, banned on Roblox), the Trade Empire save (Rodux, value, RAP, items, trades, play time, TradePlus) with the game's Account Standing worked out from `Data.violations` using the same rules as `AccountStandingRules`, and the TradeBlacket record (balance, transfers, bans, staff actions). Staff also see linked accounts (same network, device or hardware).
- Roblox does not let other sites read a player's Roblox moderation history, so warnings come from the Trade Empire save and from TradeBlacket's own record. The save is only read, never written.
- Screenshots: PNG, JPEG, GIF or WebP, checked by their first bytes, 5 MB each, 4 per message, 40 a day. They are stored in `uploads/` next to the database (on the volume) and served only to the sender, the ticket's owner and staff. Unused uploads are deleted after a day.
- Categories include appeals and player reports. Staff can reply, write internal notes (hidden from the player), refresh the account in the ticket, close and reopen.
- Staff actions (from a ticket or Admin, then Players): warn, suspend for 1 to 90 days, kick (sign out everywhere), ban, terminate, unban, let in, remove access, note. The player sees every action except notes, in the ticket and on their standing. Banned, suspended and terminated players can still sign in to withdraw and to use Support.
- **tradeblacket.com/tradeempire** shows the player their own Trade Empire account: standing bar and violation history, value over time, stats and their most valuable limiteds.

## TradeBlacket Business

`business.js`, at **tradeblacket.com/business**: a separate black-and-gold space for content creators.

1. Sign in with Roblox (bio verification, the same account as the site).
2. Join the registry: creator name, channel links, audience, Discord, a description. Moderators approve or decline in Admin, then Business. Approval gives the gold **Business** role (profile, chat, the top bar), site access, direct support, the feature request board and YouTube verification (a phrase in the channel description, checked from the server; staff can also verify by hand).
3. Apply for **TEPP** (Trade Empire Partner Program). Approval makes them a **Partner**.
4. Partners create their **Business Card** (name, tagline, finish, links; card number `TBB XXXX XXXX XXXX`).

Staff pay a card in US dollars or Rodux and hand partners giveaway gift cards. A partner withdraws card money as Rodux on TradeBlacket (withdrawable to Trade Empire like deposited Rodux; dollars convert at the gift card rate) or as limiteds TradeBlacket owns (house listings move to the partner's Limiteds, nothing is created). Every step, payout and withdrawal is in the player log.

While an application waits, the portal shows its **status**: place in the queue, an estimated wait (the median time moderators took on the last 25 decisions at that stage, 2 days with no history, plus 4 hours per application ahead) and the date a decision is expected. It refreshes by itself.

**Paying with the card.** Partners can **top up** the card from their TradeBlacket balance (withdrawable Rodux only; bonus Rodux stays). In Payment settings (in the portal, and on the main Settings page) they pick what pays withdrawals to Trade Empire and marketplace purchases: their **TradeBlacket balance** or their **Business Card**. Card payments are confirmed with **nothing**, a **4 to 6 digit code** (scrypt hashed; 5 wrong codes pause card payments for 15 minutes) or **this device** (a WebAuthn passkey: Windows Hello, Touch ID, Face ID or the phone's screen lock; the server checks the signature against the stored public key, no extra packages). Changing the method needs the current one. A card payment moves the exact amount from the card to the balance (`card-pay` in the ledger, card Rodux first, then dollars) and the withdrawal or purchase follows. Rodux that leaves the site for Trade Empire is still capped by the game's own rule: no more than the player's net site deposits.

**Monthly Wage of TradeBlacket.** Staff with the `biz.wage` permission (Head Admin, HR, Owner, Partner Manager, Finance) set a partner's monthly wage in US dollar value or Rodux (Admin, then Business, the Monthly wage column; 0 ends it). The server pays due wages every hour onto the Business Card (ledger kind `wage`) and moves the date on by a calendar month. A wage is only paid while the partner has signed the current Business and Partner Program Agreement, which also holds the promise not to give the whole wage away. Partners see the amount, next date and who set it on their Overview.

## Staff ranks and the staff panel

`staff.js`, shown at **tradeblacket.com/admin**. Ranks, lowest first: Trial Moderator, Moderator, Senior Moderator, Admin, Head Admin, HR, Owner. Side roles add permissions on their own or on top of a rank: Support Agent, Partner Manager, Finance, Developer, Trust & Safety. Owners are `ADMIN_ROBLOX_IDS`.

| Rank | Adds |
|---|---|
| Trial Moderator | read tickets, look up players, see bans, warn, staff notes |
| Moderator | kick, suspend, Business member decisions, feature requests |
| Senior Moderator | ban, give or take site access, waitlists and codes, verify YouTube |
| Admin | **answer and assign tickets**, lift bans, gift cards, Partner decisions, audit log |
| Head Admin | terminate, pay cards, set wages, site settings, signed agreements |
| HR / Owner | everything, including hiring and the permission matrix |

HR can switch single permissions per rank or role (Permissions page; HR and Owner stay locked). Nobody acts on an account at or above their own rank or hands out a rank at or above their own. Every `/api/admin/*` call goes through one gate in `server.js` that checks the permission, and every staff action that succeeds is written to `staff_audit`. The panel has a dashboard, a ticket queue with assignment, players, bans, Business, gift cards, site access, the team, permissions, the audit log and signed agreements. Profiles show the staff rank.

## Provably fair numbers

`fair.js`. Each player has a server seed (only its SHA-256 is shown, plus the hash of the next one), a client seed and a nonce. Each nonce gives 64 numbers: `HMAC_SHA256(serverSeed, clientSeed:nonce:cursor)` for cursor 0–7, 4 bytes per number. The browser fetches batches (`POST /api/fair/batch`) and `rnd()` in `core.js` takes game numbers from them; background animation and the made-up bots run inside `deco()` and use the browser's own randomness. Client seed automation: rotate after N nonces (default 1,000), daily, or off, with a fresh random client seed at every rotation unless the player keeps their own. Rotating reveals the server seed; Docs, Provably fair shows the seeds, the rounds this browser used and checks them, and Docs, Verify recomputes numbers in the browser. `GET /api/fair/verify` is public. Note: game balances are still kept in the browser, so this proves the numbers were committed in advance, not that the browser played them honestly.

## Legal documents and e-signatures

`public/legaldocs.js` is the one source for the site and the server: Terms of Service, License Agreement, Privacy Policy, Cookie Policy, Community Rules, Responsible Play Policy, Gift Card Terms, Trade Empire Currency Deduction Service, and the Business and Partner Program Agreement. Drafts: have them reviewed by a lawyer.

`legal.js` stores signatures. Players sign packs: the site pack (the first seven, before playing; sets `tos_version`), the deduction service (before the first deposit; sets `cds_version`) and the Business agreement (before a card and wages). The signing sheet makes the player scroll through every document, type their name and draw a signature on a scribble pad (mouse, trackpad, pen or finger). Each signature row keeps the document version, SHA-256 of the exact signed text, the name, the PNG and its hash, stroke count and ink length, hashed network and device labels, the user agent and the time. Players see and download signed copies in Settings; staff with `legal.view` search them in the panel. A checkbox alone no longer accepts anything. Changing a document's text or version makes everyone sign again. A cookie notice explains that only necessary cookies are used. Security hashes older than 12 months are deleted, as the Privacy Policy says.

The Docs centre is at **tradeblacket.com/docs** (also /terms, /privacy, /cookies, /fair) and can be read without signing in.

## Gift cards and money display

`giftcards.js`. Admins (Admin, then Gift cards) make $5, $10, $100 or $500 cards (`TBG-XXXX-XXXX-XXXX`, single use, optional expiry and a note for the creator or giveaway) and hand them to content creators. Players cannot buy them; they redeem a code on the Gift card page.

A card pays its dollar value in Rodux at the moment it is redeemed: the game's Rodux developer products are read from Roblox every 6 hours (base price, before the Premium discount), the median Rodux per Robux is taken, and multiplied by `ROBUX_PER_USD` (default 80, from 400 Robux for $4.99). On 15 October 2026 that is 143.27 Rodux per Robux, so 11,461 Rodux per dollar. By default card Rodux is bonus Rodux (plays on the site, cannot be withdrawn); an admin can make a card withdrawable.

Every Rodux amount on the site shows its US dollar and Robux value on hover, and players choose what the top-bar balance shows: Rodux, US dollars, Robux or the value of their limiteds (Settings, or the balance popover). `GET /api/rates` returns the current rate.

## Player lookup for staff

`playerlog.js`, shown in Admin, then Players. Staff search by Roblox name, Roblox id, wallet ID, ticket id or referral code (an empty search lists recently active players). A player's page has the account, totals and a log of everything they did:

- Rodux deposits and withdrawals with how they were made (website wallet or the old in-game bridge), status, reference and reason when refused
- Limited deposits, withdrawals, purchases, sales to TradeBlacket and to players, listings, with the exact copies (item, serial, value)
- Limited Flips (stake, opponent, result), studio game rounds, daily play time and net
- Sign-ins with network and device labels, the accounts that share them, waitlist steps and access codes, referrals, Terms accepted, profile and limit changes, tickets, staff actions and bans
- The Trade Empire save's own ledger (sales, earnings, purchases, transfers), lifetime totals and moderation record

What no table kept (sign-ins, sign-outs, listings, profile and limit changes, Terms) is written to the `activity` table from now on. Staff can export the whole log as CSV.

## One account per player

`security.js`. Every sign-in records one-way HMAC hashes (keyed with the server secret) of the network address (IPv6 by /64), a device id the browser keeps (cookie `tb_dev` and localStorage) and a hash of the device's hardware and browser traits, sent in the `X-TB-Device` header. Raw addresses and traits are never stored.

- Sign-in attempts are rate limited per network (8 starts and 20 verifies per 10 minutes); access-code guesses too (10 per 10 minutes).
- A new account that signs up from a network used by another account in the last 30 days, or from a device or hardware another account uses, is banned on the spot.
- Two existing accounts seen on one device: the newer one is banned.
- Admins are never banned. Admin → Bans lists bans with the account each one is linked to, and admins can ban by name or id and unban.
- A banned account can sign in and withdraw its own Rodux and limiteds, and nothing else.

The client address comes from `X-Real-IP`, which Railway's edge sets and a visitor cannot override, else the first `X-Forwarded-For` entry. Admins can check what the server sees at `GET /api/admin/netcheck`.

## Refer a friend

`referrals.js`. Every player has a code and link (`/?ref=CODE`). A friend who signs up with it is linked to them; the referrer gets `REFERRAL_REWARD` (default 450) Rodux once the friend has site access and has accepted the Terms, and neither is banned. Nothing is paid for a friend on the referrer's network, device or hardware. The reward is bonus Rodux (`bonus_lock`): it plays on the site but cannot be withdrawn, so referrals never create Rodux in Trade Empire.

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
