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

// ─── 2021 H1 Month Data ───
const MONTHS_2021H1 = [
  { name:'1월', count:28, safe:5,
    blueExtra:0.05, rise:1.0, maxBlue:1, riseRange:8, blueDelay:8, bMin:18, bRange:40, gapExtra:0,
    wp:[[0,2976],[0.3,3000],[0.5,3050],[0.8,3100],[1,3064]],
    ev:[[0,'2021년! 코스피 3000시대 개막!🚀','#FFD700'],
        [5,'3000 역사적 첫 돌파!!!!!','#FFD700'],
        [10,'동학개미 1주년!! 우리가 해냈다','#FF3B30'],
        [16,'올해도 풀매수 간다!!','#FF3B30'],
        [22,'개미 예탁금 70조 돌파ㄷㄷ','#FF3B30']]},
  { name:'2월', count:28, safe:3,
    blueExtra:0.2, rise:1.3, maxBlue:2, riseRange:9, blueDelay:7, bMin:15, bRange:50, gapExtra:6,
    wp:[[0,3064],[0.2,3100],[0.5,3050],[0.8,2980],[1,3012]],
    ev:[[3,'미국 국채 금리 급등ㄷㄷ','#007AFF'],
        [8,'성장주 조정 시작...ㅠㅠ','#007AFF'],
        [14,'3000 깨질뻔ㅠㅠ 꽉잡아!!','#007AFF'],
        [20,'개미들 BTD!! 저가 매수!!','#FF3B30'],
        [24,'바닥 다졌다!! 반등 간다','#FF3B30']]},
  { name:'3월', count:30, safe:2,
    blueExtra:0.3, rise:1.5, maxBlue:3, riseRange:10, blueDelay:7, bMin:14, bRange:55, gapExtra:10,
    wp:[[0,3012],[0.2,2980],[0.45,3000],[0.7,3050],[1,3070]],
    ev:[[3,'금리 공포 계속...ㅠㅠ','#007AFF'],
        [8,'카카오뱅크 상장 준비 소식!!','#FF3B30'],
        [13,'개미 순매수 또 역대급ㄷㄷ','#FF3B30'],
        [18,'백신 접종 시작!! 🏥','#FFD700'],
        [23,'3000 회복!! 존버 승리!!','#FF3B30'],
        [27,'거래대금 줄었다...조용하네','#8E8E93']]},
  { name:'4월', count:28, safe:3,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:8, blueDelay:6, bMin:16, bRange:45, gapExtra:8,
    wp:[[0,3070],[0.3,3100],[0.5,3120],[0.7,3100],[1,3108]],
    ev:[[3,'박스권 시작... 3100 왔다갔다','#8E8E93'],
        [9,'거래량이 안 나온다ㅠㅠ','#8E8E93'],
        [15,'공매도 재개ㄷㄷ 개미 반발!!','#007AFF'],
        [21,'그래도 3000은 지켜!! 꽉잡아','#FF3B30']]},
  { name:'5월', count:30, safe:2,
    blueExtra:0.2, rise:1.2, maxBlue:2, riseRange:10, blueDelay:6, bMin:13, bRange:55, gapExtra:12,
    wp:[[0,3108],[0.3,3150],[0.5,3180],[0.7,3150],[1,3188]],
    ev:[[4,'셀인메이? 개미는 안 판다!!','#FF3B30'],
        [10,'코스피 지루하다... 박스권ㅠ','#8E8E93'],
        [16,'개미 이탈 시작?? 거래량↓','#007AFF'],
        [22,'횡보장에서 버티는 게 실력이다','#8E8E93'],
        [26,'비트코인 폭락ㄷㄷ 주식은??','#007AFF']]},
  { name:'6월', count:32, safe:2,
    blueExtra:0.25, rise:1.8, maxBlue:3, riseRange:14, blueDelay:5, bMin:14, bRange:55, gapExtra:6,
    wp:[[0,3188],[0.2,3220],[0.4,3250],[0.6,3280],[0.85,3300],[1,3302]],
    ev:[[3,'드디어 박스 탈출!! 가즈아!!','#FF3B30'],
        [8,'3200 돌파!! 신고가 행진!!','#FFD700'],
        [13,'삼전 8만원!! 국민주 만세','#FF3B30'],
        [18,'3300 찍었다!!!! 미쳤다!!','#FFD700'],
        [23,'반도체 슈퍼사이클 🔥🔥🔥','#FF3B30'],
        [28,'🐜 3302!! 역대 최고가!! 📈🚀','#FFD700']]}
];

// ─── 2021 H2 Month Data ───
const MONTHS_2021H2 = [
  { name:'7월', count:28, safe:5,
    blueExtra:0.1, rise:1.0, maxBlue:2, riseRange:8, blueDelay:7, bMin:16, bRange:45, gapExtra:4,
    wp:[[0,3302],[0.15,3305],[0.4,3280],[0.7,3230],[1,3202]],
    ev:[[0,'하반기 시작! 사상 최고가 3305!!','#FFD700'],
        [4,'역대 최고가 갱신!! 🚀🚀','#FFD700'],
        [10,'델타 변이 확산ㄷㄷ','#007AFF'],
        [16,'외국인 매도 폭탄...ㅠㅠ','#007AFF'],
        [22,'3200으로 후퇴... 괜찮겠지?','#007AFF']]},
  { name:'8월', count:28, safe:3,
    blueExtra:0.25, rise:1.2, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:55, gapExtra:6,
    wp:[[0,3202],[0.3,3150],[0.5,3050],[0.7,3000],[1,3130]],
    ev:[[3,'테이퍼링이 뭔데...ㅠㅠ','#007AFF'],
        [8,'양적완화 축소 공포!!','#007AFF'],
        [13,'3000 터치ㄷㄷ 4개월만에','#007AFF'],
        [18,'꽉 잡아!! 존버는 승리한다!!','#FF3B30'],
        [23,'반등했다!! 3100 회복!!','#FF3B30']]},
  { name:'9월', count:30, safe:2,
    blueExtra:0.35, rise:1.3, maxBlue:3, riseRange:10, blueDelay:6, bMin:13, bRange:55, gapExtra:8,
    wp:[[0,3130],[0.3,3100],[0.5,3050],[0.75,3000],[1,3069]],
    ev:[[3,'에버그란데 디폴트 위기!!!','#007AFF'],
        [8,'중국발 공포 글로벌 패닉ㄷㄷ','#007AFF'],
        [13,'카카오 -30% 실화??ㅠㅠ','#007AFF'],
        [18,'플랫폼 규제 공포...','#007AFF'],
        [23,'3100 무너졌다ㅠㅠㅠㅠ','#007AFF'],
        [27,'존버가 답인가...정말...','#8E8E93']]},
  { name:'10월', count:28, safe:2,
    blueExtra:0.3, rise:1.0, maxBlue:3, riseRange:8, blueDelay:5, bMin:12, bRange:60, gapExtra:10,
    wp:[[0,3069],[0.2,3020],[0.45,2980],[0.6,2950],[0.8,2940],[1,2970]],
    ev:[[3,'3000선 하회ㄷㄷ 반년만에','#007AFF'],
        [8,'삼전 7만원대... 연중 최저','#007AFF'],
        [13,'반도체 슈퍼사이클 끝??','#007AFF'],
        [18,'중국 전력난 + 인플레ㅠㅠ','#007AFF'],
        [23,'바닥이 어디야...ㅠㅠㅠ','#007AFF']]},
  { name:'11월', count:30, safe:2,
    blueExtra:0.35, rise:1.2, maxBlue:3, riseRange:10, blueDelay:5, bMin:12, bRange:60, gapExtra:10,
    wp:[[0,2970],[0.3,2950],[0.5,2920],[0.7,2880],[0.9,2840],[1,2840]],
    ev:[[3,'미국은 신고가인데 왜 우리만...','#007AFF'],
        [9,'S&P +27% vs 코스피 +3%ㅠ','#007AFF'],
        [15,'개미 사상 첫 월간 순매도ㄷㄷ','#007AFF'],
        [20,'개미 이탈 시작...ㅠㅠㅠ','#007AFF'],
        [25,'오미크론 변이 출현!!!','#007AFF'],
        [28,'글로벌 급락ㅠㅠㅠㅠㅠ','#007AFF']]},
  { name:'12월', count:32, safe:2,
    blueExtra:0.2, rise:1.5, maxBlue:2, riseRange:12, blueDelay:5, bMin:14, bRange:50, gapExtra:6,
    wp:[[0,2840],[0.2,2880],[0.4,2920],[0.6,2960],[0.8,2980],[1,2977]],
    ev:[[3,'반도체 중심 반등 시도!!','#FF3B30'],
        [8,'연말 랠리 올까??','#FF3B30'],
        [14,'개인 사상 최대 순매도ㅠ','#007AFF'],
        [20,'3000 회복 실패...ㅠㅠ','#007AFF'],
        [26,'올해 수익률 +3.6%... 이게 맞아?','#8E8E93'],
        [30,'🐜 그래도 개미는 포기 안 해 📉','#FFD700']]}
];

// ─── 2022 H1 Month Data ───
const MONTHS_2022H1 = [
  { name:'1월', count:28, safe:4,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:8, blueDelay:7, bMin:15, bRange:50, gapExtra:6, blueSink:0,
    wp:[[0,2990],[0.3,2950],[0.5,2850],[0.75,2770],[1,2730]],
    ev:[[0,'2022년! 올해는 회복이다...?','#8E8E93'],
        [5,'연준 긴축 시그널ㄷㄷ','#007AFF'],
        [10,'연초부터 떨어진다ㅠㅠ','#007AFF'],
        [18,'LG엔솔 상장!! 수급 충격','#007AFF'],
        [23,'고점 대비 -10%... 시작부터','#007AFF']]},
  { name:'2월', count:28, safe:2,
    blueExtra:0.25, rise:1.2, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:55, gapExtra:8, blueSink:0.1,
    wp:[[0,2730],[0.3,2720],[0.6,2680],[0.8,2710],[1,2700]],
    ev:[[3,'설마 전쟁이...?','#8E8E93'],
        [9,'우크라이나 전쟁 발발!!!','#007AFF'],
        [14,'유가 급등ㄷㄷ 인플레!!','#007AFF'],
        [20,'글로벌 공포... 2700 위태','#007AFF'],
        [24,'전쟁이 시장을 집어삼킨다','#007AFF']]},
  { name:'3월', count:28, safe:3,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:8, blueDelay:6, bMin:15, bRange:45, gapExtra:6, blueSink:0.2,
    wp:[[0,2700],[0.3,2720],[0.5,2740],[0.7,2760],[1,2750]],
    ev:[[3,'전쟁 충격 소화... 반등?','#FF3B30'],
        [10,'금리 인상 0.25%p 시작','#007AFF'],
        [16,'인플레가 문제다...','#8E8E93'],
        [22,'소폭 반등!! 숨 좀 쉬자','#FF3B30']]},
  { name:'4월', count:28, safe:2,
    blueExtra:0.25, rise:1.0, maxBlue:3, riseRange:9, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.3,
    wp:[[0,2750],[0.3,2730],[0.5,2710],[0.7,2700],[1,2690]],
    ev:[[3,'자이언트 스텝 예고ㄷㄷ','#007AFF'],
        [9,'0.5%p 인상한다고??!!','#007AFF'],
        [15,'인플레 8.5%!! 미쳤다','#007AFF'],
        [21,'성장주 박살ㅠㅠㅠ','#007AFF']]},
  { name:'5월', count:30, safe:2,
    blueExtra:0.35, rise:1.2, maxBlue:3, riseRange:10, blueDelay:5, bMin:12, bRange:60, gapExtra:10, blueSink:0.4,
    wp:[[0,2690],[0.2,2650],[0.45,2600],[0.65,2580],[0.85,2610],[1,2600]],
    ev:[[3,'루나 테라 대폭락!!!!!!','#007AFF'],
        [8,'40조가 3일만에 증발ㄷㄷ','#007AFF'],
        [13,'크립토 시장 붕괴!!','#007AFF'],
        [18,'투자 심리 완전 얼어붙음','#007AFF'],
        [23,'2600선마저 위험...ㅠㅠ','#007AFF'],
        [27,'바닥이 어디야 진짜로...','#007AFF']]},
  { name:'6월', count:32, safe:2,
    blueExtra:0.3, rise:1.5, maxBlue:3, riseRange:12, blueDelay:4, bMin:12, bRange:60, gapExtra:8, blueSink:0.4,
    wp:[[0,2600],[0.2,2550],[0.4,2480],[0.6,2400],[0.8,2350],[1,2333]],
    ev:[[3,'자이언트 스텝 현실화!!','#007AFF'],
        [8,'0.75%p!! 역대급 인상!!','#007AFF'],
        [13,'2500 붕괴ㅠㅠㅠㅠ','#007AFF'],
        [18,'2400도 무너졌다...','#007AFF'],
        [23,'상반기 -21.7%!! 32년 최악','#007AFF'],
        [28,'🐜 수업료가 너무 비싸다... 📉','#007AFF']]}
];

// ─── 2022 H2 Month Data ───
const MONTHS_2022H2 = [
  { name:'7월', count:28, safe:4,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:50, gapExtra:6, blueSink:0.4,
    wp:[[0,2333],[0.15,2291],[0.4,2350],[0.7,2420],[1,2450]],
    ev:[[3,'연중 최저 2291ㄷㄷ','#007AFF'],
        [8,'낙폭 과대!! 반등 온다!!','#FF3B30'],
        [14,'바닥 찍었나?? 줍줍!!','#FF3B30'],
        [20,'2400 회복!! 가보자!!','#FF3B30']]},
  { name:'8월', count:28, safe:2,
    blueExtra:0.25, rise:1.0, maxBlue:2, riseRange:8, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2450],[0.3,2480],[0.5,2500],[0.7,2480],[1,2470]],
    ev:[[3,'잭슨홀 미팅 주목!!','#8E8E93'],
        [9,'파월 매파 발언ㄷㄷ','#007AFF'],
        [15,'금리 더 올린다고??','#007AFF'],
        [21,'2400대에서 못 벗어난다ㅠ','#8E8E93']]},
  { name:'9월', count:30, safe:2,
    blueExtra:0.4, rise:1.3, maxBlue:3, riseRange:10, blueDelay:4, bMin:12, bRange:60, gapExtra:10, blueSink:0.4,
    wp:[[0,2470],[0.2,2400],[0.4,2350],[0.6,2280],[0.8,2200],[1,2155]],
    ev:[[3,'레고랜드 ABCP 사태!!!','#007AFF'],
        [8,'채권시장 패닉ㄷㄷㄷ','#007AFF'],
        [13,'돈줄이 마른다...ㅠㅠ','#007AFF'],
        [18,'2300도 무너졌다!!','#007AFF'],
        [23,'2200!! 끝이 안 보여ㅠ','#007AFF'],
        [28,'연중 최저 2155... 끝인가','#007AFF']]},
  { name:'10월', count:28, safe:2,
    blueExtra:0.3, rise:1.2, maxBlue:3, riseRange:10, blueDelay:4, bMin:12, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2155],[0.2,2200],[0.4,2230],[0.6,2250],[0.8,2270],[1,2290]],
    ev:[[3,'바닥 찍었다!! 반등!!','#FF3B30'],
        [8,'카카오 데이터센터 화재ㄷㄷ','#007AFF'],
        [13,'카카오 -30%... 또...ㅠ','#007AFF'],
        [18,'그래도 지수는 반등 중!!','#FF3B30'],
        [23,'2200에서 살아남은 개미들','#FF3B30']]},
  { name:'11월', count:30, safe:3,
    blueExtra:0.2, rise:1.5, maxBlue:2, riseRange:12, blueDelay:5, bMin:14, bRange:50, gapExtra:6, blueSink:0.4,
    wp:[[0,2290],[0.2,2350],[0.45,2400],[0.65,2440],[0.85,2460],[1,2470]],
    ev:[[3,'반등 시도!! 2400 간다!!','#FF3B30'],
        [9,'바닥 찍었나?? 기대감!!','#FF3B30'],
        [15,'연말 랠리 가능??','#FF3B30'],
        [22,'2400 회복!! 가즈아!!','#FF3B30'],
        [27,'아직 끝나지 않았다!!','#FF3B30']]},
  { name:'12월', count:32, safe:2,
    blueExtra:0.25, rise:1.8, maxBlue:3, riseRange:14, blueDelay:4, bMin:12, bRange:60, gapExtra:8, blueSink:0.4,
    wp:[[0,2470],[0.15,2440],[0.35,2380],[0.5,2330],[0.7,2280],[0.85,2250],[1,2236]],
    ev:[[3,'연말 랠리는 없었다...','#007AFF'],
        [8,'개인 순매도 지속ㅠㅠ','#007AFF'],
        [14,'3000은 꿈도 못 꿔...','#007AFF'],
        [20,'네이버 -53% 카카오 -54%','#007AFF'],
        [26,'연간 -25%... 2년치 수익 증발','#007AFF'],
        [30,'🐜 2236 마감... 내년엔... 📉','#8E8E93']]}
];

// ─── 2023 H1 Month Data ───
const MONTHS_2023H1 = [
  { name:'1월', count:28, safe:4,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:50, gapExtra:6, blueSink:0.3,
    wp:[[0,2236],[0.2,2300],[0.4,2380],[0.7,2420],[1,2450]],
    ev:[[0,'2023년! 올해는 진짜 반등!!','#FF3B30'],
        [5,'새해 첫 거래일 +2.5%!!','#FF3B30'],
        [10,'외국인 매수 폭탄ㄷㄷ','#FF3B30'],
        [18,'2400 회복!! 부활이다!!','#FF3B30'],
        [23,'작년 악몽은 끝났다!!','#FFD700']]},
  { name:'2월', count:28, safe:3,
    blueExtra:0.2, rise:1.0, maxBlue:2, riseRange:8, blueDelay:6, bMin:14, bRange:50, gapExtra:6, blueSink:0.4,
    wp:[[0,2450],[0.3,2440],[0.5,2430],[0.7,2440],[1,2430]],
    ev:[[3,'금리 인상 아직 안 끝남...','#007AFF'],
        [9,'횡보... 눈치 보는 중','#8E8E93'],
        [15,'미국 CPI 발표 주목','#8E8E93'],
        [22,'2400대 유지!! 선방이다','#FF3B30']]},
  { name:'3월', count:28, safe:3,
    blueExtra:0.25, rise:1.2, maxBlue:2, riseRange:9, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2430],[0.15,2380],[0.35,2350],[0.5,2400],[0.75,2460],[1,2480]],
    ev:[[3,'SVB 파산!!! 은행 위기??','#007AFF'],
        [8,'금융 공포 확산ㄷㄷ','#007AFF'],
        [13,'크레디트스위스까지??!!','#007AFF'],
        [18,'진정됐다!! V자 반등!!','#FF3B30'],
        [23,'위기를 기회로!! 줍줍!!','#FF3B30']]},
  { name:'4월', count:28, safe:3,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:50, gapExtra:6, blueSink:0.3,
    wp:[[0,2480],[0.3,2490],[0.6,2500],[0.8,2510],[1,2500]],
    ev:[[3,'2500 터치!! 가보자!!','#FF3B30'],
        [9,'2차전지 뭐야 이거??','#FFD700'],
        [15,'에코프로 신고가ㄷㄷ','#FFD700'],
        [22,'테마주의 시대가 왔다!!','#FF3B30']]},
  { name:'5월', count:30, safe:3,
    blueExtra:0.2, rise:1.2, maxBlue:2, riseRange:10, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2500],[0.2,2520],[0.45,2550],[0.7,2560],[1,2570]],
    ev:[[3,'에코프로 +600%!!!!!!','#FFD700'],
        [8,'2차전지 광풍ㄷㄷㄷ','#FFD700'],
        [13,'개미 몰려든다!! 거래량 폭발','#FF3B30'],
        [19,'나도 2차전지 샀다!!','#FF3B30'],
        [25,'2500 안착!! 올해는 다르다','#FF3B30']]},
  { name:'6월', count:32, safe:2,
    blueExtra:0.25, rise:1.5, maxBlue:3, riseRange:12, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2570],[0.3,2560],[0.5,2570],[0.7,2580],[1,2565]],
    ev:[[3,'AI 테마 합류!! 엔비디아!!','#FFD700'],
        [8,'반도체+2차전지 쌍끌이','#FF3B30'],
        [14,'거래량 역대급ㄷㄷ','#FF3B30'],
        [20,'상반기 +14.7%!! 부활!!','#FFD700'],
        [26,'🐜 개미의 반격이 시작됐다!! 🚀','#FFD700']]}
];

// ─── 2023 H2 Month Data ───
const MONTHS_2023H2 = [
  { name:'7월', count:28, safe:4,
    blueExtra:0.15, rise:1.0, maxBlue:2, riseRange:9, blueDelay:6, bMin:14, bRange:50, gapExtra:6, blueSink:0.3,
    wp:[[0,2565],[0.2,2590],[0.5,2620],[0.8,2625],[1,2630]],
    ev:[[3,'2차전지 최고조!!','#FFD700'],
        [8,'거래량 반도체 추월ㄷㄷ','#FFD700'],
        [14,'에코프로 시총 100조??!!','#FFD700'],
        [20,'모두가 2차전지를 산다','#FF3B30']]},
  { name:'8월', count:28, safe:2,
    blueExtra:0.3, rise:1.2, maxBlue:3, riseRange:9, blueDelay:5, bMin:13, bRange:55, gapExtra:8, blueSink:0.4,
    wp:[[0,2630],[0.2,2600],[0.45,2580],[0.7,2560],[1,2560]],
    ev:[[3,'2차전지 거품 경고!!','#007AFF'],
        [9,'에코프로 급락 시작ㅠ','#007AFF'],
        [14,'물린 개미들... 또...','#007AFF'],
        [20,'바닥인 줄 알고 샀는데ㅠ','#007AFF'],
        [24,'2600 깨졌다...','#007AFF']]},
  { name:'9월', count:30, safe:2,
    blueExtra:0.35, rise:1.3, maxBlue:3, riseRange:10, blueDelay:4, bMin:12, bRange:60, gapExtra:10, blueSink:0.5,
    wp:[[0,2560],[0.2,2530],[0.45,2500],[0.7,2480],[1,2460]],
    ev:[[3,'에코프로 반토막ㅠㅠㅠ','#007AFF'],
        [8,'2차전지 테마 붕괴!!','#007AFF'],
        [13,'개미 손실 눈덩이...','#007AFF'],
        [18,'미국 금리 동결!! 근데...','#8E8E93'],
        [23,'고금리 장기화 공포','#007AFF'],
        [28,'2500도 못 지켰다ㅠ','#007AFF']]},
  { name:'10월', count:28, safe:2,
    blueExtra:0.35, rise:1.2, maxBlue:3, riseRange:10, blueDelay:3, bMin:12, bRange:60, gapExtra:10, blueSink:0.5,
    wp:[[0,2460],[0.2,2400],[0.4,2350],[0.6,2300],[0.8,2280],[1,2280]],
    ev:[[3,'이스라엘-하마스 전쟁!!','#007AFF'],
        [8,'중동 리스크 확산ㄷㄷ','#007AFF'],
        [13,'유가 급등... 또 인플레?','#007AFF'],
        [18,'2300 붕괴ㅠㅠ','#007AFF'],
        [23,'연저점 2280... 작년 악몽 재현?','#007AFF']]},
  { name:'11월', count:30, safe:4,
    blueExtra:0.1, rise:1.5, maxBlue:2, riseRange:12, blueDelay:6, bMin:15, bRange:45, gapExtra:4, blueSink:0.2,
    wp:[[0,2280],[0.15,2350],[0.35,2420],[0.55,2480],[0.8,2520],[1,2535]],
    ev:[[3,'공매도 전면 금지!!!!!!','#FFD700'],
        [8,'하루 만에 +5%ㄷㄷㄷ','#FFD700'],
        [13,'개미 환호!! 드디어!!','#FF3B30'],
        [18,'2500 회복!! 기적이다!!','#FF3B30'],
        [23,'개미가 이겼다!!!!!','#FFD700'],
        [27,'반등 랠리 계속!!','#FF3B30']]},
  { name:'12월', count:32, safe:3,
    blueExtra:0.15, rise:1.8, maxBlue:2, riseRange:14, blueDelay:5, bMin:14, bRange:50, gapExtra:6, blueSink:0.3,
    wp:[[0,2535],[0.2,2560],[0.4,2590],[0.6,2620],[0.8,2640],[1,2655]],
    ev:[[3,'연말 랠리!! 산타가 왔다!!','#FF3B30'],
        [8,'외국인 순매수 전환!!','#FF3B30'],
        [14,'2600 돌파!!','#FFD700'],
        [20,'연간 +18.7%!! 부활의 해!!','#FFD700'],
        [26,'🐜 2655 마감!! 내년엔 3000?! 🚀','#FFD700'],
        [30,'개미는 포기하지 않는다!!','#FFD700']]}
];

// ─── Level Config ───
const LEVELS = [
  { months:MONTHS_H1, title:'2020 상반기', sub:'동학개미전쟁',
    priceBase:1400, priceSpan:800,
    tints:['#FFD700','#007AFF','#007AFF','#FF3B30','#FFD700','#FFD700'] },
  { months:MONTHS_H2, title:'2020 하반기', sub:'BBIG와 백신 랠리',
    priceBase:2050, priceSpan:900,
    tints:['#FFD700','#007AFF','#007AFF','#007AFF','#FFD700','#FFD700'] },
  { months:MONTHS_2021H1, title:'2021 상반기', sub:'3000시대와 박스권',
    priceBase:2900, priceSpan:500,
    tints:['#FFD700','#007AFF','#007AFF','#8E8E93','#8E8E93','#FFD700'] },
  { months:MONTHS_2021H2, title:'2021 하반기', sub:'3000의 저주',
    priceBase:2800, priceSpan:600,
    tints:['#FFD700','#007AFF','#007AFF','#007AFF','#007AFF','#8E8E93'] },
  { months:MONTHS_2022H1, title:'2022 상반기', sub:'끝없는 추락',
    priceBase:2200, priceSpan:900,
    tints:['#007AFF','#007AFF','#FF3B30','#007AFF','#007AFF','#007AFF'] },
  { months:MONTHS_2022H2, title:'2022 하반기', sub:'바닥을 찍다',
    priceBase:2100, priceSpan:500,
    tints:['#FF3B30','#8E8E93','#007AFF','#FF3B30','#FF3B30','#007AFF'] },
  { months:MONTHS_2023H1, title:'2023 상반기', sub:'에코프로 광풍',
    priceBase:2200, priceSpan:500,
    tints:['#FF3B30','#8E8E93','#007AFF','#FF3B30','#FFD700','#FFD700'] },
  { months:MONTHS_2023H2, title:'2023 하반기', sub:'거품과 반등',
    priceBase:2200, priceSpan:600,
    tints:['#FFD700','#007AFF','#007AFF','#007AFF','#FFD700','#FF3B30'] }
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
  const arrowL = el('ss-arrow-l');
  const arrowR = el('ss-arrow-r');
  if (arrowL) arrowL.style.display = currentLevel > 0 ? '' : 'none';
  if (arrowR) arrowR.style.display = (currentLevel < unlockedLevel && currentLevel < LEVELS.length - 1) ? '' : 'none';
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

function startCountdown(callback) {
  var overlay = document.getElementById('cd-overlay');
  var progress = document.getElementById('cd-progress');
  var numEl = document.getElementById('cd-num');
  var labelEl = document.getElementById('cd-label');
  var circumference = 2 * Math.PI * 52;

  progress.setAttribute('stroke-dashoffset', circumference);
  progress.setAttribute('stroke', 'var(--gold,#FFD700)');
  numEl.textContent = '3';
  numEl.style.fontSize = '48px';
  labelEl.textContent = '준비하세요';
  overlay.classList.add('vis');

  if (window.__toss && window.__toss.isAdSupported()) {
    window.__toss.preloadAd();
  } else if (window.__onestore && window.__onestore.preloadInterstitial) {
    window.__onestore.preloadInterstitial();
  }

  var startTime = null;
  var totalDur = 3000;

  function tick(ts) {
    if (!startTime) startTime = ts;
    var elapsed = ts - startTime;
    var p = Math.min(elapsed / totalDur, 1);
    var step = Math.min(Math.floor(elapsed / 1000), 2);
    numEl.textContent = String(3 - step);
    progress.setAttribute('stroke-dashoffset', circumference * (1 - p));

    if (p < 1) {
      requestAnimationFrame(tick);
    } else {
      numEl.textContent = 'GO';
      numEl.style.fontSize = '36px';
      labelEl.textContent = '';
      progress.setAttribute('stroke', '#4CD964');
      setTimeout(function() {
        overlay.classList.remove('vis');
        numEl.style.fontSize = '48px';
        if (callback) callback();
      }, 400);
    }
  }
  requestAnimationFrame(tick);
}

function nextLevel() {
  if (currentLevel + 1 >= LEVELS.length) { showStart(); return; }
  var next = currentLevel + 1;
  var afterAd = function() {
    selectLevel(next);
    state = 'countdown';
    startCountdown(function() { state = 'playing'; });
  };
  if (currentLevel === 4) {
    if (window.__toss && window.__toss.isAdSupported()) {
      window.__toss.showAd(afterAd);
    } else if (window.__onestore && window.__onestore.showInterstitial) {
      window.__onestore.showInterstitial(afterAd);
    } else {
      selectLevel(next);
    }
  } else {
    selectLevel(next);
  }
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
let candleXs = [];

function initCandles() {
  candles = [];
  candleXs = [];
  monthStarts = [];
  allEvents = [];
  let gIdx = 0;
  let blueRun = 0;
  let prevPrice = 0;
  let gapAccum = 0;

  for (let m = 0; m < MONTHS.length; m++) {
    monthStarts.push(gIdx);
    const mo = MONTHS[m];

    for (const ev of mo.ev) {
      allEvents.push({ idx: gIdx + ev[0], text: ev[1], color: ev[2] });
    }

    for (let i = 0; i < mo.count; i++) {
      if (i > 0 && mo.gapExtra) gapAccum += Math.random() * mo.gapExtra;
      const x = 100 + gIdx * CSTEP + gapAccum;
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
      candleXs.push(x);

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
      if (!winReady) { skipScorecard(); } else { selectLevel(currentLevel); }
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
    const evX = candleXs[ev.idx] || (100 + ev.idx * CSTEP);
    if (coin.x >= evX - CSTEP) {
      triggeredEvents.add(ev.idx);
      eventText = ev.text;
      eventColor = ev.color;
      eventTimer = 100;
    }
  }

  // Update current month
  for (let m = MONTHS.length - 1; m >= 0; m--) {
    const mX = candleXs[monthStarts[m]] || (100 + monthStarts[m] * CSTEP);
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
  const lastX = candleXs[totalCandles - 1] || (100 + (totalCandles - 1) * CSTEP);
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
  try { localStorage.setItem('antcoin-lastlevel', lvl); } catch(e) {}
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
  const pauseBtn = document.getElementById('hud-pause');
  if (paused) {
    prevState = state;
    state = 'paused';
    dd.classList.add('vis');
    dim.classList.add('vis');
    confirm.classList.remove('vis');
    pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><path d="M5 3l12 7-12 7V3z"/></svg>';
  } else {
    state = prevState;
    dd.classList.remove('vis');
    dim.classList.remove('vis');
    confirm.classList.remove('vis');
    pauseBtn.innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>';
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
    document.getElementById('hud-pause').innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>';
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
    document.getElementById('hud-pause').innerHTML = '<svg width="16" height="16" viewBox="0 0 20 20" fill="currentColor"><rect x="4" y="3" width="4" height="14" rx="1"/><rect x="12" y="3" width="4" height="14" rx="1"/></svg>';
    showStart();
  };
};

window.pauseConfirmNo = function() {
  document.getElementById('pause-confirm').classList.remove('vis');
};

function showStart() {
  state = 'start'; paused = false;
  let lastPlayed = 0;
  try { lastPlayed = parseInt(localStorage.getItem('antcoin-lastlevel')) || 0; } catch(e) {}
  currentLevel = Math.min(lastPlayed, unlockedLevel, LEVELS.length - 1);
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
let secretTaps = 0, secretTimer = 0;
function handleSecretTap(e) {
  e.stopPropagation();
  e.preventDefault();
  clearTimeout(secretTimer);
  secretTaps++;
  if (secretTaps >= 5) {
    secretTaps = 0;
    unlockedLevel = LEVELS.length - 1;
    try { localStorage.setItem('antcoin-unlocked', unlockedLevel); } catch(e2) {}
    renderStartScreen();
    shake(6);
  }
  secretTimer = setTimeout(() => { secretTaps = 0; }, 800);
}
document.querySelector('.ss-title').addEventListener('touchend', handleSecretTap);
document.querySelector('.ss-title').addEventListener('click', handleSecretTap);
document.getElementById('ss-arrow-l').addEventListener('click', function(e) {
  e.stopPropagation();
  if (currentLevel > 0) switchLevel(currentLevel - 1);
});
document.getElementById('ss-arrow-r').addEventListener('click', function(e) {
  e.stopPropagation();
  if (currentLevel < unlockedLevel && currentLevel < LEVELS.length - 1) switchLevel(currentLevel + 1);
});
document.getElementById('ss').addEventListener('click', function(e) {
  if (e.target.closest('.ss-sound') || e.target.closest('.ss-dot') || e.target.closest('.ss-title') || e.target.closest('.ss-arrow')) return;
  tapToStart();
});
document.getElementById('ss-sound').addEventListener('click', function(e) {
  e.stopPropagation();
  toggleSound();
});

let swipeStartX = 0, swipeDX = 0, swiping = false;
const ssMid = document.querySelector('.ss-mid');
const ssBottom = document.querySelector('.ss-bottom');
function setSwipeOffset(dx) {
  const clamped = Math.max(-120, Math.min(120, dx));
  const t = `translateX(${clamped}px)`;
  ssMid.style.transform = t;
  ssBottom.style.transform = t;
}
function snapBack() {
  ssMid.style.transition = 'transform 0.25s ease-out';
  ssBottom.style.transition = 'transform 0.25s ease-out';
  ssMid.style.transform = '';
  ssBottom.style.transform = '';
  setTimeout(() => {
    ssMid.style.transition = '';
    ssBottom.style.transition = '';
  }, 260);
}
document.getElementById('ss').addEventListener('touchstart', function(e) {
  swipeStartX = e.touches[0].clientX;
  swipeDX = 0;
  swiping = false;
  ssMid.style.transition = '';
  ssBottom.style.transition = '';
}, {passive:true});
document.getElementById('ss').addEventListener('touchmove', function(e) {
  swipeDX = e.touches[0].clientX - swipeStartX;
  if (Math.abs(swipeDX) > 10) swiping = true;
  if (swiping) setSwipeOffset(swipeDX);
}, {passive:true});
document.getElementById('ss').addEventListener('touchend', function(e) {
  if (e.target.closest('.ss-sound') || e.target.closest('.ss-dot') || e.target.closest('.ss-title') || e.target.closest('.ss-arrow')) return;
  if (swiping && Math.abs(swipeDX) > 40) {
    e.preventDefault();
    let switched = false;
    if (swipeDX < 0 && currentLevel < unlockedLevel && currentLevel < LEVELS.length - 1) {
      switchLevel(currentLevel + 1); switched = true;
    } else if (swipeDX > 0 && currentLevel > 0) {
      switchLevel(currentLevel - 1); switched = true;
    }
    if (!switched) snapBack();
    else { ssMid.style.transform = ''; ssBottom.style.transform = ''; }
    swiping = false;
    return;
  }
  ssMid.style.transform = ''; ssBottom.style.transform = '';
  swiping = false;
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
    const mo = MONTHS[c.month];
    if (!c.isRed && mo.blueSink && c.crumbleTimer !== -2) {
      const onIt = coin.curCandle === c;
      const nearPlayer = c.x > coin.x - CSTEP * 2 && c.x < coin.x + CSTEP * 5;
      if (onIt || nearPlayer) {
        const sinkSpeed = onIt ? mo.blueSink * 3 : mo.blueSink;
        const sinkFloor = H - 50;
        if (onIt || c.botY < sinkFloor) {
          c.topY += sinkSpeed;
          c.botY += sinkSpeed;
          c.wickTop += sinkSpeed;
          c.wickBot += sinkSpeed;
          if (onIt) coin.y += sinkSpeed;
        }
      }
      if (c.topY > H + 80) { c.opacity = 0; c.crumbleTimer = -2; }
    }
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

  if (state === 'start') {
    ctx.save();
    ctx.font = '800 160px ' + fontFam;
    ctx.fillStyle = 'rgba(255,215,0,0.30)';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(currentLevel + 1).padStart(2, '0'), W / 2, H / 2);
    ctx.restore();
  }
}

function drawMonthLabels() {

  for (let m = 0; m < MONTHS.length; m++) {
    const sx = (candleXs[monthStarts[m]] || (100 + monthStarts[m] * CSTEP)) - camX;
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
  ctx.translate(W / 2, H * 0.22);
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
let lastLoopTime = 0;
let loopTimeDebt = 0;
const FRAME_DUR = 1000 / 60;

function loop(timestamp) {
  requestAnimationFrame(loop);
  if (!timestamp) return;
  if (!lastLoopTime) { lastLoopTime = timestamp; return; }

  loopTimeDebt += timestamp - lastLoopTime;
  lastLoopTime = timestamp;

  if (loopTimeDebt < FRAME_DUR * 0.95) return;
  if (loopTimeDebt > FRAME_DUR * 5) loopTimeDebt = FRAME_DUR;
  loopTimeDebt -= FRAME_DUR;

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
  } else if (state==='countdown') {
    drawGrid();
    drawBgOverlays();
    drawFgOverlays();
    drawMonthLabels();
    for (const c of candles) drawCandle(c);
    drawCoin();
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
}

showStart();
requestAnimationFrame(loop);

// Expose globals for onclick handlers in HTML
window.replayLevel = replayLevel;
window.nextLevel = nextLevel;
window.selectLevel = selectLevel;
window.showStart = showStart;

// ONE store / Toss SDK 라이프사이클 훅
window.__gameHooks = {
  onPause: function(reason) {
    if (state === 'playing' && !paused) {
      window.togglePause();
    }
    if (audioCtx && audioCtx.state === 'running') audioCtx.suspend();
  },
  onResume: function(ringerSilent) {
    if (ringerSilent !== undefined && ringerSilent) {
      soundMuted = true;
      document.getElementById('ss-sound').classList.add('muted');
      const pb = document.getElementById('pause-sound');
      if (pb) pb.classList.add('muted');
    }
    if (audioCtx && audioCtx.state === 'suspended' && !soundMuted) audioCtx.resume();
  },
  onSave: function() {
    try { localStorage.setItem('antcoin-lastlevel', currentLevel); } catch(e) {}
  },
  onBack: function() {
    if (state === 'paused') {
      window.togglePause();
      return true;
    }
    if (state === 'playing') {
      window.togglePause();
      return true;
    }
    return false;
  },
};

document.getElementById('ws').addEventListener('click', function(e) {
  if (e.target.closest('.win-btn')) return;
  if (e.target.closest('.skip-btn')) { if (!winReady) skipScorecard(); return; }
});
document.getElementById('gs').addEventListener('click', function(e) {
  if (e.target.closest('.skip-btn')) { if (!winReady) skipScorecard(); return; }
});
