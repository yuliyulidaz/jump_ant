import { graniteEvent, setDeviceOrientation, setScreenAwakeMode, loadFullScreenAd, showFullScreenAd } from '@apps-in-toss/web-framework';

// Portrait lock
try { setDeviceOrientation({ type: 'portrait' }); } catch(e) {}

// Keep screen on during gameplay
try { setScreenAwakeMode({ enabled: true }); } catch(e) {}

// Back button: block during gameplay, allow close on start screen
try {
  graniteEvent.addEventListener('backEvent', {
    onEvent: () => {
      const ss = document.getElementById('ss');
      if (ss && ss.classList.contains('vis')) {
        window.close();
      }
    },
    onError: () => {},
  });
} catch(e) {}

// Pause game audio when app goes to background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const audio = document.querySelector('audio');
    if (audio) audio.pause();
  }
});

// ─── Toss Fullscreen Ad ───
const TOSS_AD_GROUP_ID = 'ait-ad-test-interstitial-id';
let tossAdLoaded = false;
let tossAdSupported = false;

try {
  tossAdSupported = loadFullScreenAd.isSupported();
} catch(e) {
  tossAdSupported = false;
}

window.__toss = {
  isAdSupported: () => tossAdSupported && typeof loadFullScreenAd === 'function',
  preloadAd: function() {
    if (!tossAdSupported) return;
    tossAdLoaded = false;
    try {
      loadFullScreenAd({
        options: { adGroupId: TOSS_AD_GROUP_ID },
        onEvent: function(event) {
          if (event.type === 'loaded') {
            tossAdLoaded = true;
            console.log('[toss] 광고 프리로드 완료');
          }
        },
        onError: function(error) {
          console.log('[toss] 광고 프리로드 실패:', error);
        },
      });
    } catch(e) {
      console.log('[toss] loadFullScreenAd 호출 실패:', e);
    }
  },
  showAd: function(callback) {
    if (!tossAdSupported || !tossAdLoaded) {
      if (callback) callback();
      return;
    }
    try {
      showFullScreenAd({
        options: { adGroupId: TOSS_AD_GROUP_ID },
        onEvent: function(event) {
          if (event.type === 'dismissed' || event.type === 'failedToShow') {
            if (callback) callback();
            callback = null;
          }
        },
        onError: function(error) {
          console.log('[toss] 광고 표시 실패:', error);
          if (callback) callback();
          callback = null;
        },
      });
    } catch(e) {
      console.log('[toss] showFullScreenAd 호출 실패:', e);
      if (callback) callback();
    }
  },
};
