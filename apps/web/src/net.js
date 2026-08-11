/* The wire — a thin WebSocket wrapper with reconnect. Import-free like every
   sibling module (the build's smoke runner executes this in node); main.js
   injects the url and the handlers and owns all game meaning. This file only
   knows how to keep a socket alive. */

export function initNet(deps) {
  const { url, onMsg, onUp, onDown } = deps;
  let ws = null, up = false, tries = 0, stopped = false, connecting = false;

  function connect() {
    if (stopped || connecting || typeof WebSocket === "undefined") return;
    connecting = true;
    try { ws = new WebSocket(url); } catch (e) { connecting = false; retry(); return; }
    ws.onopen = () => { connecting = false; up = true; tries = 0; onUp && onUp(); };
    ws.onmessage = e => {
      let m; try { m = JSON.parse(e.data); } catch (err) { return; }
      try { onMsg(m); } catch (err) { console.error("net onMsg failed:", m && m.t, err); }
    };
    ws.onclose = () => { connecting = false; const was = up; up = false; ws = null; if (was && onDown) onDown(); retry(); };
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
    /* Backoff reaches 30s, so a phone that was in a tunnel could sit in the
       sandbox for half a minute after signal came back. Coming to the
       foreground, or the network returning, is new information — try now. */
    poke: () => { if (!up && !stopped && !connecting) { tries = 0; connect(); } },
    up: () => up,
  };
}
