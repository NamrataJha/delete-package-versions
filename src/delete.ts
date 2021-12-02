import {Input} from './input'
import {Observable, of, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, map} from 'rxjs/operators'

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    if (input.minVersionsToKeep < 0) {
      return getOldestVersions(
        input.owner,
        input.repo,
        input.packageName,
        input.numOldVersionsToDelete,
        input.token
      ).pipe(map(versionInfo => versionInfo.map(info => info.id)))
    }
  }

  return throwError(
    "Could not get packageVersionIds. Explicitly specify using the 'package-version-ids' input or provide the 'package-name' and 'num-old-versions-to-delete' inputs to dynamically retrieve oldest versions"
  )
}

export function deleteVersions(input: Input): Observable<boolean> {
  if (input.minVersionsToKeep > 0 && input.numOldVersionsToDelete > 1) {
    return throwError('Input combination is not valid.')
  }
  console.log(String(input.ignoreVersions))
  if (
    input.deletePreReleaseVersions == 'true' &&
    (input.numOldVersionsToDelete > 1 || String(input.ignoreVersions) != '^$')
  ) {
    return throwError('Input combination is not valid.')
  }

  if (input.minVersionsToKeep >= 0) {
    input.numOldVersionsToDelete = 100
  }

  if (input.deletePreReleaseVersions == 'true') {
    input.numOldVersionsToDelete = 100
    input.minVersionsToKeep =
      input.minVersionsToKeep > 0 ? input.minVersionsToKeep : 0
    input.ignoreVersions = new RegExp('^(0|[1-9]\\d*)((\\.(0|[1-9]\\d*))*)$')
  }

  if (!input.token) {
    return throwError('No token found')
  }

  if (input.numOldVersionsToDelete <= 0) {
    console.log(
      'Number of old versions to delete input is 0 or less, no versions will be deleted'
    )
    return of(true)
  }

  return getVersionIds(input).pipe(
    concatMap(ids => deletePackageVersions(ids, input.token))
  )
}
