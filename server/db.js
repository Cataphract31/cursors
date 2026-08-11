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
      balance   REAL NOT NULL,
      tickets   REAL NOT NULL DEFAULT 0,
      ticketsAt INTEGER NOT NULL DEFAULT 0,
      rake      REAL NOT NULL DEFAULT 0,
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

  const q = {
    getPlayer: db.prepare("SELECT * FROM players WHERE token = ?"),
    upsertPlayer: db.prepare(`
      INSERT INTO players (token,name,balance,tickets,ticketsAt,rake,totIn,totOut,published,created,lastSeen)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)
      ON CONFLICT(token) DO UPDATE SET
        name=excluded.name, balance=excluded.balance, tickets=excluded.tickets,
        ticketsAt=excluded.ticketsAt, rake=excluded.rake,
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
      p.token, p.name, p.balance, p.tickets, p.ticketsAt, p.rake,
      p.totIn, p.totOut, p.published || 0, p.created || Date.now(), Date.now()),
    nameTaken: (name, token) => !!q.nameTaken.get(name, token),
    guestList: () => q.guestList.all(),
    guestPost: (who, txt) => { q.guestPost.run(who, Date.now(), txt); q.guestTrim.run(); },
    galleryList: () => q.galleryList.all(),
    galleryLatest: () => q.galleryLast.get(),
    galleryPost: (name, by, png) => { q.galleryPost.run(name, by, Date.now(), png); q.galleryTrim.run(); },
    epochAdd: r => q.epochAdd.run(r.no, Date.now(), r.up, r.pot, r.deploys, r.deaths, r.seed, r.commit, JSON.stringify(r.top || null)),
    tx: fn => { db.exec("BEGIN"); try { fn(); db.exec("COMMIT"); } catch (e) { try { db.exec("ROLLBACK"); } catch {} throw e; } },
    close: () => db.close(),
  };
}
