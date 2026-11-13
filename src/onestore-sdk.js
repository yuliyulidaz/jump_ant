// ONE store H5 Game SDK integration
// 원스토어 앱 안에서 실행될 때만 활성화, 일반 브라우저에서는 무시됨

const SDK_VERSION = 'v1.1.0';
const SDK_URL = `https://h5sdk.onestore.net/lib/${SDK_VERSION}/onestore-h5-sdk.min.js`;

let sdk = null;
let sdkReady = false;
let sdkCtx = {};
let adsSupported = false;

// game.js가 호출할 수 있도록 글로벌에 노출
window.__onestore = {
  isActive: () => sdkReady,
  getCtx: () => sdkCtx,
  quit: () => { if (sdk) sdk.quit(); },
  restart: () => { if (sdk) sdk.restart(); },
};

async function initOneStore() {
  let createSDK;
  try {
    const mod = await import(/* @vite-ignore */ SDK_URL);
    createSDK = mod.createSDK;
  } catch (e) {
    console.log('[onestore] SDK 로드 실패 (일반 브라우저에서는 정상):', e.message);
    return;
  }

  sdk = createSDK();

  // 라이프사이클 리스너: initializeAsync 전에 등록
  sdk.on('pause', (e) => {
    if (window.__gameHooks && window.__gameHooks.onPause) {
      window.__gameHooks.onPause(e.reason);
    }
  });

  sdk.on('resume', (e) => {
    if (window.__gameHooks && window.__gameHooks.onResume) {
      window.__gameHooks.onResume(e.ringerSilent);
    }
  });

  sdk.on('exit', () => {
    if (window.__gameHooks && window.__gameHooks.onSave) {
      window.__gameHooks.onSave();
    }
  });

  sdk.onBackPressed(() => {
    if (window.__gameHooks && window.__gameHooks.onBack) {
      return window.__gameHooks.onBack();
    }
    return false;
  });

  // 부트 플로우: init → loading → start
  try {
    const info = await sdk.initializeAsync();

    if (info.err) {
      console.log('[onestore] 미지원 환경:', info.err);
      return;
    }

    sdkCtx = info;

    // 로딩 진행률 (게임은 이미 로드 완료 상태이므로 바로 100)
    sdk.setLoadingProgress(100);

    await sdk.startGameAsync();
    sdkReady = true;
    console.log('[onestore] SDK 준비 완료, playerId:', info.playerId);

    adsSupported = sdk.ads.isSupported('interstitial');
    if (adsSupported) {
      sdk.ads.loadInterstitial({ placementId: 'x99DV-CRL5-NB6J-YS4T' });
    }

  } catch (e) {
    console.log('[onestore] 초기화 실패:', e.reason, e.message);
  }
}

window.__onestore.showInterstitial = function(callback) {
  if (!sdkReady || !sdk || !adsSupported) { if (callback) callback(); return; }
  try {
    sdk.ads.showInterstitial({
      placementId: 'x99DV-CRL5-NB6J-YS4T',
      onStart: function() {},
      onComplete: function() {
        sdk.ads.loadInterstitial({ placementId: 'x99DV-CRL5-NB6J-YS4T' });
        if (callback) callback();
      },
      onError: function() {
        sdk.ads.loadInterstitial({ placementId: 'x99DV-CRL5-NB6J-YS4T' });
        if (callback) callback();
      },
    });
  } catch (e) {
    if (callback) callback();
  }
};

initOneStore();
