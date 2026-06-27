/* IMAGES HERE */
const IMAGE_TOP    = "img1.png";   // Top layer — always visible (mask)
const IMAGE_BOTTOM = "img2.png";   // Bottom layer — revealed by snake trail


(function () {

  /*  SNAKE TRAIL CONFIG effect */
  const TRAIL_MAX_AGE   = 900;   // ms  — how long each trail point lives
  const TRAIL_RADIUS    = 90;    // px  — brush width at the snake's head
  const TRAIL_MIN_RAD   = 8;     // px  — minimum radius at the tail
  const TRAIL_FEATHER   = 30;    // px  — soft-edge feathering amount
  const IDLE_FADE_SPEED = 0.04;  // 0–1 — how fast trail fades when stopped


  const canvas = document.getElementById('heroCanvas');
  const ctx    = canvas.getContext('2d');

  let W, H, rafId;
  let trail        = [];   // array of { x, y, t }
  let mouse        = null; // current cursor position
  let lastMoveTime = 0;    // timestamp of last mousemove
  let globalAlpha  = 1;    // master opacity of the entire trail mask

 
  const imgTop = new Image();
  const imgBot = new Image();
  let topLoaded = false;
  let botLoaded = false;

  imgTop.onload  = () => { topLoaded = true; tryStart(); };
  imgBot.onload  = () => { botLoaded = true; tryStart(); };
  imgTop.onerror = () => console.error('Could not load top image: '    + IMAGE_TOP);
  imgBot.onerror = () => console.error('Could not load bottom image: ' + IMAGE_BOTTOM);

  imgTop.src = IMAGE_TOP;
  imgBot.src = IMAGE_BOTTOM;

  function tryStart() {
    if (topLoaded && botLoaded) { resize(); loop(); }
  }

  /* RESIZE */
  function resize() {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', () => {
    resize();
    cancelAnimationFrame(rafId);
    loop();
  });

  /* COVER-FIT  */
  
  function drawCover(c, img, alignY = 0.5) {
    const ir = img.naturalWidth / img.naturalHeight;
    const cr = W / H;
    let sw, sh, sx, sy;

    if (ir > cr) {
      // Image is wider than canvas — crop sides
      sh = img.naturalHeight;
      sw = sh * cr;
      sx = (img.naturalWidth - sw) / 2;
      sy = 0;
    } else {
      // Image is taller than canvas — crop top/bottom
      sw = img.naturalWidth;
      sh = sw / cr;
      sx = 0;
      sy = (img.naturalHeight - sh) * alignY;
    }

    c.drawImage(img, sx, sy, sw, sh, 0, 0, W, H);
  }

  /* BUILD REVEAL MASK */
  // Returns an offscreen canvas 
  
  function buildRevealMask() {
    const off = document.createElement('canvas');
    off.width  = W;
    off.height = H;
    const c   = off.getContext('2d');
    c.clearRect(0, 0, W, H);

    if (trail.length === 0) return off;

    const now = Date.now();

    for (let i = 0; i < trail.length; i++) {
      const pt  = trail[i];
      const age = now - pt.t;

    
      const lifeFrac = 1 - (age / TRAIL_MAX_AGE);
      if (lifeFrac <= 0) continue;

      
      const posFrac = i / Math.max(1, trail.length - 1);

      // Radius tapers from head to tail
      const radius = TRAIL_MIN_RAD + (TRAIL_RADIUS - TRAIL_MIN_RAD) * posFrac * lifeFrac;
      const feather = TRAIL_FEATHER * posFrac * lifeFrac;
      const totalR  = radius + feather;

      // Alpha blends age + position so the tail fades out smoothly
      const alpha = Math.min(1, lifeFrac * (0.5 + 0.5 * posFrac)) * globalAlpha;

      const g = c.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, totalR);
      g.addColorStop(0,                `rgba(255,255,255,${alpha})`);
      g.addColorStop(radius / totalR,  `rgba(255,255,255,${alpha})`);
      g.addColorStop(1,                'rgba(255,255,255,0)');

      c.fillStyle = g;
      c.beginPath();
      c.arc(pt.x, pt.y, totalR, 0, Math.PI * 2);
      c.fill();
    }

    return off;
  }

  /* ─ EMBER GLOW*/
  // Warm orange glow ring drawn beneath the top image at the cursor head.
  function drawEmberGlow(x, y, alpha) {
    ctx.save();
    const r1 = TRAIL_RADIUS * 0.8;
    const r2 = TRAIL_RADIUS + TRAIL_FEATHER + 40;
    const g  = ctx.createRadialGradient(x, y, r1, x, y, r2);
    g.addColorStop(0,   `rgba(232,80,48,0)`);
    g.addColorStop(0.3, `rgba(232,80,48,${0.55 * alpha})`);
    g.addColorStop(0.7, `rgba(192,57,43,${0.22 * alpha})`);
    g.addColorStop(1,   'rgba(192,57,43,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  /* CUSTOM CURSOR  */
  // Replaces the hidden default cursor with a red reticle + crosshair.
  function drawCursor(x, y, alpha) {
    ctx.save();
    ctx.globalAlpha = alpha;

    // Outer ring
    ctx.beginPath();
    ctx.arc(x, y, TRAIL_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(230,60,18,0.75)';
    ctx.lineWidth   = 1.2;
    ctx.stroke();

    // Centre dot
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(230,60,18,0.9)';
    ctx.fill();

    // Crosshair ticks
    const s = 10;
    ctx.strokeStyle = 'rgba(230,60,18,0.5)';
    ctx.lineWidth   = 0.8;
    ctx.beginPath(); ctx.moveTo(x - s, y); ctx.lineTo(x + s, y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s); ctx.stroke();

    ctx.restore();
  }

  /*  MAIN RENDER  */
  function render() {
    const now = Date.now();

    // Remove expired trail points
    trail = trail.filter(pt => now - pt.t < TRAIL_MAX_AGE);

    // Fade the whole trail when the cursor is idle 
    const idleTime = now - lastMoveTime;
    if (idleTime > 100) {
      globalAlpha = Math.max(0, globalAlpha - IDLE_FADE_SPEED);
    } else {
      globalAlpha = Math.min(1, globalAlpha + 0.12);
    }

    ctx.clearRect(0, 0, W, H);

    // Layer 1 — bottom image 
    drawCover(ctx, imgBot, 0.5);
    ctx.fillStyle = 'rgba(6,4,10,0.30)';
    ctx.fillRect(0, 0, W, H);

    // Layer 2 — ember glow beneath the top image
    if (mouse && globalAlpha > 0.01) {
      drawEmberGlow(mouse.x, mouse.y, globalAlpha);
    }

    // Layer 3 — top image with snake trail erased out of it
    //   a) Drawing top image onto an offscreen canvas
    const offTop   = document.createElement('canvas');
    offTop.width   = W;
    offTop.height  = H;
    const ctxTop   = offTop.getContext('2d');
    drawCover(ctxTop, imgTop, 0.5);

    //   b) Applied the snake mask using destination-out (punches holes in the top image)
    const offMasked   = document.createElement('canvas');
    offMasked.width   = W;
    offMasked.height  = H;
    const ctxMasked   = offMasked.getContext('2d');
    ctxMasked.drawImage(offTop, 0, 0);                         // start with full top image
    ctxMasked.globalCompositeOperation = 'destination-out';    // erase where mask is opaque
    ctxMasked.drawImage(buildRevealMask(), 0, 0);

    ctx.drawImage(offMasked, 0, 0);

    // Layer 4 — custom cursor reticle on top of everything
    if (mouse && globalAlpha > 0.01) {
      drawCursor(mouse.x, mouse.y, Math.min(1, globalAlpha * 1.5));
    }
  }

  /*  ANIMATION LOOP  */
  function loop() {
    render();
    rafId = requestAnimationFrame(loop);
  }

  /* ─ ADD TRAIL POINT */
  
  function addPoint(x, y) {
    const now  = Date.now();
    const last = trail[trail.length - 1];

    if (last) {
      const dx = x - last.x;
      const dy = y - last.y;
      if (dx * dx + dy * dy < 16) return; 
    }

    trail.push({ x, y, t: now });
    if (trail.length > 250) trail.shift(); 

    lastMoveTime = now;
    mouse = { x, y };
  }

  /* INPUT EVENTS  */
  window.addEventListener('mousemove', e => {
    addPoint(e.clientX, e.clientY);
  });

  document.body.addEventListener('mouseleave', () => {
    mouse = null;
  });

  window.addEventListener('touchmove', e => {
    const t = e.touches[0];
    addPoint(t.clientX, t.clientY);
  }, { passive: true });

  window.addEventListener('touchend', () => {
    mouse = null;
  });

})();