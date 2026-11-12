import { graniteEvent, setDeviceOrientation, setScreenAwakeMode } from '@apps-in-toss/web-framework';

// Portrait lock
try { setDeviceOrientation({ type: 'portrait' }); } catch(e) {}

// Keep screen on during gameplay
try { setScreenAwakeMode({ enabled: true }); } catch(e) {}

// Back button: block during gameplay, allow close on start screen
graniteEvent.addEventListener('backEvent', {
  onEvent: () => {
    const ss = document.getElementById('ss');
    if (ss && ss.classList.contains('vis')) {
      window.close();
    }
  },
  onError: () => {},
});

// Pause game audio when app goes to background
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    const audio = document.querySelector('audio');
    if (audio) audio.pause();
  }
});
