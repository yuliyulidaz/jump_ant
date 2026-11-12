// roundRect polyfill
if (!CanvasRenderingContext2D.prototype.roundRect) {
  CanvasRenderingContext2D.prototype.roundRect = function(x,y,w,h,r) {
    if (typeof r==='number') r=[r,r,r,r];
    const [tl,tr,br,bl]=r;
    this.moveTo(x+tl,y); this.lineTo(x+w-tr,y);
    this.arcTo(x+w,y,x+w,y+tr,tr); this.lineTo(x+w,y+h-br);
    this.arcTo(x+w,y+h,x+w-br,y+h,br); this.lineTo(x+bl,y+h);
    this.arcTo(x,y+h,x,y+h-bl,bl); this.lineTo(x,y+tl);
    this.arcTo(x,y,x+tl,y,tl); this.closePath();
  };
}

const canvas = document.getElementById('g');
const ctx = canvas.getContext('2d');

let soundMuted = false;
let audioCtx;
const sfxBuffers = [];
let lastJumpIdx = -1;
function initAudio() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  for (let i = 0; i < 5; i++) {
    fetch(import.meta.env.BASE_URL + "spring_" + i + ".wav")
      .then(r => r.arrayBuffer())
      .then(buf => audioCtx.decodeAudioData(buf))
      .then(decoded => { sfxBuffers[i] = decoded; })
      .catch(() => {});
  }
}
function playJump() {
  if (!audioCtx || soundMuted) return;
  if (audioCtx.state === 'suspended') audioCtx.resume();
  if (!sfxBuffers.length) return;
  let idx;
  if (sfxBuffers.length === 1) { idx = 0; }
  else { do { idx = Math.floor(Math.random() * sfxBuffers.length); } while (idx === lastJumpIdx); }
  lastJumpIdx = idx;
  const buf = sfxBuffers[idx];
  if (!buf) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = 0.95 + Math.random() * 0.1;
  const gain = audioCtx.createGain();
  gain.gain.value = 0.45 + Math.random() * 0.1;
  src.connect(gain).connect(audioCtx.destination);
  src.start();
}
let W, H;
const fontFam = getComputedStyle(document.body).fontFamily;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  const r = canvas.parentElement.getBoundingClientRect();
  W = r.width; H = r.height;
  canvas.width = W * dpr; canvas.height = H * dpr;
  ctx.setTransform(dpr,0,0,dpr,0,0);
}
resize();
window.addEventListener('resize', resize);

// ─── Constants ───
const CW = 32;
const CGAP = 14;
const CSTEP = CW + CGAP;
const CR = 15;
const GRAV = 0.38;
const FAST_FALL = 1.6;
const JUMP_VY = -10.5;
const JUMP_VX = 5.5;
const VX_FRICTION = 0.02;
const COYOTE = 80;
const BUFFER = 120;
const BLUE_DELAY = 12;
const MAX_AIR_JUMPS = 2;
const AIR_JUMP_VY = [-9, -7];
const WALL_SLIDE_SPEED = 1.2;
const WALL_JUMP_VY = -11;
const WALL_JUMP_VX = 4;
const RED_RISE_BASE = 0.15;
const RED_RISE_TALL = 0.4;
const RED_RISE_TALL_THRESHOLD = 40;
const SANGHAN_Y_RATIO = 0.46;

// ─── 2020 H1 Month Data ───
const MONTHS_H1 = [
  { name:'1월', count:28, safe:8,
    blueExtra:0.0, rise:1.0, maxBlue:1, riseRange:6, blueDelay:12,
    wp:[[0,2175],[0.4,2195],[1,2120]],
    ev:[[0,'2020년! 올해는 주식이다!🚀','#FF3B30'],
        [7,'계좌 개설 완료!! 풀매수 간다','#FF3B30'],
        [14,'중국에서 이상한 폐렴이...?','#8E8E93'],
        [19,'설마 한국까지 오겠어?ㅋㅋ','#8E8E93'],
        [22,'국내 첫 확진자 발생...','#007AFF']]},
  { name:'2월', count:25, safe:2,
    blueExtra:0.3, rise:1.2, maxBlue:3, riseRange:7, blueDelay:11,
    wp:[[0,2120],[0.7,2000],[1,1987]],
    ev:[[3,'집단감염 발생ㄷㄷㄷㄷ','#007AFF'],
        [8,'꽉 잡아ㅠㅠㅠㅠㅠㅠㅠ','#007AFF'],
        [12,'위기경보 심각 격상!!!','#007AFF'],
        [17,'떨어진다ㅠㅠㅠ 손절각인가','#007AFF'],
        [22,'2000선 무너졌다ㅠㅠㅠㅠ','#007AFF']]},
  { name:'3월', count:35, safe:3,
    blueExtra:0.3, rise:1.5, maxBlue:3, riseRange:9, blueDelay:10,
    wp:[[0,1987],[0.15,1954],[0.45,1457],[0.55,1482],[1,1755]],
    ev:[[3,'서킷브레이커 발동!!!!!!','#007AFF'],
        [8,'반대매매 터졌다ㅠㅠ 끝이다','#007AFF'],
        [12,'바닥이 어딘지 모르겠다...','#007AFF'],
        [15,'코스피 1457... 망했다...','#007AFF'],
        [18,'공매도 금지!!! 가자!!!!!','#FF3B30'],
        [20,'🐜 동학개미운동 시작 🐜','#FFD700'],
        [23,'지금이 바닥이다!! 줍줍!!','#FF3B30'],
        [26,'삼전 4만원대 실화?? 풀매수','#FF3B30'],
        [30,'존버는 승리한다!!!!!!','#FF3B30']]},
  { name:'4월', count:28, safe:3,
    blueExtra:0.05, rise:1.0, maxBlue:1, riseRange:10, blueDelay:9,
    wp:[[0,1755],[0.3,1850],[0.6,1900],[1,1948]],
    ev:[[3,'개미들이 외국인 물량 다 받음ㅋ','#FF3B30'],
        [9,'매수 타이밍 잡은 사람 진짜 천재','#FF3B30'],
        [15,'1900 회복!!! 가즈아!!!','#FF3B30'],
        [20,'내 계좌가 초록색이다ㅠㅠ 감동','#FF3B30'],
        [24,'바이오주 미쳤다!!!🧬🧬🧬','#FF3B30']]},
  { name:'5월', count:28, safe:2,
    blueExtra:0.2, rise:1.5, maxBlue:2, riseRange:12, blueDelay:8,
    wp:[[0,1948],[0.4,1980],[0.7,2010],[1,2030]],
    ev:[[4,'하루 순매수 1.7조ㄷㄷㄷㄷ','#FF3B30'],
        [10,'개미 힘 실화?? 외인 다 이김','#FF3B30'],
        [16,'2000 탈환!!!!!!!!!!','#FF3B30'],
        [20,'존버 성공한 사람 손들어🙋','#FF3B30'],
        [23,'치료제 나온다!! 바이오!!!','#FF3B30']]},
  { name:'6월', count:30, safe:2,
    blueExtra:0.25, rise:1.8, maxBlue:3, riseRange:13, blueDelay:7,
    wp:[[0,2030],[0.3,2100],[0.5,2132],[0.65,2050],[1,2108]],
    ev:[[4,'연초 손실 거의 회복! 아시아 1등!','#FF3B30'],
        [8,'수익 인증합니다ㅋㅋㅋ 감사합니다','#FF3B30'],
        [12,'거래대금 18조 역대 최대🔥🔥','#FFD700'],
        [18,'2차 유행...? 또...?ㅠㅠ','#007AFF'],
        [22,'흔들리면 지는거다 꽉잡아!!','#FF3B30'],
        [27,'🐜 개미는 강하다!!! 📈','#FFD700']]}
];

// ─── 2020 H2 Month Data ───
const MONTHS_H2 = [
  { name:'7월', count:26, safe:6,
    blueExtra:0.05, rise:1.0, maxBlue:1, riseRange:8, blueDelay:9, bMin:20, bRange:35,
    wp:[[0,2108],[0.3,2150],[0.6,2180],[1,2200]],
    ev:[[3,'하반기 시작! 2200 간다!!','#FF3B30'],
        [10,'개미들 매수세 여전히 강함ㅋ','#FF3B30'],
        [18,'여름이라 조용하네~','#8E8E93'],
        [22,'꾸준히 우상향 가즈아!!','#FF3B30']]},
  { name:'8월', count:28, safe:3,
    blueExtra:0.25, rise:1.3, maxBlue:2, riseRange:10, blueDelay:8, bMin:15, bRange:55,
    wp:[[0,2200],[0.25,2300],[0.45,2400],[0.65,2270],[1,2320]],
    ev:[[3,'2300 돌파!!! 가즈아!!','#FF3B30'],
        [8,'2400 찍었다!!!! 미쳤다','#FFD700'],
        [13,'코로나 재확산...또?ㅠㅠ','#007AFF'],
        [18,'조정이다 꽉잡아!!','#007AFF'],
        [23,'개미는 조정에 산다 줍줍!','#FF3B30']]},
  { name:'9월', count:28, safe:3,
    blueExtra:0.25, rise:1.2, maxBlue:2, riseRange:8, blueDelay:7, bMin:15, bRange:55,
    wp:[[0,2320],[0.3,2350],[0.5,2250],[0.75,2300],[1,2330]],
    ev:[[3,'BBIG!! 배터리 바이오 인터넷 게임!!','#FFD700'],
        [10,'나스닥 폭락ㄷㄷㄷ','#007AFF'],
        [16,'예탁금 60조 돌파 실화??','#FFD700'],
        [22,'횡보장... 참을성이 중요!!','#8E8E93']]},
  { name:'10월', count:28, safe:3,
    blueExtra:0.2, rise:1.0, maxBlue:2, riseRange:8, blueDelay:7, bMin:20, bRange:45,
    wp:[[0,2330],[0.3,2310],[0.6,2280],[0.85,2260],[1,2267]],
    ev:[[4,'삼성전자 실적 66조ㄷㄷ','#FF3B30'],
        [10,'미국 대선 불안...ㅠㅠ','#007AFF'],
        [17,'BBIG 16% 빠졌다...','#007AFF'],
        [23,'존버는 승리한다!! 꽉잡아','#FF3B30']]},
  { name:'11월', count:30, safe:3,
    blueExtra:0.1, rise:1.5, maxBlue:2, riseRange:12, blueDelay:6, bMin:20, bRange:35,
    wp:[[0,2267],[0.2,2350],[0.4,2460],[0.65,2550],[1,2600]],
    ev:[[3,'바이든 당선!! 코스피 날아간다','#FF3B30'],
        [9,'화이자 백신 나온다!!!','#FFD700'],
        [15,'외국인 5조 순매수ㄷㄷ','#FF3B30'],
        [22,'2600 역대 최고!!! 신고가!!!','#FFD700'],
        [27,'이게 진짜 상승장이다!!!','#FF3B30']]},
  { name:'12월', count:32, safe:3,
    blueExtra:0.15, rise:1.8, maxBlue:3, riseRange:14, blueDelay:6, bMin:15, bRange:50,
    wp:[[0,2600],[0.2,2700],[0.45,2750],[0.7,2800],[0.9,2850],[1,2873]],
    ev:[[4,'2700 돌파!!! 꿈인가??','#FF3B30'],
        [10,'2800!!!! 미쳤다미쳤어','#FFD700'],
        [16,'삼전 풀매수!! 성과급 들어온다','#FF3B30'],
        [22,'코스피 연간 +30%!! 개미 만세!!','#FFD700'],
        [28,'🐜 2873!! 역대 최고가!! 📈🚀','#FFD700']]}
];

// ─── Level Config ───
const LEVELS = [
  { months:MONTHS_H1, title:'2020 상반기', sub:'동학개미전쟁',
    priceBase:1400, priceSpan:800,
    tints:['#FFD700','#007AFF','#007AFF','#FF3B30','#FFD700','#FFD700'] },
  { months:MONTHS_H2, title:'2020 하반기', sub:'BBIG와 백신 랠리',
    priceBase:2050, priceSpan:900,
    tints:['#FFD700','#007AFF','#007AFF','#007AFF','#FFD700','#FFD700'] }
];
let currentLevel = 0;
let MONTHS = MONTHS_H1;
let unlockedLevel = 0;
try { unlockedLevel = parseInt(localStorage.getItem('antcoin-unlocked')) || 0; } catch(e) {}

let decoCandles = [];
function generateDecoCandles() {
  decoCandles = [];
  const count = Math.floor(W / CSTEP) + 4;
  const startX = -CSTEP;
  const midY = H * 0.55;
  let price = midY;
  for (let i = 0; i < count; i++) {
    const x = startX + i * CSTEP;
    price += (Math.random() - 0.5) * 40;
    price = Math.max(H * 0.25, Math.min(H * 0.75, price));
    const isRed = Math.random() < 0.55;
    const bH = 20 + Math.random() * 40;
    const topY = price - bH / 2;
    decoCandles.push({
      x, topY, botY: topY + bH, bodyH: bH,
      wickTop: topY - 6 - Math.random() * 14,
      wickBot: topY + bH + 4 + Math.random() * 10,
      isRed, crumbleTimer: -1, crumbleOff: 0, opacity: 1,
      scored: false, idx: i, month: 0
    });
  }
}

function renderStartScreen() {
  const lvl = LEVELS[currentLevel];
  const el = (id) => document.getElementById(id);
  el('ss-num').textContent = String(currentLevel + 1).padStart(2, '0');
  el('ss-period').textContent = lvl.title;
  el('ss-sub').textContent = lvl.sub;
  let lvlBest = 0;
  try { lvlBest = parseFloat(localStorage.getItem('antcoin-best-' + currentLevel)) || 0; } catch(e) {}
  el('ss-best').textContent = 'BEST ' + (lvlBest >= 0 ? '+' : '') + lvlBest.toFixed(1) + '%';
  const dotsEl = el('ss-dots');
  if (LEVELS.length > 1) {
    let dots = '';
    for (let i = 0; i <= unlockedLevel && i < LEVELS.length; i++) {
      dots += '<div class="ss-dot' + (i === currentLevel ? ' active' : '') + '" onclick="switchLevel(' + i + ')"></div>';
    }
    dotsEl.innerHTML = dots;
    dotsEl.style.display = '';
  } else {
    dotsEl.style.display = 'none';
  }
}
window.switchLevel = function(i) {
  if (i >= 0 && i <= unlockedLevel && i < LEVELS.length) {
    currentLevel = i;
    generateDecoCandles();
    renderStartScreen();
  }
};

function replayLevel() {
  selectLevel(currentLevel);
}

function nextLevel() {
  if (currentLevel + 1 < LEVELS.length) selectLevel(currentLevel + 1);
  else showStart();
}

// ─── State ───
let state = 'start';
let winReady = false;
let camX = 0;
let score = 0, best = 0;
let sanghan = 0, maxSanghan = 0;
let shakeX = 0, shakeY = 0;
let frame = 0, deadFrame = 0;
let freezeFrames = 0;
let flashAlpha = 0;
let popText = '', popTextTimer = 0, popTextColor = '#FF3B30';
let monthPopText = '', monthPopTimer = 0;
let monthTintColor = '', monthTintAlpha = 0;
let eventText = '', eventTimer = 0, eventColor = '#FF3B30';
let curMonth = 0;
let totalCandles = 0;
let monthStarts = [];
let allEvents = [];
let triggeredEvents = new Set();
let monthScores = [];
let prevMonthScore = 0;
let deathCause = 'fall';

const DEATH_MSG_BLUE = [
  '파란 캔들에 당했다',
  '하락장에 휩쓸렸다',
  '물렸다...',
  '반토막 났다',
  '계좌가 녹고 있다',
  '지하실로 내려갑니다',
  '지하 1층은 시작일 뿐',
  '더 밑이 있었다',
];
const DEATH_MSG_FALL = [
  '바닥을 뚫었다',
  '지지선이 무너졌다',
  '손절 타이밍을 놓쳤다',
  '총알이 다 떨어졌다',
  '마이너스의 손',
];
const DEATH_MSG_GENERIC = [
  '오늘 장은 여기까지',
  '다음엔 더 잘할 수 있다',
  '수업료였을 뿐',
];
function getDeathMessage(cause) {
  const pool = cause === 'blue' ? DEATH_MSG_BLUE : DEATH_MSG_FALL;
  const all = pool.concat(DEATH_MSG_GENERIC);
  return all[Math.floor(Math.random() * all.length)];
}
const floatingTexts = [];
function spawnFloatText(x, y, text, color) {
  floatingTexts.push({ x, y, text, color, life: 1 });
}

const TITLES = [
  [0, '안전 개미'],
  [15, '개미 투자자'],
  [30, '슈퍼개미'],
  [50, '큰손 개미'],
  [70, '동학개미 영웅'],
  [90, '워렌 개미핏']
];
function getTitle(score) {
  let t = TITLES[0][1];
  for (const [min, name] of TITLES) { if (score >= min) t = name; }
  return t;
}

function loadBest() {
  try { best = parseFloat(localStorage.getItem('antcoin-best-' + currentLevel)) || 0; } catch(e) { best = 0; }
  document.getElementById('hb').textContent = '+' + best.toFixed(1) + '%';
}
loadBest();

// ─── Candle Helpers ───
function wpLerp(wp, t) {
  t = Math.max(0, Math.min(1, t));
  for (let i = 0; i < wp.length - 1; i++) {
    if (t <= wp[i+1][0]) {
      const s = (t - wp[i][0]) / (wp[i+1][0] - wp[i][0]);
      return wp[i][1] + s * (wp[i+1][1] - wp[i][1]);
    }
  }
  return wp[wp.length-1][1];
}

function priceToY(price) {
  const lv = LEVELS[currentLevel];
  return H * 0.88 - (price - lv.priceBase) * (H * 0.45) / lv.priceSpan;
}

// ─── Candles ───
let candles = [];

function initCandles() {
  candles = [];
  monthStarts = [];
  allEvents = [];
  let gIdx = 0;
  let blueRun = 0;
  let prevPrice = 0;

  for (let m = 0; m < MONTHS.length; m++) {
    monthStarts.push(gIdx);
    const mo = MONTHS[m];

    for (const ev of mo.ev) {
      allEvents.push({ idx: gIdx + ev[0], text: ev[1], color: ev[2] });
    }

    for (let i = 0; i < mo.count; i++) {
      const x = 100 + gIdx * CSTEP;
      const t = mo.count > 1 ? i / (mo.count - 1) : 0;
      const basePrice = wpLerp(mo.wp, t);
      const price = basePrice + (Math.random() - 0.5) * 25;

      let isRed = i === 0 ? true : price >= prevPrice;

      // Safe start: first N candles forced red
      if (i < mo.safe) isRed = true;
      // Last 3 candles of last month forced red (safe ending)
      else if (m === MONTHS.length - 1 && i >= mo.count - 3) isRed = true;
      // Blue override for difficulty
      else if (isRed && mo.blueExtra > 0 && Math.random() < mo.blueExtra) isRed = false;

      // Max blue run
      if (!isRed) {
        blueRun++;
        if (blueRun > mo.maxBlue) { isRed = true; blueRun = 0; }
      } else {
        blueRun = 0;
      }

      const topY = priceToY(price);
      const bH = (mo.bMin || 20) + Math.random() * (mo.bRange || 35);

      candles.push({
        x, topY, botY: topY + bH, bodyH: bH,
        wickTop: topY - 6 - Math.random() * 14,
        wickBot: topY + bH + 4 + Math.random() * 10,
        isRed, crumbleTimer: -1, crumbleOff: 0, opacity: 1,
        scored: false, idx: gIdx, month: m
      });

      prevPrice = price;
      gIdx++;
    }
  }
  totalCandles = gIdx;
}

function recycleCandles() {
  for (const c of candles) {
    if (c.active !== false && c.x < camX - 200) c.active = false;
  }
}

// ─── Coin ───
const coin = {
  x:0, y:0, vx:0, vy:0,
  onGround:false, squashY:1, squashVel:0,
  rotation:0, lastGroundT:0, curCandle:null,
  expression:'normal',
  airJumps:0, onWall:false, wallDir:0, wallCandle:null
};

function resetCoin() {
  const c = candles[1] || candles[0];
  coin.x = c.x; coin.y = c.topY - CR;
  coin.vx = 0; coin.vy = 0;
  coin.onGround = true; coin.squashY = 1; coin.squashVel = 0;
  coin.rotation = 0; coin.lastGroundT = performance.now();
  coin.curCandle = c; coin.expression = 'normal';
  coin.airJumps = 0; coin.onWall = false; coin.wallDir = 0; coin.wallCandle = null;
}

// ─── Input ───
let jumpPressed = false, jumpHeld = false, jumpBufTime = 0;

function onDown(e) {
  e.preventDefault();
  if (state === 'start') return;
  if (state === 'startjump') return;
  if (state === 'launching') return;
  if (state === 'paused') return;
  if (state === 'dead') {
    if (frame > deadFrame+8) {
      if (!winReady) { skipScorecard(); } else { showStart(); }
    }
    return;
  }
  if (state === 'win') return;
  if (touchHintShown) {
    document.getElementById('touch-hint').style.opacity = '0';
    touchHintShown = false;
  }
  if (tapHintShown) {
    tapHintCount++;
    if (tapHintCount >= 4) {
      document.getElementById('tap-hint').style.opacity = '0';
      tapHintShown = false;
    }
  }
  jumpPressed = true;
  jumpHeld = true;
  jumpBufTime = performance.now();
}
function onUp(e) {
  e.preventDefault();
  jumpHeld = false;
}

document.querySelector('.gc').addEventListener('pointerdown', onDown);
document.querySelector('.gc').addEventListener('pointerup', onUp);
document.getElementById('hud-right').addEventListener('pointerdown', function(e) { e.stopPropagation(); });
document.getElementById('hud-right').addEventListener('pointerup', function(e) { e.stopPropagation(); });
document.addEventListener('keydown', e => { if (e.code==='Space'&&!e.repeat) onDown(e); });
document.addEventListener('keyup', e => { if (e.code==='Space') onUp(e); });

// ─── Particles ───
const particles = [];
const MAX_PARTICLES = 150;
function spawnP(x,y,color,n,sp) {
  for (let i=0;i<n;i++) {
    if (particles.length >= MAX_PARTICLES) particles.shift();
    particles.push({
      x,y, vx:(Math.random()-0.5)*(sp||4), vy:-Math.random()*3-1,
      life:1, color, size:2+Math.random()*3
    });
  }
}
function updateP() {
  let write = 0;
  for (let i=0;i<particles.length;i++) {
    const p=particles[i];
    p.x+=p.vx; p.y+=p.vy; p.vy+=0.12; p.life-=0.02;
    if (p.life>0) { particles[write++]=p; }
  }
  particles.length = write;
}

function spawnDust(x, y, n) {
  for (let i=0;i<n;i++) {
    const dir = i < n/2 ? -1 : 1;
    particles.push({
      x, y, vx: dir*(1.5+Math.random()*3), vy: -Math.random()*0.8,
      life: 0.7+Math.random()*0.3, color:'rgba(255,255,255,0.25)', size:2+Math.random()*2
    });
  }
}

const airRings = [];

function shake(n) {
  shakeX=(Math.random()-0.5)*n;
  shakeY=(Math.random()-0.5)*n;
}

// ─── Events ───
function checkEvents() {
  for (const ev of allEvents) {
    if (triggeredEvents.has(ev.idx)) continue;
    const evX = 100 + ev.idx * CSTEP;
    if (coin.x >= evX - CSTEP) {
      triggeredEvents.add(ev.idx);
      eventText = ev.text;
      eventColor = ev.color;
      eventTimer = 100;
    }
  }

  // Update current month
  for (let m = MONTHS.length - 1; m >= 0; m--) {
    const mX = 100 + monthStarts[m] * CSTEP;
    if (coin.x >= mX - CSTEP) {
      if (m !== curMonth) {
        monthScores[curMonth] = score - prevMonthScore;
        prevMonthScore = score;
        curMonth = m;
        monthPopText = MONTHS[m].name;
        monthPopTimer = 60;
        monthTintColor = LEVELS[currentLevel].tints[m]; monthTintAlpha = 0.4;
        if (currentLevel === 0 && unlockedLevel === 0 && m === 2) {
          setTimeout(() => {
            if (state === 'playing') {
              document.getElementById('tap-hint').style.opacity = '1';
              tapHintShown = true;
              tapHintCount = 0;
            }
          }, 1500);
        }
      }
      break;
    }
  }
}

let launchTimer = 0;
function checkWin() {
  const lastX = 100 + (totalCandles - 1) * CSTEP;
  if (coin.x >= lastX && state === 'playing') {
    state = 'launching'; launchTimer = 0;
    coin.vy = 0; coin.expression = 'happy';
    shake(12);
    spawnP(coin.x, coin.y, 'rgba(255,215,0,0.8)', 20, 8);
    spawnP(coin.x, coin.y, 'rgba(255,59,48,0.6)', 15, 6);
  }
}

// ─── Game Logic ───
let touchHintShown = false;
let tapHintShown = false;
let tapHintCount = 0;
function selectLevel(lvl) {
  currentLevel = lvl;
  MONTHS = LEVELS[lvl].months;
  loadBest();
  startGame();
  const hint = document.getElementById('touch-hint');
  if (lvl === 0 && unlockedLevel === 0) {
    hint.style.opacity = '1';
    touchHintShown = true;
  } else {
    hint.style.opacity = '0';
    touchHintShown = false;
  }
}

window.toggleSound = function() {
  soundMuted = !soundMuted;
  document.getElementById('ss-sound').classList.toggle('muted', soundMuted);
  const pb = document.getElementById('pause-sound');
  if (pb) pb.classList.toggle('muted', soundMuted);
};

let paused = false;
let prevState = '';
let pendingAction = '';

window.togglePause = function() {
  if (state !== 'playing' && !paused) return;
  paused = !paused;
  const dd = document.getElementById('hud-dropdown');
  const dim = document.getElementById('pause-dim');
  const confirm = document.getElementById('pause-confirm');
  if (paused) {
    prevState = state;
    state = 'paused';
    dd.classList.add('vis');
    dim.classList.add('vis');
    confirm.classList.remove('vis');
  } else {
    state = prevState;
    dd.classList.remove('vis');
    dim.classList.remove('vis');
    confirm.classList.remove('vis');
  }
};

window.pauseRestart = function() {
  pendingAction = 'restart';
  document.getElementById('pause-confirm-text').textContent = '처음부터 다시할까요?';
  document.getElementById('pause-confirm').classList.add('vis');
  document.getElementById('pause-confirm-yes').onclick = function() {
    paused = false;
    document.getElementById('pause-confirm').classList.remove('vis');
    document.getElementById('hud-dropdown').classList.remove('vis');
    document.getElementById('pause-dim').classList.remove('vis');
    selectLevel(currentLevel);
  };
};

window.pauseHome = function() {
  pendingAction = 'home';
  document.getElementById('pause-confirm-text').textContent = '홈으로 돌아갈까요?';
  document.getElementById('pause-confirm').classList.add('vis');
  document.getElementById('pause-confirm-yes').onclick = function() {
    paused = false;
    document.getElementById('pause-confirm').classList.remove('vis');
    document.getElementById('hud-dropdown').classList.remove('vis');
    document.getElementById('pause-dim').classList.remove('vis');
    showStart();
  };
};

window.pauseConfirmNo = function() {
  document.getElementById('pause-confirm').classList.remove('vis');
  document.getElementById('hud-dropdown').classList.remove('vis');
  document.getElementById('pause-dim').classList.remove('vis');
  paused = false;
  state = prevState;
};

function showStart() {
  state = 'start'; paused = false;
  currentLevel = Math.min(unlockedLevel, LEVELS.length - 1);
  generateDecoCandles();
  camX = 0;
  renderStartScreen();
  document.getElementById('ss').classList.add('vis');
  document.getElementById('gs').classList.remove('vis');
  document.getElementById('ws').classList.remove('vis');
  document.getElementById('hud-dropdown').classList.remove('vis');
  document.getElementById('pause-dim').classList.remove('vis');
  document.getElementById('touch-hint').style.opacity = '0';
  document.getElementById('tap-hint').style.opacity = '0';
  document.querySelector('.hud').style.display = 'none';
  touchHintShown = false;
  tapHintShown = false;
}

function startGame() {
  state='playing'; camX=0; score=0; sanghan=0; maxSanghan=0; frame=0; freezeFrames=0;
  flashAlpha=0; popText=''; popTextTimer=0; eventText=''; eventTimer=0; monthPopText=''; monthPopTimer=0;
  curMonth=0; triggeredEvents=new Set(); monthScores=new Array(MONTHS.length).fill(0); prevMonthScore=0;
  particles.length=0; airRings.length=0; floatingTexts.length=0; jumpPressed=false; jumpHeld=false;
  initCandles(); resetCoin();
  monthPopText = MONTHS[0].name; monthPopTimer = 60;
  document.getElementById('ss').classList.remove('vis');
  document.getElementById('gs').classList.remove('vis');
  document.getElementById('ws').classList.remove('vis');
  document.querySelector('.hud').style.display = '';
  updateHUD();
}

let launchStartTimer = 0;
let launchStartY = 0;
let launchEndY = 0;
let launchJumpH = 80;
function tapToStart() {
  if (state !== 'start') return;
  initAudio();
  playJump();
  document.getElementById('ss').classList.remove('vis');
  state = 'startjump';
  launchStartTimer = 0;
}
document.getElementById('ss').addEventListener('click', function(e) {
  if (e.target.closest('.ss-sound') || e.target.closest('.ss-dot')) return;
  tapToStart();
});
document.getElementById('ss-sound').addEventListener('click', function(e) {
  e.stopPropagation();
  toggleSound();
});

let swipeStartX = 0;
document.getElementById('ss').addEventListener('touchstart', function(e) {
  swipeStartX = e.touches[0].clientX;
}, {passive:true});
document.getElementById('ss').addEventListener('touchend', function(e) {
  if (e.target.closest('.ss-sound') || e.target.closest('.ss-dot')) return;
  const dx = (e.changedTouches[0]?.clientX || 0) - swipeStartX;
  if (Math.abs(dx) > 50) {
    e.preventDefault();
    if (dx < 0 && currentLevel < unlockedLevel && currentLevel < LEVELS.length - 1) {
      switchLevel(currentLevel + 1);
    } else if (dx > 0 && currentLevel > 0) {
      switchLevel(currentLevel - 1);
    }
    return;
  }
  e.preventDefault();
  tapToStart();
});

function finalizeMonthScores() {
  monthScores[curMonth] = score - prevMonthScore;
}

function buildScorecard(isWin) {
  finalizeMonthScores();
  const maxMonth = isWin ? MONTHS.length : curMonth + 1;
  let rows = '';
  for (let m = 0; m < maxMonth; m++) {
    const col = monthScores[m] > 0 ? 'var(--red)' : 'var(--fg-dim)';
    rows += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;">'
      + '<span style="color:var(--fg-dim)">' + MONTHS[m].name + '</span>'
      + '<span class="sc-num" data-val="' + monthScores[m].toFixed(1) + '" style="color:'+col+';font-weight:600">+0.0%</span></div>';
  }
  if (!isWin) {
    for (let m = maxMonth; m < MONTHS.length; m++) {
      rows += '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;">'
        + '<span style="color:var(--fg-dim);opacity:0.3">' + MONTHS[m].name + '</span>'
        + '<span style="color:var(--fg-dim);opacity:0.3">—</span></div>';
    }
  }

  const comboBonus = maxSanghan * 1.0;
  const finalScore = score + comboBonus;
  let isNew = finalScore > best;
  if (isNew) { best=finalScore; try{localStorage.setItem('antcoin-best-'+currentLevel,best.toFixed(1));}catch(e){} }
  document.getElementById('hb').textContent='+'+best.toFixed(1)+'%';

  const title = getTitle(finalScore);
  const totalCol = isWin ? 'var(--gold)' : 'var(--fg)';
  const newBest = isNew ? '<div class="sc-reveal" style="color:var(--gold);font-size:13px;font-weight:600;margin-top:8px;opacity:0">새로운 최고 기록!</div>' : '';

  const comboRow = maxSanghan > 0
    ? '<div style="display:flex;justify-content:space-between;padding:3px 0;font-size:13px;color:var(--gold)">'
      + '<span>🔥 최대 콤보 x' + maxSanghan + '</span>'
      + '<span class="sc-num" data-val="' + comboBonus.toFixed(1) + '" style="font-weight:600">+0.0%</span></div>'
    : '';

  const header = '<div style="font-size:11px;font-weight:700;color:var(--fg-dim);letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">INVESTMENT REPORT</div>';

  const titleSection = isWin
    ? '<div style="font-size:24px;font-weight:800;color:var(--gold);margin-bottom:4px">개미는 강하다! 📈</div>'
      + '<div style="font-size:12px;color:var(--fg-dim);margin-bottom:4px">' + LEVELS[currentLevel].title + ' 클리어!</div>'
    : '<div style="font-size:20px;font-weight:800;color:var(--fg);margin-bottom:4px">' + getDeathMessage(deathCause) + ' 📉</div>'
      + '<div style="font-size:12px;color:var(--fg-dim);margin-bottom:4px">' + LEVELS[currentLevel].title + ' — ' + MONTHS[curMonth].name + '에서 탈락</div>';

  const titleBlock = isWin
    ? '<div class="sc-reveal" style="font-size:11px;color:var(--fg-dim);text-transform:uppercase;letter-spacing:1.5px;margin-top:16px;margin-bottom:4px;opacity:0">칭호</div>'
      + '<div class="sc-reveal" style="font-size:28px;font-weight:800;color:'+totalCol+';opacity:0">' + title + '</div>'
      + '<div class="sc-reveal" style="font-size:12px;color:var(--fg-dim);margin-top:4px;opacity:0">최고 +' + best.toFixed(1) + '%</div>'
    : '<div class="sc-reveal" style="font-size:12px;color:var(--fg-dim);margin-top:12px;opacity:0">최고 +' + best.toFixed(1) + '%</div>';

  return header
    + '<div style="margin-bottom:20px">' + titleSection + '</div>'
    + '<div style="font-size:36px;font-weight:800;color:'+totalCol+';margin-bottom:16px">'
    + '<span class="sc-num" data-val="' + finalScore.toFixed(1) + '">+0.0%</span></div>'
    + '<div style="width:220px;margin:0 auto 16px;background:rgba(255,255,255,0.04);border-radius:12px;padding:12px 16px">' + rows
    + comboRow
    + '</div>'
    + newBest
    + titleBlock;
}

let scorecardTimers = [];
let scorecardScreen = 'ws';
function animateScorecard(container, screenId) {
  scorecardTimers.forEach(id => clearInterval(id));
  scorecardTimers = [];
  scorecardScreen = screenId || 'ws';
  const nums = container.querySelectorAll('.sc-num');
  const reveals = container.querySelectorAll('.sc-reveal');
  let i = 0;
  function tickNum() {
    if (i >= nums.length) { revealNext(0); return; }
    const el = nums[i];
    const target = parseFloat(el.dataset.val);
    let cur = 0;
    const steps = 20;
    const inc = target / steps;
    const interval = setInterval(() => {
      cur += inc;
      if ((inc >= 0 && cur >= target) || (inc < 0 && cur <= target)) {
        cur = target;
        clearInterval(interval);
        el.textContent = '+' + cur.toFixed(1) + '%';
        i++;
        scorecardTimers.push(setTimeout(tickNum, 80));
      } else {
        el.textContent = '+' + cur.toFixed(1) + '%';
      }
    }, 15);
    scorecardTimers.push(interval);
  }
  function revealNext(j) {
    if (j >= reveals.length) {
      if (scorecardScreen === 'ws') {
        const btns = document.getElementById('ws-btns');
        if (btns) scorecardTimers.push(setTimeout(() => { btns.style.opacity = '1'; winReady = true; hideSkipBtn(); }, 400));
      } else {
        scorecardTimers.push(setTimeout(() => { winReady = true; hideSkipBtn(); }, 400));
      }
      return;
    }
    reveals[j].style.transition = 'opacity 0.3s';
    reveals[j].style.opacity = '1';
    scorecardTimers.push(setTimeout(() => revealNext(j + 1), 150));
  }
  scorecardTimers.push(setTimeout(tickNum, 300));
}

function hideSkipBtn() {
  const s1 = document.getElementById('ws-skip');
  const s2 = document.getElementById('gs-skip');
  if (s1) s1.style.opacity = '0';
  if (s2) s2.style.opacity = '0';
}

function skipScorecard() {
  scorecardTimers.forEach(id => { clearInterval(id); clearTimeout(id); });
  scorecardTimers = [];
  const id = scorecardScreen;
  const container = document.getElementById(id + '-inner');
  container.querySelectorAll('.sc-num').forEach(el => {
    el.textContent = '+' + parseFloat(el.dataset.val).toFixed(1) + '%';
  });
  container.querySelectorAll('.sc-reveal').forEach(el => {
    el.style.transition = 'none'; el.style.opacity = '1';
  });
  if (id === 'ws') {
    const btns = document.getElementById('ws-btns');
    if (btns) { btns.style.opacity = '1'; }
  }
  winReady = true;
  hideSkipBtn();
}

function die() {
  state='dead'; deadFrame=frame;
  coin.expression='scared'; shake(10);
  winReady = true;
  document.querySelector('.hud').style.display = 'none';
  document.getElementById('gs-inner').innerHTML = buildScorecard(false);
  const container = document.getElementById('gs-inner');
  container.querySelectorAll('.sc-num').forEach(el => {
    el.textContent = '+' + parseFloat(el.dataset.val).toFixed(1) + '%';
  });
  container.querySelectorAll('.sc-reveal').forEach(el => {
    el.style.opacity = '1';
  });
  const skipBtn = document.getElementById('gs-skip');
  if (skipBtn) skipBtn.style.display = 'none';
  setTimeout(()=>document.getElementById('gs').classList.add('vis'), 100);
}

function win() {
  state='win'; deadFrame=frame;
  coin.expression='happy'; shake(12);
  winReady = false;
  document.querySelector('.hud').style.display = 'none';
  if (currentLevel >= unlockedLevel && currentLevel + 1 < LEVELS.length) {
    unlockedLevel = currentLevel + 1;
    try { localStorage.setItem('antcoin-unlocked', unlockedLevel); } catch(e) {}
  }
  document.getElementById('ws-inner').innerHTML = buildScorecard(true);
  const btns = document.getElementById('ws-btns');
  btns.style.opacity = '0';
  const nextBtn = document.getElementById('ws-next');
  const retryBtn = document.querySelector('.win-btn.retry');
  const endMsg = document.getElementById('ws-end-msg');
  if (currentLevel + 1 >= LEVELS.length) {
    nextBtn.style.display = 'none';
    if (retryBtn) { retryBtn.style.background = 'var(--gold)'; retryBtn.style.color = '#000'; retryBtn.style.width = '100%'; }
    if (endMsg) { endMsg.style.display = ''; }
  } else {
    nextBtn.style.display = '';
    if (retryBtn) { retryBtn.style.background = ''; retryBtn.style.color = ''; retryBtn.style.width = ''; }
    if (endMsg) { endMsg.style.display = 'none'; }
    const nl = LEVELS[currentLevel + 1];
    const num = String(currentLevel + 2).padStart(2, '0');
    nextBtn.textContent = num + ' | ' + nl.title;
  }
  const skipBtn = document.getElementById('ws-skip');
  if (skipBtn) skipBtn.style.opacity = '0';
  spawnP(coin.x, coin.y-20, 'rgba(255,215,0,0.8)', 20, 8);
  spawnP(coin.x, coin.y-20, 'rgba(255,59,48,0.6)', 15, 6);
  setTimeout(()=>{
    document.getElementById('ws').classList.add('vis');
    animateScorecard(document.getElementById('ws-inner'), 'ws');
    if (skipBtn) setTimeout(() => { skipBtn.style.opacity = '1'; }, 200);
  }, 300);
}

function tryJump() {
  const now = performance.now();
  const coyote = !coin.onGround && !coin.onWall && (now-coin.lastGroundT < COYOTE);
  const buf = (now - jumpBufTime < BUFFER);
  const wantJump = jumpPressed || buf;

  if (wantJump) {
    if (coin.onWall) {
      coin.vy = WALL_JUMP_VY;
      coin.vx = WALL_JUMP_VX * coin.wallDir;
      coin.onWall = false;
      coin.wallCandle = null;
      coin.airJumps = 1;
      coin.squashY = 0.75;
      coin.squashVel = 0.12;
      jumpPressed = false;
      jumpBufTime = 0;
      spawnP(coin.x, coin.y, 'rgba(255,255,255,0.4)', 4, 3);
      playJump();
    } else if (coin.onGround || coyote) {
      coin.vy = JUMP_VY;
      coin.vx = JUMP_VX;
      coin.onGround = false;
      coin.airJumps = 0;
      coin.squashY = 0.7;
      coin.squashVel = 0.15;
      jumpPressed = false;
      jumpBufTime = 0;
      spawnP(coin.x, coin.y+CR, 'rgba(255,215,0,0.5)', 5, 3);
      playJump();
    } else if (coin.airJumps < MAX_AIR_JUMPS) {
      coin.vy = AIR_JUMP_VY[coin.airJumps];
      coin.airJumps++;
      coin.squashY = 0.65;
      coin.squashVel = 0.18;
      jumpPressed = false;
      jumpBufTime = 0;
      freezeFrames = 3;
      shake(4);
      spawnP(coin.x, coin.y+CR, 'rgba(255,215,0,0.6)', 8, 5);
      airRings.push({ x: coin.x, y: coin.y, r: CR, maxR: CR+30, life: 1 });
      playJump();
    }
  }
  jumpPressed = false;
}

function updateCoin() {
  if (coin.onWall) {
    coin.vy = Math.min(coin.vy + GRAV * 0.3, WALL_SLIDE_SPEED);
    coin.y += coin.vy;
    coin.vx = 0;
    coin.rotation *= 0.8;

    const wc = coin.wallCandle;
    if (wc && wc.opacity > 0.3) {
      const wcTop = wc.topY + wc.crumbleOff;
      const wcBot = wc.botY + wc.crumbleOff;
      if (coin.y + CR < wcTop || coin.y - CR > wcBot) {
        coin.onWall = false;
        coin.wallCandle = null;
      }
    } else {
      coin.onWall = false;
      coin.wallCandle = null;
    }
  } else {
    const g = coin.vy > 0 ? GRAV * FAST_FALL : GRAV;
    coin.vy += g;
    coin.y += coin.vy;

    if (!coin.onGround) {
      coin.x += coin.vx;
      coin.vx *= (1 - VX_FRICTION);
    } else {
      coin.vx = 0;
    }
  }

  coin.squashY += coin.squashVel;
  coin.squashVel += (1 - coin.squashY) * 0.35;
  coin.squashVel *= 0.78;

  if (!coin.onGround && !coin.onWall) {
    coin.rotation += coin.vy * 0.006 + coin.vx * 0.003;
  } else {
    coin.rotation *= 0.8;
  }

  if (coin.onWall) coin.expression = 'normal';
  else if (coin.vy > 6) coin.expression = 'scared';
  else if (sanghan >= 2) coin.expression = 'happy';
  else coin.expression = 'normal';

  coin.onGround = false;
  coin.curCandle = null;

  for (const c of candles) {
    if (c.active === false || c.opacity < 0.3) continue;
    const candL = c.x - CW/2, candR = c.x + CW/2;
    const candTop = c.topY + c.crumbleOff;
    const candBot = c.botY + c.crumbleOff;
    const coinL = coin.x - CR * 0.6;
    const coinR = coin.x + CR * 0.6;

    if (coinR > candL && coinL < candR) {
      if (coin.vy >= 0 && coin.y + CR >= candTop && coin.y + CR <= candTop + 18) {
        coin.y = candTop - CR;
        const landVel = coin.vy;
        coin.vy = 0;
        coin.vx = 0;
        coin.onGround = true;
        coin.onWall = false;
        coin.wallCandle = null;
        coin.lastGroundT = performance.now();
        coin.curCandle = c;
        coin.airJumps = 0;
        coin.squashY = 0.55 + Math.min(landVel * 0.008, 0.1);
        coin.squashVel = 0.2 + Math.min(landVel * 0.02, 0.15);

        spawnDust(c.x, candTop, 6);

        if (!c.isRed && c.crumbleTimer === -1) {
          c.crumbleTimer = MONTHS[c.month].blueDelay;
          spawnP(c.x, c.topY, 'rgba(0,122,255,0.6)', 4, 3);
        }
        if (!c.scored) {
          c.scored = true;
          const sanghanY = H * SANGHAN_Y_RATIO;
          if (c.isRed && candTop < sanghanY) {
            sanghan++;
            if (sanghan > maxSanghan) maxSanghan = sanghan;
            const bonus = 0.5 * sanghan;
            score += bonus;
            spawnFloatText(c.x, c.topY - 20, '+' + bonus.toFixed(1), '#FF3B30');
            spawnP(c.x, c.topY, 'rgba(255,59,48,0.7)', 6, 4);
            if (sanghan === 1) {
              popText = '상한가!';
              popTextTimer = 70;
              popTextColor = '#FF3B30';
              flashAlpha = 0.8;
              shake(5);
            } else {
              popText = '상한가 x' + sanghan + '!';
              popTextTimer = 70;
              popTextColor = '#FF3B30';
              flashAlpha = 1;
              shake(Math.min(4 + sanghan * 2, 12));
            }
            coin.expression = 'happy';
          } else {
            const pts = c.isRed ? 0.3 : 0.5;
            score += pts;
            spawnFloatText(c.x, c.topY - 20, '+' + pts.toFixed(1), c.isRed ? 'rgba(255,255,255,0.6)' : 'rgba(0,122,255,0.8)');
            if (sanghan > 0) sanghan = 0;
          }
          updateHUD();
        }
        break;
      }
    }

    if (!coin.onGround && coin.vy >= 0) {
      const coinCenter = coin.y;
      const inVertRange = coinCenter + CR > candTop + 5 && coinCenter - CR < candBot - 5;

      if (inVertRange) {
        if (coin.vx > 0 && coinR >= candL - 2 && coinR <= candL + 8 && coinL < candL) {
          coin.x = candL - CR * 0.6;
          coin.vx = 0;
          coin.onWall = true;
          coin.wallDir = 1;
          coin.wallCandle = c;
          coin.airJumps = 0;
          spawnP(coin.x, coin.y, 'rgba(255,255,255,0.3)', 2, 1);
          break;
        }
        if (coin.vx < 0 && coinL <= candR + 2 && coinL >= candR - 8 && coinR > candR) {
          coin.x = candR + CR * 0.6;
          coin.vx = 0;
          coin.onWall = true;
          coin.wallDir = -1;
          coin.wallCandle = c;
          coin.airJumps = 0;
          spawnP(coin.x, coin.y, 'rgba(255,255,255,0.3)', 2, 1);
          break;
        }
      }
    }
  }

  if (coin.y > H + 50) {
    deathCause = (coin.curCandle && !coin.curCandle.isRed) ? 'blue' : 'fall';
    die();
  }
}

function updateCandles() {
  for (const c of candles) {
    if (c.active === false) continue;
    if (c.crumbleTimer > 0) { c.crumbleTimer--; }
    else if (c.crumbleTimer === 0) {
      c.crumbleOff += 4;
      c.opacity -= 0.035;
      if (c.opacity <= 0) { c.opacity = 0; c.crumbleTimer = -2; }
      if (coin.curCandle === c) { coin.onGround = false; coin.curCandle = null; }
    }
    if (c.isRed && c.crumbleTimer === -1 && c.x > coin.x + CW && c.x < coin.x + CSTEP * MONTHS[c.month].riseRange) {
      const reachCap = coin.y - 180;
      if (c.topY > reachCap) {
        const mo = MONTHS[c.month];
        const base = c.bodyH > RED_RISE_TALL_THRESHOLD ? RED_RISE_TALL : RED_RISE_BASE;
        const speed = base * mo.rise;
        const next = c.topY - speed;
        const clamped = Math.max(next, reachCap);
        const delta = c.topY - clamped;
        c.topY -= delta;
        c.wickTop -= delta;
        c.botY -= delta;
        c.wickBot -= delta;
      }
    }
  }
}

function updateHUD() {
  document.getElementById('hs').innerHTML = '<span class="prefix">+</span>'+score.toFixed(1)+'%';
  document.getElementById('hc').innerHTML = sanghan >= 1 ? '<span class="prefix">X</span>'+sanghan : '';
}

// ─── Camera ───
function updateCamera() {
  const target = coin.x - W * 0.3;
  camX += (target - camX) * 0.1;
  if (camX < 0) camX = 0;
}

// ─── Rendering ───
function drawGrid() {
  const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
  bgGrad.addColorStop(0, '#08081a');
  bgGrad.addColorStop(0.5, '#0b0b14');
  bgGrad.addColorStop(1, '#0f0f12');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(255,255,255,0.025)';
  ctx.lineWidth = 1;
  for (let y=80; y<H; y+=60) {
    ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke();
  }
  const sanghanY = H * SANGHAN_Y_RATIO;
  ctx.strokeStyle = 'rgba(255,59,48,0.35)';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([8, 5]);
  ctx.beginPath(); ctx.moveTo(0, sanghanY); ctx.lineTo(W, sanghanY); ctx.stroke();
  ctx.setLineDash([]);

  ctx.font = '600 10px ' + fontFam;
  ctx.fillStyle = 'rgba(255,59,48,0.35)';
  ctx.textAlign = 'left';
  ctx.fillText('상한가', 8, sanghanY - 4);
}

function drawMonthLabels() {

  for (let m = 0; m < MONTHS.length; m++) {
    const sx = 100 + monthStarts[m] * CSTEP - camX;
    if (sx < -100 || sx > W + 100) continue;

    ctx.strokeStyle = 'rgba(255,255,255,0.08)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(sx, 0);
    ctx.lineTo(sx, H);
    ctx.stroke();
    ctx.setLineDash([]);
  }
}

function drawMonthPop() {
  if (monthPopTimer <= 0) return;
  monthPopTimer--;
  const total = 60;
  const t = (total - monthPopTimer) / total;

  let alpha, scale;
  if (t < 0.15) {
    const p = t / 0.15;
    scale = 0.5 + 0.6 * p;
    alpha = p;
  } else if (t < 0.5) {
    scale = 1.1 - 0.1 * ((t - 0.15) / 0.35);
    alpha = 1;
  } else {
    const p = (t - 0.5) / 0.5;
    scale = 1.0;
    alpha = 1 - p;
  }
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(W / 2, H * 0.15);
  ctx.scale(scale, scale);
  ctx.font = '900 48px ' + fontFam;
  ctx.fillStyle = '#fff';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.shadowColor = 'rgba(0,0,0,0.5)';
  ctx.shadowBlur = 12;
  ctx.fillText(monthPopText, 0, 0);
  ctx.shadowBlur = 0;
  ctx.restore();
}

function drawCandle(c) {
  if (c.active === false) return;
  const sx = c.x - camX;
  if (sx < -60 || sx > W+60) return;
  const a = c.opacity; if (a<=0) return;
  const off = c.crumbleOff;
  const gray = (state === 'start' || state === 'startjump');
  const col = gray
    ? `rgba(50,50,55,${a})`
    : c.isRed ? `rgba(255,59,48,${a})` : `rgba(0,122,255,${a})`;

  ctx.strokeStyle = gray ? `rgba(40,40,45,${a})` : `rgba(85,85,85,${a})`; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.moveTo(sx, c.wickTop+off); ctx.lineTo(sx, c.wickBot+off); ctx.stroke();

  if (!gray) { ctx.shadowColor=col; ctx.shadowBlur=10; }
  const bx=sx-CW/2, by=c.topY+off;
  ctx.fillStyle=col;
  ctx.beginPath(); ctx.roundRect(bx,by,CW,c.bodyH,3); ctx.fill();
  ctx.shadowBlur=0;

  if (!gray) {
    const grad=ctx.createLinearGradient(bx,by,bx,by+c.bodyH);
    grad.addColorStop(0, `rgba(255,255,255,${0.12*a})`);
    grad.addColorStop(0.4, 'rgba(255,255,255,0)');
    ctx.fillStyle=grad;
    ctx.beginPath(); ctx.roundRect(bx,by,CW,c.bodyH,3); ctx.fill();
  }
}

const coinTrail = [];
function updateTrail() {
  coinTrail.push({ x: coin.x, y: coin.y });
  if (coinTrail.length > 6) coinTrail.shift();
}
function drawTrail() {
  if (!coin.onGround && Math.abs(coin.vy) > 2) {
    for (let i = 0; i < coinTrail.length; i++) {
      const t = coinTrail[i];
      const a = (i / coinTrail.length) * 0.2;
      ctx.globalAlpha = a;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath();
      ctx.arc(t.x - camX, t.y, CR * (0.4 + 0.4 * i / coinTrail.length), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
function drawCoin() {
  const cx=coin.x-camX, cy=coin.y, r=CR;
  ctx.save();
  ctx.translate(cx,cy);
  if (coin.onWall) {
    ctx.scale(1, 0.9);
    ctx.rotate(coin.wallDir * 0.15);
  } else {
    ctx.scale(1, coin.squashY);
    ctx.rotate(coin.rotation);
  }

  ctx.shadowColor='rgba(255,215,0,0.5)'; ctx.shadowBlur=16;
  ctx.fillStyle='#FFD700';
  ctx.beginPath(); ctx.arc(0,0,r,0,Math.PI*2); ctx.fill();
  ctx.shadowBlur=0;

  ctx.strokeStyle='rgba(255,180,0,0.6)'; ctx.lineWidth=1.5;
  ctx.beginPath(); ctx.arc(0,0,r*0.72,0,Math.PI*2); ctx.stroke();

  const ex=coin.expression;

  ctx.fillStyle='#1a1a00';
  if (ex==='scared') {
    ctx.beginPath(); ctx.arc(-4,-2,3,0,Math.PI*2); ctx.arc(4,-2,3,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.9)';
    ctx.beginPath(); ctx.arc(-3.5,-3,1.2,0,Math.PI*2); ctx.arc(5,-3,1.2,0,Math.PI*2); ctx.fill();
  } else if (ex==='happy') {
    ctx.lineWidth=1.5; ctx.strokeStyle='#1a1a00';
    ctx.beginPath(); ctx.arc(-4,-2,2.5,-Math.PI,0); ctx.stroke();
    ctx.beginPath(); ctx.arc(4,-2,2.5,-Math.PI,0); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(-4,-2,2.5,0,Math.PI*2); ctx.arc(4,-2,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(-3,-3,1,0,Math.PI*2); ctx.arc(5,-3,1,0,Math.PI*2); ctx.fill();
  }

  ctx.strokeStyle='#1a1a00'; ctx.lineWidth=1.2; ctx.lineCap='round';
  ctx.beginPath(); ctx.moveTo(-4,-r*0.6); ctx.quadraticCurveTo(-8,-r*1.1,-10,-r*1.2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(4,-r*0.6); ctx.quadraticCurveTo(8,-r*1.1,10,-r*1.2); ctx.stroke();
  ctx.fillStyle='#1a1a00';
  ctx.beginPath(); ctx.arc(-10,-r*1.2,1.5,0,Math.PI*2); ctx.arc(10,-r*1.2,1.5,0,Math.PI*2); ctx.fill();

  ctx.strokeStyle='#1a1a00'; ctx.lineWidth=1.2;
  if (ex==='scared') { ctx.beginPath(); ctx.arc(0,3,3,0,Math.PI*2); ctx.stroke(); }
  else if (ex==='happy') { ctx.beginPath(); ctx.arc(0,1,4.5,0.1*Math.PI,0.9*Math.PI); ctx.stroke(); }
  else { ctx.beginPath(); ctx.arc(0,1,4,0.15*Math.PI,0.85*Math.PI); ctx.stroke(); }

  ctx.fillStyle='rgba(255,255,255,0.15)';
  ctx.beginPath(); ctx.ellipse(-4,-5,6,4,-0.3,0,Math.PI*2); ctx.fill();
  ctx.restore();
}

function drawParticles() {
  for (const p of particles) {
    ctx.globalAlpha=p.life; ctx.fillStyle=p.color;
    ctx.beginPath(); ctx.arc(p.x-camX, p.y, p.size*p.life, 0, Math.PI*2); ctx.fill();
  }
  for (let i=airRings.length-1;i>=0;i--) {
    const ring=airRings[i];
    ring.r += (ring.maxR-CR)*0.15;
    ring.life -= 0.06;
    if (ring.life<=0) { airRings.splice(i,1); continue; }
    ctx.globalAlpha=ring.life*0.5;
    ctx.strokeStyle='#FFD700'; ctx.lineWidth=2;
    ctx.beginPath(); ctx.arc(ring.x-camX, ring.y, ring.r, 0, Math.PI*2); ctx.stroke();
  }
  ctx.globalAlpha=1;

  for (let i=floatingTexts.length-1;i>=0;i--) {
    const ft=floatingTexts[i];
    ft.y -= 0.8; ft.life -= 0.018;
    if (ft.life<=0) { floatingTexts.splice(i,1); continue; }
    ctx.save();
    ctx.globalAlpha=Math.min(ft.life*2, 1);
    ctx.font='800 16px '+fontFam;
    ctx.fillStyle=ft.color;
    ctx.textAlign='center';
    ctx.shadowColor='rgba(0,0,0,0.6)'; ctx.shadowBlur=6;
    ctx.fillText(ft.text, ft.x-camX, ft.y);
    ctx.shadowBlur=0;
    ctx.restore();
  }
}

function drawBgOverlays() {


  if (flashAlpha > 0) {
    ctx.globalAlpha = flashAlpha * 0.25;
    ctx.fillStyle = '#FF3B30';
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    flashAlpha *= 0.85;
    if (flashAlpha < 0.01) flashAlpha = 0;
  }
  if (monthTintAlpha > 0) {
    ctx.globalAlpha = monthTintAlpha * 0.15;
    ctx.fillStyle = monthTintColor;
    ctx.fillRect(0, 0, W, H);
    ctx.globalAlpha = 1;
    monthTintAlpha *= 0.92;
    if (monthTintAlpha < 0.01) monthTintAlpha = 0;
  }

  if (popTextTimer > 0) {
    popTextTimer--;
    const a = Math.min(popTextTimer / 20, 1);
    const scale = 1 + (70 - popTextTimer) * 0.006;
    ctx.save();
    ctx.globalAlpha = a;
    ctx.translate(W/2, H*0.35);
    ctx.scale(scale, scale);
    ctx.font = '800 40px ' + fontFam;
    ctx.fillStyle = popTextColor;
    ctx.textAlign = 'center';
    ctx.shadowColor = popTextColor + 'B3';
    ctx.shadowBlur = 24;
    ctx.fillText(popText, 0, 0);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawFgOverlays() {
  if (eventTimer > 0) {
    eventTimer--;
  
    const a = eventTimer < 20 ? eventTimer / 20 : Math.min((100 - eventTimer) / 10, 1);
    const yOff = eventTimer > 80 ? (100 - eventTimer) * 1.5 : 0;
    ctx.save();
    const alpha = a * 0.5;
    ctx.font = '700 22px ' + fontFam;
    const r = parseInt(eventColor.slice(1,3),16);
    const g = parseInt(eventColor.slice(3,5),16);
    const b = parseInt(eventColor.slice(5,7),16);
    ctx.fillStyle = 'rgba('+r+','+g+','+b+','+alpha+')';
    ctx.textAlign = 'center';
    ctx.shadowColor = 'rgba(0,0,0,'+(alpha*0.3)+')';
    ctx.shadowBlur = 6;
    ctx.fillText(eventText, W/2, H*0.45 - yOff);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── Idle ───
function drawIdle(jumpFrame) {
  drawGrid();
  if (!decoCandles.length) generateDecoCandles();
  for (const c of decoCandles) drawCandle(c);

  const ic = decoCandles.reduce((best, c) => Math.abs(c.x - 100) < Math.abs(best.x - 100) ? c : best);
  if (ic) {
    let bounce;
    if (jumpFrame) {
      const t = jumpFrame / 30;
      bounce = -Math.sin(t * Math.PI) * 80;
    } else {
      bounce = Math.sin(frame*0.04)*3;
    }
    const cx=ic.x-camX, cy=ic.topY-CR+bounce;
    ctx.save(); ctx.translate(cx,cy);
    ctx.scale(1, 1+Math.sin(frame*0.04)*0.05);
    ctx.rotate(Math.sin(frame*0.02)*0.08);

    ctx.shadowColor='rgba(255,215,0,0.5)'; ctx.shadowBlur=16;
    ctx.fillStyle='#FFD700';
    ctx.beginPath(); ctx.arc(0,0,CR,0,Math.PI*2); ctx.fill(); ctx.shadowBlur=0;
    ctx.strokeStyle='rgba(255,180,0,0.6)'; ctx.lineWidth=1.5;
    ctx.beginPath(); ctx.arc(0,0,CR*0.72,0,Math.PI*2); ctx.stroke();

    ctx.fillStyle='#1a1a00';
    ctx.beginPath(); ctx.arc(-4,-2,2.5,0,Math.PI*2); ctx.arc(4,-2,2.5,0,Math.PI*2); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.8)';
    ctx.beginPath(); ctx.arc(-3,-3,1,0,Math.PI*2); ctx.arc(5,-3,1,0,Math.PI*2); ctx.fill();
    ctx.strokeStyle='#1a1a00'; ctx.lineWidth=1.2; ctx.lineCap='round';
    ctx.beginPath(); ctx.moveTo(-4,-CR*0.6); ctx.quadraticCurveTo(-8,-CR*1.1,-10,-CR*1.2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(4,-CR*0.6); ctx.quadraticCurveTo(8,-CR*1.1,10,-CR*1.2); ctx.stroke();
    ctx.fillStyle='#1a1a00';
    ctx.beginPath(); ctx.arc(-10,-CR*1.2,1.5,0,Math.PI*2); ctx.arc(10,-CR*1.2,1.5,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(0,1,4,0.15*Math.PI,0.85*Math.PI); ctx.stroke();
    ctx.fillStyle='rgba(255,255,255,0.15)';
    ctx.beginPath(); ctx.ellipse(-4,-5,6,4,-0.3,0,Math.PI*2); ctx.fill();
    ctx.restore();

    if (frame%14===0) spawnP(ic.x, ic.topY-CR*2, 'rgba(255,215,0,0.5)', 1, 2);
  }
  updateP(); drawParticles();
}

// ─── Main Loop ───
function loop() {
  frame++;
  shakeX *= 0.85; shakeY *= 0.85;
  ctx.clearRect(0,0,W,H);
  ctx.save(); ctx.translate(shakeX, shakeY);

  if (state==='start') {
    drawIdle();
  } else if (state==='startjump') {
    launchStartTimer++;
    if (launchStartTimer === 15) {
      MONTHS = LEVELS[currentLevel].months;
      loadBest();
      camX = 0; score = 0; sanghan = 0; maxSanghan = 0; freezeFrames = 0;
      flashAlpha = 0; popText = ''; popTextTimer = 0; eventText = ''; eventTimer = 0;
      monthPopText = ''; monthPopTimer = 0; curMonth = 0; triggeredEvents = new Set();
      monthScores = new Array(MONTHS.length).fill(0); prevMonthScore = 0;
      particles.length = 0; airRings.length = 0; floatingTexts.length = 0;
      jumpPressed = false; jumpHeld = false;
      initCandles();
    }
    if (launchStartTimer < 15) {
      drawGrid();
      for (const c of decoCandles) drawCandle(c);
    } else {
      drawGrid();
      drawBgOverlays(); drawFgOverlays(); drawMonthLabels();
      for (const c of candles) drawCandle(c);
    }
    const ic = decoCandles.reduce((best, c) => Math.abs(c.x - 100) < Math.abs(best.x - 100) ? c : best);
    if (launchStartTimer === 1 && ic) {
      launchStartY = ic.topY - CR;
    }
    if (launchStartTimer === 15) {
      const gc = candles[1];
      launchEndY = gc.topY - CR;
      const diff = launchStartY - launchEndY;
      launchJumpH = Math.max(80, (diff > 0 ? diff : 0) + 60);
    }
    if (ic) {
      let cy;
      if (launchStartTimer <= 15) {
        const t = launchStartTimer / 15;
        cy = launchStartY - Math.sin(t * Math.PI * 0.5) * launchJumpH;
      } else {
        const t = (launchStartTimer - 15) / 15;
        cy = (launchStartY - launchJumpH) + t * t * (launchEndY - (launchStartY - launchJumpH));
      }
      const cx = ic.x - camX;
      ctx.save(); ctx.translate(cx, cy);
      ctx.shadowColor = 'rgba(255,215,0,0.5)'; ctx.shadowBlur = 16;
      ctx.fillStyle = '#FFD700';
      ctx.beginPath(); ctx.arc(0, 0, CR, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,180,0,0.6)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, CR * 0.72, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#1a1a00';
      ctx.beginPath(); ctx.arc(-4, -2, 2.5, 0, Math.PI * 2); ctx.arc(4, -2, 2.5, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      ctx.beginPath(); ctx.arc(-3, -3, 1, 0, Math.PI * 2); ctx.arc(5, -3, 1, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1a1a00'; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(-4, -CR * 0.6); ctx.quadraticCurveTo(-8, -CR * 1.1, -10, -CR * 1.2); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(4, -CR * 0.6); ctx.quadraticCurveTo(8, -CR * 1.1, 10, -CR * 1.2); ctx.stroke();
      ctx.fillStyle = '#1a1a00';
      ctx.beginPath(); ctx.arc(-10, -CR * 1.2, 1.5, 0, Math.PI * 2); ctx.arc(10, -CR * 1.2, 1.5, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.arc(0, 1, 4, 0.15 * Math.PI, 0.85 * Math.PI); ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,0.15)';
      ctx.beginPath(); ctx.ellipse(-4, -5, 6, 4, -0.3, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    updateP(); drawParticles();
    if (launchStartTimer >= 30) {
      const gc = candles[1];
      coin.x = gc.x; coin.y = gc.topY - CR;
      coin.vx = 0; coin.vy = 0;
      coin.onGround = true; coin.squashY = 0.7; coin.squashVel = 0;
      coin.rotation = 0; coin.lastGroundT = performance.now();
      coin.curCandle = gc; coin.expression = 'normal';
      coin.airJumps = 0; coin.onWall = false; coin.wallDir = 0; coin.wallCandle = null;
      state = 'playing';
      monthPopText = MONTHS[0].name; monthPopTimer = 60;
      document.getElementById('ss').classList.remove('vis');
      document.getElementById('gs').classList.remove('vis');
      document.getElementById('ws').classList.remove('vis');
      document.querySelector('.hud').style.display = '';
      updateHUD();
      const hint = document.getElementById('touch-hint');
      if (currentLevel === 0 && unlockedLevel === 0) {
        hint.style.opacity = '1'; touchHintShown = true;
      } else {
        hint.style.opacity = '0'; touchHintShown = false;
      }
    }
  } else if (state==='playing') {
    if (freezeFrames > 0) { freezeFrames--; }
    else {
      tryJump();
      updateCoin();
      updateCamera();
      recycleCandles();
      updateCandles();
      checkEvents();
      checkWin();
      updateP();
    }

    updateTrail();
    drawGrid();
    drawBgOverlays();
    drawFgOverlays();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    drawTrail();
    drawCoin();
    drawParticles();
    drawMonthPop();
  } else if (state==='dead') {
    coin.vy += GRAV;
    coin.y += coin.vy;
    coin.rotation += 0.15;

    drawGrid();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    if (coin.y < H+100) drawCoin();
    updateP(); drawParticles();
  } else if (state==='launching') {
    launchTimer++;
    const accel = -1.2 - launchTimer * 0.15;
    coin.vy += accel;
    coin.y += coin.vy;
    coin.rotation += 0.02 * launchTimer;
    if (launchTimer % 2 === 0) {
      spawnP(coin.x, coin.y + 20, 'rgba(255,215,0,0.7)', 4, 3);
      spawnP(coin.x + (Math.random()-0.5)*16, coin.y + 25, 'rgba(255,59,48,0.5)', 3, 2);
    }
    updateP();
    drawGrid();
    drawBgOverlays();
    drawFgOverlays();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    if (coin.y > -100) drawCoin();
    drawParticles();
    if (coin.y < -200) win();
  } else if (state==='win') {
    updateP();
    drawGrid();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    drawParticles();
  } else if (state==='paused') {
    drawGrid();
    drawBgOverlays();
    drawFgOverlays();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    drawTrail();
    drawCoin();
    drawParticles();
  }

  ctx.restore();
  requestAnimationFrame(loop);
}

showStart();
loop();

// Expose globals for onclick handlers in HTML
window.replayLevel = replayLevel;
window.nextLevel = nextLevel;
window.selectLevel = selectLevel;

document.getElementById('ws').addEventListener('click', function(e) {
  if (e.target.closest('.win-btn')) return;
  if (e.target.closest('.skip-btn')) { if (!winReady) skipScorecard(); return; }
});
document.getElementById('gs').addEventListener('click', function(e) {
  if (e.target.closest('.skip-btn')) { if (!winReady) skipScorecard(); return; }
});
