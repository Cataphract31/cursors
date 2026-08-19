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
    ws.onerror = () => {};
  }
  function retry() {
    if (stopped) return;
    const wait = Math.min(30000, 2000 * Math.pow(2, Math.min(4, tries++)));
    setTimeout(connect, wait);
  }

  return {
    start: () => { stopped = false; connect(); },
    stop: () => { stopped = true; if (ws) ws.close(); },
    send: o => { if (up && ws) { try { ws.send(JSON.stringify(o)); } catch (e) {} } },
    kick: () => { if (ws) { try { ws.close(); } catch (e) {} } },
    poke: () => { if (!up && !stopped && !connecting) { tries = 0; connect(); } },
    up: () => up,
  };
}
