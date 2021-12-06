import {Input} from './input'
import {asapScheduler, merge, Observable, of, scheduled, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions, VersionInfo} from './version'
import {concatMap, map, mergeAll} from 'rxjs/operators'

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    console.log('check point 4')
    var deletable = new Observable<string[]>()
    if (input.minVersionsToKeep < 0) {
      console.log('check point 3')
      while (
        deletable.pipe(map(versionInfo => versionInfo.length)) !==
        of(input.numOldVersionsToDelete)
      ) {
        console.log('check point 2')
        var deleteVersionIds = getOldestVersions(
          input.owner,
          input.repo,
          input.packageName,
          2,
          input.token
        )

        scheduled(
          [
            deletable,
            deleteVersionIds.pipe(
              map(versionInfo =>
                versionInfo
                  .filter(info => !input.ignoreVersions.test(info.version))
                  .map(info => info.id)
                  .slice(0, input.numOldVersionsToDelete)
              )
            )
          ],
          asapScheduler
        ).pipe(mergeAll())
      }
    }
    console.log('check point 1')
    return deletable

    /*
      return getOldestVersions(
        input.owner,
        input.repo,
        input.packageName,
        input.numOldVersionsToDelete,
        input.token
      ).pipe(map(versionInfo => versionInfo.map(info => info.id)))
      */
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
