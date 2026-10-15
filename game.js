// Simple HTML5 prototype game logic
// - Movement (WASD), Shift sprint
// - Interact with hotspots (F)
// - Flashlight (Space) stuns monster
// - Puzzles: Simon Says, Drag Cables, Bomb Disable

const canvas = document.getElementById('world');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('puzzle-overlay');
const puzzleBox = document.getElementById('puzzle-box');
const closeBtn = document.getElementById('puzzle-close');
const healthValueEl = document.getElementById('health-value');

const keys = {};
window.addEventListener('keydown', e=>{ keys[e.key.toLowerCase()] = true; if(e.key==='Escape') closePuzzle(); });
window.addEventListener('keyup', e=>{ keys[e.key.toLowerCase()] = false; });

// Player
const player = { x:480, y:320, r:12, speed:1.6, baseSpeed:1.6, sprintMult:2.4, color:'#9cf' };
let health = 100;
let flashlightCooldown = 0;

// Monster
const monster = { x:200, y:150, r:18, speed:0.7, color:'#f66', stunned:0 };

// Puzzles (hotspots)
const puzzles = [
  { id:1, x:300, y:220, type:'simon', completed:false },
  { id:2, x:700, y:200, type:'drag', completed:false },
  { id:3, x:600, y:480, type:'bomb', completed:false }
];

let activePuzzle = null;

function dist(a,b){ const dx=a.x-b.x, dy=a.y-b.y; return Math.hypot(dx,dy); }

function update(dt){
  // Movement
  let vx=0, vy=0;
  if(keys['w']||keys['arrowup']) vy-=1;
  if(keys['s']||keys['arrowdown']) vy+=1;
  if(keys['a']||keys['arrowleft']) vx-=1;
  if(keys['d']||keys['arrowright']) vx+=1;
  let sp = player.baseSpeed;
  if(keys['shift']) sp = player.baseSpeed * player.sprintMult;
  if(vx||vy){ const m = Math.hypot(vx,vy); player.x += (vx/m)*sp*dt; player.y += (vy/m)*sp*dt; }

  // Boundaries
  player.x = Math.max(20, Math.min(canvas.width-20, player.x));
  player.y = Math.max(20, Math.min(canvas.height-20, player.y));

  // Interact
  if(keys['f']){
    const near = puzzles.find(p=>!p.completed && Math.hypot(p.x-player.x,p.y-player.y) < 40);
    if(near && !activePuzzle){ openPuzzle(near); keys['f'] = false; }
  }

  // Flashlight (Space) stun
  if(keys[' ']){
    if(flashlightCooldown<=0){
      // stun if close
      if(Math.hypot(monster.x-player.x, monster.y-player.y) < 160){ monster.stunned = 3000; }
      flashlightCooldown = 3000; keys[' '] = false;
    }
  }
  flashlightCooldown = Math.max(0, flashlightCooldown - dt*1000);

  // Monster AI
  if(monster.stunned > 0){ monster.stunned = Math.max(0, monster.stunned - dt*1000); }
  else {
    const dx = player.x - monster.x, dy = player.y - monster.y; const m = Math.hypot(dx,dy);
    if(m>1){ monster.x += (dx/m)*monster.speed*dt*60; monster.y += (dy/m)*monster.speed*dt*60; }
  }

  // Collision
  if(Math.hypot(player.x-monster.x, player.y-monster.y) < player.r+monster.r){
    // take damage over time
    health -= dt*12; if(health<=0){ health = 0; resetToStart(); }
  }
  healthValueEl.textContent = Math.max(0, Math.floor(health));
}

function resetToStart(){
  player.x = 100; player.y = 100; health = 100; monster.x = 200; monster.y = 150; puzzles.forEach(p=>p.completed=false); closePuzzle();
}

function draw(){
  // background
  ctx.clearRect(0,0,canvas.width,canvas.height);
  ctx.fillStyle = '#222'; ctx.fillRect(0,0,canvas.width,canvas.height);

  // draw hotspots
  puzzles.forEach(p=>{
    ctx.save();
    if(p.completed){ ctx.globalAlpha = 0.25; }
    ctx.beginPath(); ctx.fillStyle = p.type==='simon' ? '#6cf' : p.type==='drag' ? '#fc6' : '#c6f';
    ctx.arc(p.x, p.y, 22, 0, Math.PI*2); ctx.fill();
    ctx.restore();
  });

  // player
  ctx.beginPath(); ctx.fillStyle = player.color; ctx.arc(player.x, player.y, player.r, 0, Math.PI*2); ctx.fill();
  // monster
  ctx.beginPath(); ctx.fillStyle = monster.color; ctx.arc(monster.x, monster.y, monster.r, 0, Math.PI*2); ctx.fill();

  // hint when near
  const near = puzzles.find(p=>!p.completed && Math.hypot(p.x-player.x,p.y-player.y) < 40);
  if(near){ ctx.fillStyle='white'; ctx.font='14px Arial'; ctx.fillText('Press F to interact', near.x-50, near.y-40); }
}

let last = performance.now();
function loop(t){ const dt = (t-last)/1000; last=t; update(dt); draw(); requestAnimationFrame(loop); }
requestAnimationFrame(loop);

// Puzzle handling
function openPuzzle(puzzle){ activePuzzle = puzzle; overlay.classList.remove('hidden'); puzzleBox.innerHTML = '';
  if(puzzle.type==='simon') openSimon(puzzle);
  if(puzzle.type==='drag') openDrag(puzzle);
  if(puzzle.type==='bomb') openBomb(puzzle);
}
function closePuzzle(){ activePuzzle = null; overlay.classList.add('hidden'); puzzleBox.innerHTML = ''; }
closeBtn.onclick = closePuzzle;

// Simon Says puzzle
function openSimon(p){
  const container = document.createElement('div');
  container.innerHTML = '<h2>Simon Says</h2><p>Repeat the color sequence.</p>';
  const colors = ['red','green','blue','yellow'];
  const seq = [];
  let playerSeq = [];
  const display = document.createElement('div');
  display.style.marginTop='8px';
  container.appendChild(display);
  const info = document.createElement('div'); info.style.marginTop='8px'; container.appendChild(info);
  const btnWrap = document.createElement('div'); btnWrap.style.marginTop='12px';
  colors.forEach(c=>{
    const b = document.createElement('button'); b.className='puzzle-btn'; b.style.background=c; b.onclick = ()=>{ playerSeq.push(c); check(); };
    b.textContent = c; btnWrap.appendChild(b);
  }); container.appendChild(btnWrap);

  function nextRound(){ const n = Math.floor(Math.random()*colors.length); seq.push(colors[n]); info.textContent = 'Watch the sequence'; showSeq(); }
  function showSeq(){ display.innerHTML = ''; let i=0; function step(){ if(i>=seq.length){ info.textContent='Now repeat it'; return; } const col = seq[i]; const el = document.createElement('div'); el.className='color-btn'; el.style.background=col; display.appendChild(el); i++; setTimeout(()=>{ el.style.opacity=0.4; setTimeout(step,300); },700); } step(); }
  function check(){ for(let i=0;i<playerSeq.length;i++){ if(playerSeq[i]!==seq[i]){ info.textContent='Wrong, try again'; playerSeq=[]; return; } }
    if(playerSeq.length===seq.length){ info.textContent='Success!'; p.completed=true; setTimeout(()=>{ closePuzzle(); },700); }
  }
  // start with 3 steps
  nextRound(); nextRound();
  puzzleBox.appendChild(container);
}

// Drag cables puzzle
function openDrag(p){
  const container = document.createElement('div');
  container.innerHTML = '<h2>Drag Cables</h2><p>Drag each colored cable to the matching socket.</p>';
  const canvasEl = document.createElement('canvas'); canvasEl.width=600; canvasEl.height=260; canvasEl.style.background='#111'; canvasEl.style.display='block'; container.appendChild(canvasEl);
  const cctx = canvasEl.getContext('2d');
  const sockets = [ {x:100,y:70,color:'red',hit:false}, {x:100,y:190,color:'green',hit:false} ];
  const plugs = [ {x:480,y:60,color:'red'}, {x:480,y:180,color:'green'} ];
  let drag = null;
  function drawDrag(){ cctx.clearRect(0,0,canvasEl.width, canvasEl.height); sockets.forEach(s=>{ cctx.fillStyle=s.color; cctx.beginPath(); cctx.arc(s.x,s.y,18,0,Math.PI*2); cctx.fill(); }); plugs.forEach(p2=>{ cctx.fillStyle=p2.color; cctx.beginPath(); cctx.rect(p2.x-16,p2.y-16,32,32); cctx.fill(); }); if(drag){ cctx.strokeStyle=drag.color; cctx.lineWidth=6; cctx.beginPath(); cctx.moveTo(drag.x, drag.y); cctx.lineTo(drag.mx, drag.my); cctx.stroke(); } }
  canvasEl.addEventListener('mousedown', e=>{
    const r = canvasEl.getBoundingClientRect(); const mx=e.clientX-r.left, my=e.clientY-r.top;
    const pidx = plugs.findIndex(p=>Math.hypot(p.x-mx,p.y-my)<24);
    if(pidx>=0){ drag = { idx:pidx, x:plugs[pidx].x, y:plugs[pidx].y, mx:mx, my:my, color:plugs[pidx].color }; }
  });
  window.addEventListener('mousemove', mv=>{ if(!drag) return; const r=canvasEl.getBoundingClientRect(); drag.mx=mv.clientX-r.left; drag.my=mv.clientY-r.top; drawDrag(); });
  window.addEventListener('mouseup', up=>{
    if(!drag) return; const r=canvasEl.getBoundingClientRect(); const mx=drag.mx, my=drag.my; const sidx = sockets.findIndex(s=>Math.hypot(s.x-mx,s.y-my)<28 && s.color===drag.color);
    if(sidx>=0){ sockets[sidx].hit=true; plugs.splice(drag.idx,1); }
    drag=null; drawDrag();
    if(sockets.every(s=>s.hit)){ p.completed=true; setTimeout(()=>{ closePuzzle(); },600); }
  });
  drawDrag(); puzzleBox.appendChild(container);
}

// Bomb puzzle — quick-time press sequence
function openBomb(p){
  const container = document.createElement('div');
  container.innerHTML = '<h2>Bomb Disable</h2><p>Follow the sequence of arrow keys before the timer runs out.</p>';
  const info = document.createElement('div'); info.style.marginTop='12px'; container.appendChild(info);
  const seq = [];
  const choices = ['ArrowUp','ArrowDown','ArrowLeft','ArrowRight'];
  for(let i=0;i<4;i++) seq.push(choices[Math.floor(Math.random()*choices.length)]);
  let pos = 0; let timer=10.0; info.textContent = 'Time: ' + timer.toFixed(1);
  const tick = setInterval(()=>{ timer-=0.1; info.textContent = 'Time: ' + timer.toFixed(1) + ' • Progress: ' + pos + '/' + seq.length; if(timer<=0){ clearInterval(tick); info.textContent='Exploded! Failed.'; setTimeout(()=>{ closePuzzle(); },800); } }, 100);
  function keyHandler(e){ if(e.key===seq[pos]){ pos++; if(pos>=seq.length){ clearInterval(tick); info.textContent='Disabled!'; p.completed=true; window.removeEventListener('keydown', keyHandler); setTimeout(()=>{ closePuzzle(); },700); } } else { clearInterval(tick); info.textContent='Wrong! Failed.'; window.removeEventListener('keydown', keyHandler); setTimeout(()=>{ closePuzzle(); },700); } }
  window.addEventListener('keydown', keyHandler);
  const hint = document.createElement('div'); hint.style.marginTop='8px'; hint.textContent = 'Sequence (for prototype): ' + seq.map(s=>s.replace('Arrow','')).join(' - ');
  container.appendChild(hint);
  puzzleBox.appendChild(container);
}

// Simple touch to open in small screens: optional

// End of game.js
