import {Input} from './input'
import {asapScheduler, merge, Observable, of, scheduled, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions, VersionInfo} from './version'
import {concatMap, map, mergeAll} from 'rxjs/operators'

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    const res = getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete,
      input.ignoreVersions,
      '',
      input.token
    ).pipe(map(versionInfo => versionInfo.map(info => info.id)))

    console.log('main call')
    res.pipe(map(value => value.map(info => console.log(`package: ${info}`))))

    return res
  }

  return throwError(
    "Could not get packageVersionIds. Explicitly specify using the 'package-version-ids' input or provide the 'package-name' and 'num-old-versions-to-delete' inputs to dynamically retrieve oldest versions"
  )
}

export function deleteVersions(input: Input): Observable<boolean> {
  if (!input.token) {
    return throwError('No token found')
  }

  if (input.minVersionsToKeep > 0 && input.numOldVersionsToDelete > 1) {
    return throwError('Input combination is not valid.')
  }

  if (
    input.deletePreReleaseVersions == 'true' &&
    (input.numOldVersionsToDelete > 1 || String(input.ignoreVersions) != '/^$/')
  ) {
    return throwError('Input combination is not valid.')
  }

  if (input.deletePreReleaseVersions == 'true') {
    input.minVersionsToKeep =
      input.minVersionsToKeep > 0 ? input.minVersionsToKeep : 0
    input.ignoreVersions = new RegExp('^(0|[1-9]\\d*)((\\.(0|[1-9]\\d*))*)$')
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
