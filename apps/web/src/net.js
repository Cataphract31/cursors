/* The wire — a thin WebSocket wrapper with reconnect. Import-free like every
   sibling module (the build's smoke runner executes this in node); main.js
   injects the url and the handlers and owns all game meaning. This file only
   knows how to keep a socket alive. */

export function initNet(deps) {
  const { url, onMsg, onUp, onDown } = deps;
  let ws = null, up = false, tries = 0, stopped = false;

  function connect() {
    if (stopped || typeof WebSocket === "undefined") return;
    try { ws = new WebSocket(url); } catch (e) { retry(); return; }
    ws.onopen = () => { up = true; tries = 0; onUp && onUp(); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      try { onMsg(m); } catch (err) { console.error("net onMsg failed:", m && m.t, err); }
    };
    ws.onclose = () => { const was = up; up = false; ws = null; if (was && onDown) onDown(); retry(); };
    ws.onerror = () => {};   /* close fires next; retry lives there */
  }
  function retry() {
    if (stopped) return;
    /* 2s, 4s, 8s… capped at 30s — dial-up patience, not dial-up speed */
    const wait = Math.min(30000, 2000 * Math.pow(2, Math.min(4, tries++)));
    setTimeout(connect, wait);
  }

  return {
    start: () => { stopped = false; connect(); },
    stop: () => { stopped = true; if (ws) ws.close(); },
    send: o => { if (up && ws) { try { ws.send(JSON.stringify(o)); } catch (e) {} } },
    /* A socket can be open and dead at the same time — a phone moving from wifi
       to cellular leaves one that will never deliver again, and onclose never
       fires. The caller notices the silence; this drops the corpse so the
       normal close/retry path can build a live one. */
    kick: () => { if (ws) { try { ws.close(); } catch (e) {} } },
    up: () => up,
  };
}
