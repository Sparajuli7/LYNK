import { Capacitor } from '@capacitor/core'

const isIOS = Capacitor.getPlatform() === 'ios'

export const iosSpacing = {
  topPadding: isIOS
    ? 'calc(env(safe-area-inset-top, 44px) + 16px)'
    : '16px',
  bottomPadding: isIOS
    ? 'calc(env(safe-area-inset-bottom, 34px) + 80px)'
    : '80px',
  modalTopPadding: isIOS ? '24px' : '16px',
  stickyTopPadding: isIOS ? 'env(safe-area-inset-top, 44px)' : '0px',
}
