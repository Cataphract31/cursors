/* Chat and DM persistence, end to end over real sockets against a real server.

   This is the only test in the suite that boots server.js, and it earns that:
   the thing it guards is not a rule inside the sim but a promise across a
   PROCESS BOUNDARY — "what was said is still there tomorrow". Every cheaper way
   of testing it (calling db methods directly, or a sim rig) passes happily
   while the server hands clients an empty room, which is exactly what it did.

   The server is restarted mid-test on purpose. Chat used to live only in a RAM
   ring buffer, so every deploy of the beta wiped the lobby, and DMs were never
   written down at all. */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const PORT = 8800 + Math.floor(Math.random() * 400);
const DB = join(tmpdir(), `cursors-chat-test-${PORT}-${process.pid}.db`);
const wipe = () => { for (const s of ["", "-wal", "-shm"]) { try { rmSync(DB + s); } catch {} } };

function boot() {
  return new Promise((res, rej) => {
    const p = spawn(process.execPath, ["server.js"], {
      cwd: new URL("..", import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, "$1"),
      env: { ...process.env, PORT: String(PORT), DB_PATH: DB, FAST: "1" },
      stdio: ["ignore", "pipe", "pipe"],
    });
    let out = "";
    p.stdout.on("data", d => { out += d; if (out.includes("beta server on")) res(p); });
    /*
     * Node's own noise, and one warning of ours, are not failures.
     *
     * This test boots a real server to prove chat survives a restart, and it
     * boots it WITHOUT a ledger key -- correctly, since it never deploys. The
     * server says so on stderr, loudly and on purpose: a box that cannot take a
     * stake should not be quiet about it. That is the right behaviour and the
     * wrong thing to fail a chat test over.
     */
    p.stderr.on("data", d => {
      const t = String(d);
      if (!/Experimental|trace-warnings|NO LEDGER_KEY/.test(t)) rej(new Error(t));
    });
    setTimeout(() => rej(new Error("server did not boot in 10s")), 10000);
  });
}
function client(name, token) {
  const ws = new WebSocket(`ws://127.0.0.1:${PORT}`);
  const got = [];
  const ready = new Promise((res, rej) => {
    ws.addEventListener("message", ev => { const m = JSON.parse(ev.data); got.push(m); if (m.t === "welcome") res(m); });
    ws.addEventListener("error", rej);
    setTimeout(() => rej(new Error(`${name} never got a welcome`)), 10000);
  });
  ws.addEventListener("open", () => ws.send(JSON.stringify({ t: "hello", name, token })));
  return { got, ready, send: m => ws.send(JSON.stringify(m)), close: () => ws.close() };
}
const wait = ms => new Promise(r => setTimeout(r, ms));
const TOK = ch => ch.repeat(32);

test("what was said survives the client leaving AND the server restarting", async t => {
  wipe();
  let srv = await boot();
  t.after(() => { try { srv.kill(); } catch {} wipe(); });

  /* --- a session: two players, the lobby, and a DM each way --- */
  const a = client("alpha", TOK("a")), b = client("bravo", TOK("b"));
  const wa = await a.ready, wb = await b.ready;

  a.send({ t: "chat", text: "lobby line from alpha" }); await wait(150);
  b.send({ t: "chat", text: "lobby line from bravo" }); await wait(150);
  a.send({ t: "dm", to: wb.name, text: "dm one" }); await wait(150);
  b.send({ t: "dm", to: wa.name, text: "dm two" }); await wait(350);

  assert.ok(b.got.some(m => m.t === "dm" && m.text === "dm one"), "live DM never reached bravo");
  assert.ok(a.got.some(m => m.t === "dm" && m.text === "dm two"), "live DM never reached alpha");

  /* --- bravo leaves, alpha writes to the empty chair --- */
  b.close(); await wait(300);
  a.send({ t: "dm", to: wb.name, text: "dm three" }); await wait(350);
  const failed = a.got.filter(m => m.t === "dmFail").pop();
  assert.ok(failed, "no answer at all when messaging someone offline");
  assert.equal(failed.kept, true, "an offline DM was dropped instead of kept");

  a.close(); await wait(300);

  /* --- the process boundary --- */
  srv.kill(); await wait(700);
  srv = await boot();

  /* Drown the room in its own announcements BEFORE anyone reconnects to read
     it: the epoch crashes on a timer and every arrival prints a line, so a
     buffer holding both loses the conversation within a few minutes of a busy
     lobby. Distinct tokens — reusing alpha's would just take over her session. */
  for (let i = 0; i < 40; i++) {
    const noise = client("noise" + i, i.toString(16).padStart(32, "0"));
    await noise.ready; noise.close();
  }
  await wait(400);

  const a2 = client("alpha", TOK("a")), b2 = client("bravo", TOK("b"));
  const wa2 = await a2.ready, wb2 = await b2.ready;
  t.after(() => { a2.close(); b2.close(); });

  const lobby = (wa2.chat || []).map(e => e.text);
  assert.ok(lobby.includes("lobby line from alpha"), "the lobby was empty after a restart");
  assert.ok(lobby.includes("lobby line from bravo"), "the lobby lost a line across a restart");
  /* history is what players said, not the server's own door noise */
  assert.ok(!lobby.some(x => /signed in/.test(x)), "sign-in lines were replayed as history");

  const mine = (wa2.dms || []).map(d => d.text);
  const theirs = (wb2.dms || []).map(d => d.text);
  assert.ok(mine.includes("dm one") && mine.includes("dm two"), "alpha lost her side of the conversation");
  assert.ok(theirs.includes("dm one"), "bravo lost a message he had already read");
  assert.ok(theirs.includes("dm three"), "the message sent while bravo was away never arrived");

  /* direction has to survive too, or the replay puts your words in their mouth */
  assert.equal((wa2.dms || []).find(d => d.text === "dm one").mine, true);
  assert.equal((wb2.dms || []).find(d => d.text === "dm one").mine, false);
  /* and every line files under the other person, whichever way it went */
  assert.ok((wa2.dms || []).every(d => d.who === wb2.name), "a DM filed under the wrong conversation");

  /* --- and none of it leaks --- */
  const c = client("charlie", TOK("c"));
  const wc = await c.ready;
  t.after(() => c.close());
  assert.equal((wc.dms || []).length, 0, "a stranger was handed somebody else's DMs");
  assert.ok((wc.chat || []).map(e => e.text).includes("lobby line from alpha"), "the lobby is public and should be visible");
});
