export function initSavers(deps) {
  const { store, IMG, hooks } = deps;

  const cfg = () => (store.data.saverCfg = store.data.saverCfg || {});
  const cfgOf = id => (cfg()[id] = cfg()[id] || {});

  const LIST = [
    { id: "flowerbox", label: "3D FlowerBox", gl: 1 },
    { id: "flying", label: "3D Flying Objects", gl: 1 },
    { id: "pipes", label: "3D Pipes", gl: 1, settings: 1 },
    { id: "text3d", label: "3D Text", gl: 1, settings: 1 },
    { id: "beziers", label: "Beziers" },
    { id: "marquee", label: "Marquee", settings: 1 },
    { id: "slideshow", label: "My Pictures Slideshow", settings: 1 },
    { id: "mystify", label: "Mystify" },
    { id: "stars", label: "Starfield", settings: 1 },
    { id: "winxp", label: "Windows XP" },
    { id: "none", label: "(None)" },
  ];

  const M = {
    ident: () => [1,0,0,0, 0,1,0,0, 0,0,1,0, 0,0,0,1],
    mul(a, b) {
      const o = new Array(16);
      for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++)
        o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3];
      return o;
    },
    persp(fov, ar, n, f) {
      const t = 1 / Math.tan(fov / 2), d = 1 / (n - f);
      return [t/ar,0,0,0, 0,t,0,0, 0,0,(n+f)*d,-1, 0,0,2*n*f*d,0];
    },
    trans: (x,y,z) => [1,0,0,0, 0,1,0,0, 0,0,1,0, x,y,z,1],
    scale: (x,y,z) => [x,0,0,0, 0,y,0,0, 0,0,z,0, 0,0,0,1],
    rotX(a){ const c=Math.cos(a),s=Math.sin(a); return [1,0,0,0, 0,c,s,0, 0,-s,c,0, 0,0,0,1]; },
    rotY(a){ const c=Math.cos(a),s=Math.sin(a); return [c,0,-s,0, 0,1,0,0, s,0,c,0, 0,0,0,1]; },
    rotZ(a){ const c=Math.cos(a),s=Math.sin(a); return [c,s,0,0, -s,c,0,0, 0,0,1,0, 0,0,0,1]; },
    aim(d){
      if (d[2] === 1) return M.ident();
      if (d[2] === -1) return M.rotX(Math.PI);
      if (d[0] === 1) return M.rotY(Math.PI/2);
      if (d[0] === -1) return M.rotY(-Math.PI/2);
      if (d[1] === 1) return M.rotX(-Math.PI/2);
      return M.rotX(Math.PI/2);
    },
  };

  function glCtx(w, h) {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const gl = cv.getContext("webgl", { antialias: true, alpha: false });
    if (!gl) return null;
    const vs = `attribute vec3 p;attribute vec3 n;uniform mat4 mvp;uniform mat4 mv;uniform vec3 col;
      uniform vec3 lite;varying vec3 vc;
      void main(){ gl_Position=mvp*vec4(p,1.);
        vec3 nr=normalize(mat3(mv)*n);
        float d=max(dot(nr,normalize(lite)),0.);
        float sp=pow(max(dot(reflect(-normalize(lite),nr),vec3(0.,0.,1.)),0.),24.);
        vc=col*(.25+.75*d)+vec3(sp*.7); }`;
    const fs = `precision mediump float;varying vec3 vc;void main(){ gl_FragColor=vec4(vc,1.); }`;
    const mk = (t, src) => { const s = gl.createShader(t); gl.shaderSource(s, src); gl.compileShader(s); return s; };
    const pr = gl.createProgram();
    gl.attachShader(pr, mk(gl.VERTEX_SHADER, vs));
    gl.attachShader(pr, mk(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(pr); gl.useProgram(pr);
    gl.enable(gl.DEPTH_TEST);
    const loc = {
      p: gl.getAttribLocation(pr, "p"), n: gl.getAttribLocation(pr, "n"),
      mvp: gl.getUniformLocation(pr, "mvp"), mv: gl.getUniformLocation(pr, "mv"),
      col: gl.getUniformLocation(pr, "col"), lite: gl.getUniformLocation(pr, "lite"),
    };
    gl.uniform3f(loc.lite, .4, .7, .6);
    return { cv, gl, loc };
  }
  function mesh(G, verts, norms) {
    const { gl } = G;
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const nb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, nb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(norms), gl.STATIC_DRAW);
    return { vb, nb, n: verts.length / 3 };
  }
  function drawMesh(G, m, model, view, proj, color) {
    const { gl, loc } = G;
    const mv = M.mul(view, model);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.vb); gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, m.nb); gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
    gl.uniformMatrix4fv(loc.mv, false, mv);
    gl.uniformMatrix4fv(loc.mvp, false, M.mul(proj, mv));
    gl.uniform3fv(loc.col, color);
    gl.drawArrays(gl.TRIANGLES, 0, m.n);
  }
  function cylinder(G, seg = 12) {
    const v = [], n = [];
    for (let i = 0; i < seg; i++) {
      const a0 = (i / seg) * Math.PI * 2, a1 = ((i + 1) / seg) * Math.PI * 2;
      const x0 = Math.cos(a0), y0 = Math.sin(a0), x1 = Math.cos(a1), y1 = Math.sin(a1);
      v.push(x0,y0,0, x1,y1,0, x1,y1,1,  x0,y0,0, x1,y1,1, x0,y0,1);
      n.push(x0,y0,0, x1,y1,0, x1,y1,0,  x0,y0,0, x1,y1,0, x0,y0,0);
    }
    return mesh(G, v, n);
  }
  function sphere(G, la = 8, lo = 12) {
    const v = [], n = [];
    const P = (i, j) => {
      const th = (i / la) * Math.PI, ph = (j / lo) * Math.PI * 2;
      return [Math.sin(th)*Math.cos(ph), Math.sin(th)*Math.sin(ph), Math.cos(th)];
    };
    for (let i = 0; i < la; i++) for (let j = 0; j < lo; j++) {
      const a = P(i,j), b = P(i+1,j), c = P(i+1,j+1), d = P(i,j+1);
      v.push(...a,...b,...c, ...a,...c,...d); n.push(...a,...b,...c, ...a,...c,...d);
    }
    return mesh(G, v, n);
  }
  function cube(G) {
    const f = (nx,ny,nz, pts) => pts.forEach(p => { v.push(...p); n.push(nx,ny,nz); });
    const v = [], n = [];
    const q = (a,b,c,d,nx,ny,nz) => f(nx,ny,nz,[a,b,c,a,c,d]);
    q([-1,-1,1],[1,-1,1],[1,1,1],[-1,1,1], 0,0,1);
    q([1,-1,-1],[-1,-1,-1],[-1,1,-1],[1,1,-1], 0,0,-1);
    q([1,-1,1],[1,-1,-1],[1,1,-1],[1,1,1], 1,0,0);
    q([-1,-1,-1],[-1,-1,1],[-1,1,1],[-1,1,-1], -1,0,0);
    q([-1,1,1],[1,1,1],[1,1,-1],[-1,1,-1], 0,1,0);
    q([-1,-1,-1],[1,-1,-1],[1,-1,1],[-1,-1,1], 0,-1,0);
    return mesh(G, v, n);
  }

  const PIPECOLS = [[.83,.68,.21],[.75,.1,.1],[.1,.55,.14],[.15,.25,.75],[.1,.6,.6],[.65,.15,.6],[.7,.7,.72]];

  function mkPipes(w, h) {
    const G = glCtx(w, h); if (!G) return mk2DFallback(w, h);
    const cyl = cylinder(G), sph = sphere(G);
    const conf = Object.assign({ joint: "elbow", multiple: 1 }, cfgOf("pipes"));
    const GX = 14, GY = 10, GZ = 14, STEP = 1;
    const proj = M.persp(0.9, w / h, .5, 80);
    let grid, pipes, placed, total, fading, fade, view;
    const DIRS = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    const key = (x,y,z) => x + y * 100 + z * 10000;
    function reset() {
      grid = new Set(); pipes = []; placed = []; total = 0; fading = false; fade = 0;
      const ang = Math.random() * Math.PI * 2, elev = .25 + Math.random() * .4;
      const d = 16;
      view = M.mul(M.mul(M.rotX(elev), M.rotY(ang)), M.trans(-GX/2, -GY/2, -GZ/2));
      view = M.mul(M.trans(0, 0, -d), view);
      const nPipes = conf.multiple ? 4 : 1;
      for (let i = 0; i < nPipes; i++) newPipe();
    }
    function newPipe() {
      for (let t = 0; t < 40; t++) {
        const x = 1 + Math.floor(Math.random() * (GX - 2)), y = 1 + Math.floor(Math.random() * (GY - 2)), z = 1 + Math.floor(Math.random() * (GZ - 2));
        if (grid.has(key(x,y,z))) continue;
        grid.add(key(x,y,z));
        pipes.push({ x, y, z, dir: DIRS[Math.floor(Math.random()*6)], col: PIPECOLS[Math.floor(Math.random()*PIPECOLS.length)], t: 0 });
        return true;
      }
      return false;
    }
    let acc = 0;
    function step() {
      for (const p of pipes) {
        if (p.dead) continue;
        const opts = DIRS.filter(d => {
          const nx = p.x + d[0], ny = p.y + d[1], nz = p.z + d[2];
          return nx >= 0 && ny >= 0 && nz >= 0 && nx < GX && ny < GY && nz < GZ && !grid.has(key(nx,ny,nz));
        });
        if (!opts.length) { p.dead = 1; if (!newPipe()) fading = true; continue; }
        const keep = opts.find(d => d[0] === p.dir[0] && d[1] === p.dir[1] && d[2] === p.dir[2]);
        const dir = (keep && Math.random() < .55) ? keep : opts[Math.floor(Math.random() * opts.length)];
        const turned = !(dir[0] === p.dir[0] && dir[1] === p.dir[1] && dir[2] === p.dir[2]);
        placed.push({ kind: "seg", x: p.x, y: p.y, z: p.z, dir, col: p.col });
        if (turned) {
          if (conf.joint === "mixed" && Math.random() < .025)
            placed.push({ kind: "teapot", x: p.x, y: p.y, z: p.z, col: p.col,
              rot: Math.random() * Math.PI * 2 });
          else
            placed.push({ kind: "joint", x: p.x, y: p.y, z: p.z, col: p.col,
              r: conf.joint === "ball" || (conf.joint === "mixed" && Math.random() < .5) ? .36 : .26 });
        }
        p.x += dir[0]; p.y += dir[1]; p.z += dir[2]; p.dir = dir;
        grid.add(key(p.x, p.y, p.z));
        total++;
      }
      if (total > GX * GY * GZ * .32) fading = true;
    }
    reset();
    return {
      frame(ctx, dt) {
        acc += dt;
        while (acc > .07) { acc -= .07; if (!fading) step(); }
        if (fading) { fade += dt; if (fade > 1.2) reset(); }
        const { gl } = G;
        const k = fading ? Math.max(0, 1 - fade / 1.2) : 1;
        gl.clearColor(0, 0, 0, 1);
        gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        for (const s of placed) {
          const col = s.col.map(c => c * k);
          if (s.kind === "seg") {
            const model = M.mul(M.trans(s.x, s.y, s.z), M.mul(M.aim(s.dir), M.scale(.24, .24, STEP)));
            drawMesh(G, cyl, model, view, proj, col);
          } else if (s.kind === "teapot") {
            const at = M.mul(M.trans(s.x, s.y, s.z), M.rotY(s.rot));
            drawMesh(G, sph, M.mul(at, M.scale(.40, .32, .40)), view, proj, col);
            drawMesh(G, sph, M.mul(M.mul(at, M.trans(0, .30, 0)), M.scale(.15, .12, .15)), view, proj, col);
            drawMesh(G, cyl, M.mul(M.mul(M.mul(at, M.trans(.34, .10, 0)), M.aim([.8, .6, 0])), M.scale(.075, .075, .34)), view, proj, col);
            for (let i = 0; i < 5; i++) {
              const a = -1.15 + i * 0.575;
              drawMesh(G, sph, M.mul(M.mul(at, M.trans(-.34 - Math.cos(a) * .17, Math.sin(a) * .21, 0)), M.scale(.075, .075, .075)), view, proj, col);
            }
          } else {
            drawMesh(G, sph, M.mul(M.trans(s.x, s.y, s.z), M.scale(s.r, s.r, s.r)), view, proj, col);
          }
        }
        ctx.drawImage(G.cv, 0, 0);
      },
      destroy() {},
    };
  }

  function mkFlower(w, h) {
    const G = glCtx(w, h); if (!G) return mk2DFallback(w, h);
    const LA = 22, LO = 30;
    const proj = M.persp(.8, w / h, .5, 40);
    const { gl, loc } = G;
    const vb = gl.createBuffer(), nb = gl.createBuffer();
    let t = 0;
    const FACECOL = [[.9,.1,.1],[.1,.6,.15],[.15,.2,.85],[.85,.75,.1],[.75,.15,.7],[.1,.7,.7]];
    return {
      frame(ctx, dt) {
        t += dt;
        const sp = (Math.sin(t * .7) + 1) / 2;
        const v = [], n = [], c = [];
        const P = (i, j) => {
          const th = (i / LA) * Math.PI, ph = (j / LO) * Math.PI * 2;
          let x = Math.sin(th) * Math.cos(ph), y = Math.sin(th) * Math.sin(ph), z = Math.cos(th);
          const cubeR = 1 / Math.max(Math.abs(x), Math.abs(y), Math.abs(z));
          const spike = 1 + sp * .9 * Math.abs(Math.sin(3 * th) * Math.sin(3 * ph));
          const r = (1 + sp * (Math.min(cubeR, 1.6) - 1)) * spike;
          return [x * r, y * r, z * r];
        };
        for (let i = 0; i < LA; i++) for (let j = 0; j < LO; j++) {
          const a = P(i,j), b = P(i+1,j), d = P(i,j+1), e = P(i+1,j+1);
          v.push(...a,...b,...e, ...a,...e,...d);
          const u = [b[0]-a[0], b[1]-a[1], b[2]-a[2]], q = [d[0]-a[0], d[1]-a[1], d[2]-a[2]];
          const fn = [u[1]*q[2]-u[2]*q[1], u[2]*q[0]-u[0]*q[2], u[0]*q[1]-u[1]*q[0]];
          const l = Math.hypot(...fn) || 1; fn.forEach((x2, ii) => fn[ii] = x2 / l);
          for (let k2 = 0; k2 < 6; k2++) n.push(...fn);
        }
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
        const model = M.mul(M.rotY(t * .9), M.rotX(t * .55));
        const view = M.trans(0, 0, -4.6);
        const mv = M.mul(view, model);
        gl.uniformMatrix4fv(loc.mv, false, mv);
        gl.uniformMatrix4fv(loc.mvp, false, M.mul(proj, mv));
        const ci = Math.floor(t * .35) % FACECOL.length;
        gl.uniform3fv(loc.col, FACECOL[ci]);
        gl.drawArrays(gl.TRIANGLES, 0, v.length / 3);
        ctx.drawImage(G.cv, 0, 0);
      },
      destroy() {},
    };
  }

  function mkFlying(w, h) {
    const G = glCtx(w, h); if (!G) return mk2DFallback(w, h);
    const proj = M.persp(.85, w / h, .5, 60);
    const { gl, loc } = G;
    const vb = gl.createBuffer(), nb = gl.createBuffer();
    let t = 0;
    return {
      frame(ctx, dt) {
        t += dt;
        const v = [], n = [];
        const path = s => [Math.sin(s * 1.3 + t) * 2.2, Math.sin(s * 1.7 + t * 1.3) * 1.4, Math.cos(s * 1.1 + t * .8) * 2.2];
        const SEGS = 70, HW = .35;
        for (let i = 0; i < SEGS; i++) {
          const s0 = i / 8, s1 = (i + 1) / 8;
          const a = path(s0), b = path(s1);
          const tw0 = s0 * 2 + t * 2, tw1 = s1 * 2 + t * 2;
          const up0 = [Math.cos(tw0) * HW, Math.sin(tw0) * HW, 0], up1 = [Math.cos(tw1) * HW, Math.sin(tw1) * HW, 0];
          const p1 = [a[0]+up0[0],a[1]+up0[1],a[2]+up0[2]], p2 = [a[0]-up0[0],a[1]-up0[1],a[2]-up0[2]];
          const p3 = [b[0]-up1[0],b[1]-up1[1],b[2]-up1[2]], p4 = [b[0]+up1[0],b[1]+up1[1],b[2]+up1[2]];
          v.push(...p1,...p2,...p3, ...p1,...p3,...p4);
          const fn = [Math.sin(tw0), -Math.cos(tw0), .3];
          for (let k = 0; k < 6; k++) n.push(...fn);
        }
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.disable(gl.DEPTH_TEST);
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(v), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.p); gl.vertexAttribPointer(loc.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, nb); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(n), gl.DYNAMIC_DRAW);
        gl.enableVertexAttribArray(loc.n); gl.vertexAttribPointer(loc.n, 3, gl.FLOAT, false, 0, 0);
        const mv = M.trans(0, 0, -6);
        gl.uniformMatrix4fv(loc.mv, false, mv);
        gl.uniformMatrix4fv(loc.mvp, false, M.mul(proj, mv));
        const hue = (t * 30) % 360;
        gl.uniform3fv(loc.col, hsl(hue, .85, .55));
        gl.drawArrays(gl.TRIANGLES, 0, v.length / 3);
        gl.enable(gl.DEPTH_TEST);
        ctx.drawImage(G.cv, 0, 0);
      },
      destroy() {},
    };
  }
  function hsl(h, s, l) {
    const a = s * Math.min(l, 1 - l);
    const f = k => { const n2 = (k + h / 30) % 12; return l - a * Math.max(Math.min(n2 - 3, 9 - n2, 1), -1); };
    return [f(0), f(8), f(4)];
  }

  function mkText3D(w, h) {
    const G = glCtx(w, h); if (!G) return mk2DFallback(w, h);
    const conf = Object.assign({ text: "CURSORS", rot: "spin" }, cfgOf("text3d"));
    const proj = M.persp(.7, w / h, .5, 40);
    const tc = document.createElement("canvas");
    tc.width = 512; tc.height = 128;
    const tg = tc.getContext("2d");
    tg.fillStyle = "#123"; tg.fillRect(0, 0, 512, 128);
    tg.font = "bold 84px Arial"; tg.textAlign = "center"; tg.textBaseline = "middle";
    tg.fillStyle = "#9fc7ff"; tg.fillText(conf.text.slice(0, 16) || "CURSORS", 256, 70);
    const { gl } = G;
    const vs2 = `attribute vec3 p;attribute vec2 t;uniform mat4 mvp;varying vec2 vt;
      void main(){ gl_Position=mvp*vec4(p,1.); vt=t; }`;
    const fs2 = `precision mediump float;uniform sampler2D s;varying vec2 vt;
      void main(){ vec4 c=texture2D(s,vt); if(c.r<.09&&c.g<.15&&c.b<.25) discard; gl_FragColor=c; }`;
    const mk = (ty, src) => { const sh = gl.createShader(ty); gl.shaderSource(sh, src); gl.compileShader(sh); return sh; };
    const pr2 = gl.createProgram();
    gl.attachShader(pr2, mk(gl.VERTEX_SHADER, vs2)); gl.attachShader(pr2, mk(gl.FRAGMENT_SHADER, fs2));
    gl.linkProgram(pr2);
    const l2 = { p: gl.getAttribLocation(pr2, "p"), t: gl.getAttribLocation(pr2, "t"), mvp: gl.getUniformLocation(pr2, "mvp") };
    const tex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, tex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, tc);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    const quads = [];
    for (let z = 0; z < 7; z++) quads.push(-.12 + z * .04);
    const verts = [], uvs = [];
    for (const z of quads) {
      verts.push(-2,-.5,z, 2,-.5,z, 2,.5,z, -2,-.5,z, 2,.5,z, -2,.5,z);
      uvs.push(0,1, 1,1, 1,0, 0,1, 1,0, 0,0);
    }
    const vb = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, vb);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(verts), gl.STATIC_DRAW);
    const ub = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, ub);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.STATIC_DRAW);
    let t = 0;
    return {
      frame(ctx, dt) {
        t += dt;
        gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
        gl.useProgram(pr2);
        let model;
        if (conf.rot === "seesaw") model = M.rotY(Math.sin(t * .9) * 1.1);
        else if (conf.rot === "wobble") model = M.mul(M.rotY(t * 1.2), M.rotZ(Math.sin(t * .7) * .35));
        else model = M.rotY(t * 1.2);
        const mv = M.mul(M.trans(0, 0, -3.4), model);
        gl.uniformMatrix4fv(l2.mvp, false, M.mul(proj, mv));
        gl.bindBuffer(gl.ARRAY_BUFFER, vb); gl.enableVertexAttribArray(l2.p); gl.vertexAttribPointer(l2.p, 3, gl.FLOAT, false, 0, 0);
        gl.bindBuffer(gl.ARRAY_BUFFER, ub); gl.enableVertexAttribArray(l2.t); gl.vertexAttribPointer(l2.t, 2, gl.FLOAT, false, 0, 0);
        gl.bindTexture(gl.TEXTURE_2D, tex);
        gl.drawArrays(gl.TRIANGLES, 0, verts.length / 3);
        ctx.drawImage(G.cv, 0, 0);
      },
      destroy() {},
    };
  }

  function mkMystify(w, h) {
    const poly = () => ({
      pts: Array.from({ length: 4 }, () => ({ x: Math.random()*w, y: Math.random()*h,
        dx: (Math.random()*2-1)*(w/340+.6)*2.4, dy: (Math.random()*2-1)*(h/260+.6)*2.4 })),
      hue: Math.random()*360, trail: [],
    });
    const polys = [poly(), poly()];
    return {
      frame(ctx) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        for (const p of polys) {
          for (const v of p.pts) {
            v.x += v.dx; v.y += v.dy;
            if (v.x < 0 || v.x > w) { v.dx *= -1; v.x = Math.max(0, Math.min(w, v.x)); }
            if (v.y < 0 || v.y > h) { v.dy *= -1; v.y = Math.max(0, Math.min(h, v.y)); }
          }
          p.hue = (p.hue + 1.1) % 360;
          p.trail.push(p.pts.map(v => ({ x: v.x, y: v.y })));
          if (p.trail.length > 7) p.trail.shift();
          p.trail.forEach((snap, i) => {
            ctx.strokeStyle = `hsl(${(p.hue - i * 9 + 360) % 360} 100% ${20 + i * 6}%)`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            snap.forEach((v, j) => j ? ctx.lineTo(v.x, v.y) : ctx.moveTo(v.x, v.y));
            ctx.closePath(); ctx.stroke();
          });
        }
      },
      destroy() {},
    };
  }
  function mkBeziers(w, h) {
    const pts = Array.from({ length: 7 }, () => ({ x: Math.random()*w, y: Math.random()*h,
      dx: (Math.random()*2-1)*(w/320+.5)*3, dy: (Math.random()*2-1)*(h/260+.5)*3 }));
    let hue = Math.random() * 360;
    return {
      frame(ctx) {
        ctx.fillStyle = "rgba(0,0,0,.14)"; ctx.fillRect(0, 0, w, h);
        for (const v of pts) {
          v.x += v.dx; v.y += v.dy;
          if (v.x < 0 || v.x > w) v.dx *= -1;
          if (v.y < 0 || v.y > h) v.dy *= -1;
        }
        hue = (hue + 1.6) % 360;
        ctx.strokeStyle = `hsl(${hue} 100% 55%)`;
        ctx.lineWidth = Math.max(1, w / 600);
        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        for (let i = 1; i + 2 < pts.length; i += 3)
          ctx.bezierCurveTo(pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y, pts[i+2].x, pts[i+2].y);
        ctx.stroke();
      },
      destroy() {},
    };
  }
  function mkMarquee(w, h) {
    const conf = Object.assign({ text: "Your message here", speed: 6, color: "#00FF00", bg: "#000000" }, cfgOf("marquee"));
    const fs = Math.max(18, Math.round(h / 5));
    let x = w;
    let tw = 0;
    return {
      frame(ctx, dt) {
        ctx.fillStyle = conf.bg; ctx.fillRect(0, 0, w, h);
        ctx.font = `bold ${fs}px "Times New Roman", serif`;
        ctx.textBaseline = "middle";
        if (!tw) tw = ctx.measureText(conf.text).width;
        x -= (30 + conf.speed * 22) * dt;
        if (x < -tw) x = w;
        ctx.fillStyle = conf.color;
        ctx.fillText(conf.text, x, h / 2);
      },
      destroy() {},
    };
  }
  function mkStars(w, h) {
    const conf = Object.assign({ n: 160, speed: 1 }, cfgOf("stars"));
    const stars = Array.from({ length: conf.n }, () => ({ x: Math.random()*2-1, y: Math.random()*2-1, z: Math.random()*.9+.1 }));
    return {
      frame(ctx, dt) {
        ctx.fillStyle = "rgba(0,0,0,.5)"; ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = "#fff";
        for (const s of stars) {
          s.z -= dt * .28 * conf.speed;
          if (s.z <= .05) { s.x = Math.random()*2-1; s.y = Math.random()*2-1; s.z = 1; }
          const px = w/2 + s.x/s.z*w*.5, py = h/2 + s.y/s.z*h*.5;
          const r = Math.max(.4, (1-s.z)*2.4*(w/800+.4));
          if (px >= 0 && px < w && py >= 0 && py < h) { ctx.beginPath(); ctx.arc(px, py, r, 0, 6.28); ctx.fill(); }
        }
      },
      destroy() {},
    };
  }
  function mkSlideshow(w, h) {
    const conf = Object.assign({ dwell: 6 }, cfgOf("slideshow"));
    const pics = (hooks.pictures ? hooks.pictures() : []).slice(0, 40);
    let i = 0, t = 0, img = null, prev = null, fade = 1;
    const load = idx => {
      const im = new Image();
      im.src = pics[idx % pics.length];
      return im;
    };
    if (pics.length) { img = load(0); }
    return {
      frame(ctx, dt) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        if (!pics.length) {
          ctx.fillStyle = "#888"; ctx.font = `${Math.max(10, h/18)}px Tahoma`;
          ctx.textAlign = "center";
          ctx.fillText("There are no pictures in My Pictures.", w/2, h/2);
          return;
        }
        t += dt; fade = Math.min(1, fade + dt * 1.4);
        if (t > conf.dwell) { t = 0; fade = 0; prev = img; i++; img = load(i); }
        const draw = (im, alpha) => {
          if (!im || !im.complete || !im.naturalWidth) return;
          const k = Math.min(w / im.naturalWidth, h / im.naturalHeight);
          const dw = im.naturalWidth * k, dh = im.naturalHeight * k;
          ctx.globalAlpha = alpha;
          ctx.drawImage(im, (w - dw) / 2, (h - dh) / 2, dw, dh);
          ctx.globalAlpha = 1;
        };
        if (fade < 1) draw(prev, 1 - fade);
        draw(img, fade);
      },
      destroy() {},
    };
  }
  function mkWinXP(w, h) {
    const img = new Image(); img.src = IMG.logoFlag;
    let x = w * .3, y = h * .4, t = 0, alpha = 0, phase = 0;
    return {
      frame(ctx, dt) {
        ctx.fillStyle = "#000"; ctx.fillRect(0, 0, w, h);
        t += dt;
        if (phase === 0) { alpha = Math.min(1, alpha + dt * .5); if (alpha >= 1) { phase = 1; t = 0; } }
        else if (phase === 1 && t > 5) phase = 2;
        else if (phase === 2) {
          alpha -= dt * .6;
          if (alpha <= 0) { alpha = 0; phase = 0; x = Math.random() * w * .6 + w * .1; y = Math.random() * h * .6 + h * .1; }
        }
        const lw = Math.max(60, w / 6);
        if (img.complete && img.naturalWidth) {
          ctx.globalAlpha = alpha;
          const lh = lw * img.naturalHeight / img.naturalWidth;
          ctx.drawImage(img, x, y, lw, lh);
          ctx.font = `bold ${Math.max(10, lw / 5.2)}px Franklin Gothic Medium, Tahoma`;
          ctx.fillStyle = "#fff";
          ctx.fillText("Microsoft", x + lw * .04, y + lh + lw * .16);
          ctx.font = `bold ${Math.max(12, lw / 3.4)}px Franklin Gothic Medium, Tahoma`;
          ctx.fillText("Windows", x, y + lh + lw * .44);
          ctx.fillStyle = "#F6A821";
          ctx.font = `italic bold ${Math.max(9, lw / 5)}px Franklin Gothic Medium, Tahoma`;
          ctx.fillText("xp", x + lw * 1.28, y + lh + lw * .3);
          ctx.globalAlpha = 1;
        }
      },
      destroy() {},
    };
  }
  function mk2DFallback(w, h) { return mkMystify(w, h); }

  const MAKERS = {
    pipes: mkPipes, flowerbox: mkFlower, flying: mkFlying, text3d: mkText3D,
    mystify: mkMystify, beziers: mkBeziers, marquee: mkMarquee, stars: mkStars,
    slideshow: mkSlideshow, winxp: mkWinXP,
  };

  return {
    list: () => LIST,
    has: id => !!MAKERS[id],
    create: (id, w, h) => (MAKERS[id] || mkPipes)(w, h),
    cfgOf,
  };
}
