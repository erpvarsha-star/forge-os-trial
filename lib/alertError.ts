import { Alert, AlertButton } from 'react-native'
import type { TFunction } from 'i18next'
import { errorDetail, isTimeoutError } from './withTimeout'
import { clockSkewInfo } from './serverClock'
import type { CheckInLocationFailure } from './location'

// Every check-in / check-out / QR failure must tell the user something; the
// detail line makes a screenshot enough to find the cause.
export function alertError(t: TFunction, e: unknown, buttons?: AlertButton[]) {
  if (isTimeoutError(e)) {
    Alert.alert(t('common.error'), t('common.networkSlow'), buttons)
    return
  }
  const detail = errorDetail(e)
  Alert.alert(
    t('common.error'),
    detail ? `${t('common.somethingWentWrong')}\n${detail}` : t('common.somethingWentWrong'),
    buttons
  )
}

export function alertLocationFailure(t: TFunction, reason: CheckInLocationFailure, buttons?: AlertButton[]) {
  const key =
    reason === 'permission' ? 'worker.locationPermissionNeeded' : reason === 'services_off' ? 'worker.gpsOff' : 'worker.gpsNoFix'
  Alert.alert(t('common.error'), t(key), buttons)
}

export function invalidQrMessage(t: TFunction): string {
  const skew = clockSkewInfo()
  return skew ? `${t('worker.invalidQr')}\n${t('worker.clockWrong', skew)}` : t('worker.invalidQr')
}
