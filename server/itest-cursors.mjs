import { generateKeyPairSync, sign } from "node:crypto";
import WebSocket from "ws";

const ARCADE = "http://127.0.0.1:8080", KEY = "ctest2";
const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const b58 = (b) => { let n = BigInt("0x" + Buffer.from(b).toString("hex")), s = "";
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const x of b) { if (x === 0) s = "1" + s; else break; } return s; };
const post = (p, b, h = {}) => fetch(ARCADE + p, { method: "POST",
  headers: { "content-type": "application/json", ...h }, body: JSON.stringify(b) }).then(r => r.json());
const bal = (w) => fetch(`${ARCADE}/api/ledger/balance?wallet=${w}`, { headers: { "x-ledger-key": KEY } }).then(r => r.json());
const audit = () => fetch(`${ARCADE}/api/ledger/audit`, { headers: { "x-ledger-key": KEY } }).then(r => r.json());

const { publicKey, privateKey } = generateKeyPairSync("ed25519");
const wallet = b58(publicKey.export({ type: "spki", format: "der" }).subarray(-32));
const ch = await post("/api/auth/challenge", { wallet });
const v = await post("/api/auth/verify", { wallet, nonce: ch.nonce,
  signature: Buffer.from(sign(null, Buffer.from(ch.statement, "utf8"), privateKey)).toString("base64") });
if (!v.token) throw new Error("sign-in failed: " + JSON.stringify(v));
await post("/api/ledger/credit", { wallet, amount: 100_000_000, ref: `cur-fund-${wallet.slice(0,8)}`, kind: "deposit" }, { "x-ledger-key": KEY });
console.log("wallet:", wallet.slice(0, 12) + "...  funded:", JSON.stringify(await bal(wallet)));

const ws = new WebSocket("ws://127.0.0.1:8798");
const errs = [];
let welcomed = null, held = null;
ws.on("open", () => ws.send(JSON.stringify({ t: "hello", name: "probe" })));
ws.on("message", async (raw) => {
  const m = JSON.parse(String(raw));
  if (m.t === "err") errs.push(m.msg);
  if (m.t === "welcome") {
    if (!m.wallet) { welcomed = m; ws.send(JSON.stringify({ t: "arcade", token: v.token })); return; }
    console.log("signed in as wallet, name:", m.name, " balance:", m.balance);

    const show = async (label) => console.log(`  ${label}`, JSON.stringify(await bal(wallet)));

    ws.send(JSON.stringify({ t: "deploy" }));
    setTimeout(() => ws.send(JSON.stringify({ t: "recall" })), 500);
    setTimeout(async () => {
      await show("a) deployed then recalled in grace:");

      ws.send(JSON.stringify({ t: "deploy" }));
      setTimeout(async () => { await show("b) deployed, hold open           :"); }, 800);
      setTimeout(() => ws.send(JSON.stringify({ t: "recall" })), 2000);
      setTimeout(async () => { await show("c) after the bank glide settled  :"); }, 7000);
    }, 2500);
  }
});
setTimeout(async () => {
  console.log("errors:", errs.length ? errs : "none");
  console.log("while deployed:", JSON.stringify(held));
  console.log("after:", JSON.stringify(await bal(wallet)));
  console.log("audit:", JSON.stringify(await audit()));
  ws.close(); process.exit(0);
}, 16000);
