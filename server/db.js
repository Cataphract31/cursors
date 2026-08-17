/* Persistence — node:sqlite (built into Node 22.5+, same as THIN ICE's box).
   One file, synchronous API, single writer. Play money: this DB will be wiped
   before any real-money launch. */

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export function openDb(path) {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS players (
      token     TEXT PRIMARY KEY,
      name      TEXT NOT NULL,
      totIn     REAL NOT NULL DEFAULT 0,
      published INTEGER NOT NULL DEFAULT 0,
      totOut    REAL NOT NULL DEFAULT 0,
      created   INTEGER NOT NULL,
      lastSeen  INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS guestbook (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      who  TEXT NOT NULL,
      at   INTEGER NOT NULL,
      txt  TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS gallery (
      id   INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      by   TEXT NOT NULL,
      at   INTEGER NOT NULL,
      png  TEXT NOT NULL
    );
    /* Chat outlived the process only in RAM, so every deploy of this server
       wiped the lobby and DMs were never stored at all — a conversation you
       could not scroll back to is not a conversation. Both live here now. */
    CREATE TABLE IF NOT EXISTS chat (
      id  INTEGER PRIMARY KEY AUTOINCREMENT,
      who TEXT NOT NULL,
      txt TEXT NOT NULL,
      at  INTEGER NOT NULL
    );
    /* Keyed by TOKEN, not name: a name is a display string that can be
       reassigned, and a DM history that follows the name would hand your
       old conversations to whoever takes the name next. Names are carried
       alongside only so a deleted account still renders. */
    CREATE TABLE IF NOT EXISTS dms (
      id       INTEGER PRIMARY KEY AUTOINCREMENT,
      fromTok  TEXT NOT NULL,
      toTok    TEXT NOT NULL,
      fromName TEXT NOT NULL,
      toName   TEXT NOT NULL,
      txt      TEXT NOT NULL,
      at       INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS dms_to   ON dms (toTok, id);
    CREATE INDEX IF NOT EXISTS dms_from ON dms (fromTok, id);
    CREATE TABLE IF NOT EXISTS epochs (
      no      INTEGER PRIMARY KEY,
      endedAt INTEGER NOT NULL,
      up      INTEGER NOT NULL,
      pot     REAL NOT NULL,
      deploys INTEGER NOT NULL,
      deaths  INTEGER NOT NULL,
      seed    TEXT NOT NULL,
      commitv TEXT NOT NULL,
      top     TEXT
    );
  `);

  /* Migrations. CREATE TABLE IF NOT EXISTS only ever builds a FRESH database —
     it silently does nothing to one that already exists, so adding a column to
     the schema above and shipping it takes the live server down with "table
     players has no column named X" (it did, once). Every future column goes in
     this list instead, and the pragma makes it idempotent. */
  const addColumn = (table, col, decl) => {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all().map(c => c.name);
    if (!cols.includes(col)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  };
  addColumn("players", "published", "INTEGER NOT NULL DEFAULT 0");

  /*
   * THE BALANCE COLUMN GOES, AND IT HAS TO GO RATHER THAN JUST STOP BEING USED.
   *
   * Money lives in the arcade's double-entry ledger now (see ledger.js). Left
   * in the file it would be a second answer to "what does this player own",
   * stale from the first deploy and readable by anyone who writes the obvious
   * query -- and it was a REAL, a float, which cannot hold money exactly in the
   * first place. Two sources of truth is the disease being cured; a disused one
   * is worse than an active one because nothing keeps it honest.
   *
   * Existing files are playtest data with no real money behind them, so the
   * column is dropped rather than reconciled.
   */
  const cols = db.prepare("PRAGMA table_info(players)").all();
  if (cols.some(c => c.name === "balance")) db.exec("ALTER TABLE players DROP COLUMN balance");

  const q = {
    getPlayer: db.prepare("SELECT * FROM players WHERE token = ?"),
    upsertPlayer: db.prepare(`
      INSERT INTO players (token,name,totIn,totOut,published,created,lastSeen)
      VALUES (?,?,?,?,?,?,?)
      ON CONFLICT(token) DO UPDATE SET
        name=excluded.name,
        totIn=excluded.totIn, totOut=excluded.totOut, published=excluded.published,
        lastSeen=excluded.lastSeen`),
    nameTaken: db.prepare("SELECT token FROM players WHERE lower(name) = lower(?) AND token <> ?"),
    guestList: db.prepare("SELECT who, at, txt FROM guestbook ORDER BY id DESC LIMIT 40"),
    guestPost: db.prepare("INSERT INTO guestbook (who, at, txt) VALUES (?,?,?)"),
    guestCount: db.prepare("SELECT COUNT(*) AS n FROM guestbook"),
    galleryList: db.prepare("SELECT id, name, by, at, png FROM gallery ORDER BY id DESC LIMIT 16"),
    galleryPost: db.prepare("INSERT INTO gallery (name, by, at, png) VALUES (?,?,?,?)"),
    galleryTrim: db.prepare("DELETE FROM gallery WHERE id NOT IN (SELECT id FROM gallery ORDER BY id DESC LIMIT 24)"),
    galleryLast: db.prepare("SELECT * FROM gallery ORDER BY id DESC LIMIT 1"),
    guestTrim: db.prepare("DELETE FROM guestbook WHERE rowid NOT IN (SELECT rowid FROM guestbook ORDER BY rowid DESC LIMIT 200)"),
    epochAdd: db.prepare("INSERT OR REPLACE INTO epochs (no,endedAt,up,pot,deploys,deaths,seed,commitv,top) VALUES (?,?,?,?,?,?,?,?,?)"),
    chatList: db.prepare("SELECT who, txt, at FROM chat ORDER BY id DESC LIMIT 60"),
    chatPost: db.prepare("INSERT INTO chat (who, txt, at) VALUES (?,?,?)"),
    chatTrim: db.prepare("DELETE FROM chat WHERE id NOT IN (SELECT id FROM chat ORDER BY id DESC LIMIT 300)"),
    dmPost: db.prepare("INSERT INTO dms (fromTok,toTok,fromName,toName,txt,at) VALUES (?,?,?,?,?,?)"),
    dmTrim: db.prepare("DELETE FROM dms WHERE id NOT IN (SELECT id FROM dms ORDER BY id DESC LIMIT 4000)"),
    /* the CURRENT name of each side, falling back to the one stored with the
       message, so a rename moves the whole history with the person */
    dmFor: db.prepare(`
      SELECT d.fromTok, d.toTok, d.txt, d.at,
             COALESCE(pf.name, d.fromName) AS fromName,
             COALESCE(pt.name, d.toName)   AS toName
      FROM dms d
      LEFT JOIN players pf ON pf.token = d.fromTok
      LEFT JOIN players pt ON pt.token = d.toTok
      WHERE d.fromTok = ? OR d.toTok = ?
      ORDER BY d.id DESC LIMIT 120`),
    tokenForName: db.prepare("SELECT token FROM players WHERE lower(name) = lower(?)"),
  };

  /* the canonical first six entries, so a fresh server's guestbook is not empty */
  if (q.guestCount.get().n === 0) {
    const seedEntries = [
      ["mumu", "first!!! also i am up 4.2 SOL all time (this account)"],
      ["bobo", "cool site. how do i get my cursor back"],
      ["xp_chad", "banked at x2 six times in a row. i have solved it."],
      ["clippy", "It looks like you're chasing a loss. Would you like help with that?"],
      ["deg404", "the rng is crackable. email me. do not email the webmaster."],
      ["solja", "webmaster please add music i have a midi"],
    ];
    const t0 = Date.parse("2003-08-14T12:00:00Z");
    seedEntries.forEach(([who, txt], i) => q.guestPost.run(who, t0 + i * 11 * 24 * 3600 * 1000, txt));
  }

  return {
    loadPlayer: token => q.getPlayer.get(token) || null,
    savePlayer: p => q.upsertPlayer.run(
      p.token, p.name,
      p.totIn, p.totOut, p.published || 0, p.created || Date.now(), Date.now()),
    nameTaken: (name, token) => !!q.nameTaken.get(name, token),
    guestList: () => q.guestList.all(),
    guestPost: (who, txt) => { q.guestPost.run(who, Date.now(), txt); q.guestTrim.run(); },
    galleryList: () => q.galleryList.all(),
    galleryLatest: () => q.galleryLast.get(),
    galleryPost: (name, by, png) => { q.galleryPost.run(name, by, Date.now(), png); q.galleryTrim.run(); },
    epochAdd: r => q.epochAdd.run(r.no, Date.now(), r.up, r.pot, r.deploys, r.deaths, r.seed, r.commit, JSON.stringify(r.top || null)),
    chatList: () => q.chatList.all().reverse(),
    chatPost: (who, txt) => { q.chatPost.run(who, txt, Date.now()); q.chatTrim.run(); },
    dmPost: d => { q.dmPost.run(d.fromTok, d.toTok, d.fromName, d.toName, d.txt, Date.now()); q.dmTrim.run(); },
    /* two plain placeholders, bound twice: node:sqlite counts ?1 used twice
       as two parameters and throws "column index out of range" on one arg */
    dmFor: tok => q.dmFor.all(tok, tok).reverse(),
    tokenForName: name => q.tokenForName.get(name)?.token || null,
    tx: fn => { db.exec("BEGIN"); try { fn(); db.exec("COMMIT"); } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; } },
    close: () => db.close(),
  };
}
