import {Input} from './input'
import {Observable, of, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, map} from 'rxjs/operators'

export interface ArrayCast {
  id: string
  version: string
}

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    let DeleteIds: ArrayCast[] = []
    const VersionIds = getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete + input.minVersionsToKeep,
      input.token
    ).subscribe(result => {
      //DeleteIds = result as ArrayCast[]
      DeleteIds = DeleteIds.concat(result as ArrayCast[])
      console.log(
        `DeleteIds: ${DeleteIds.map(value =>
          console.log(
            ` inside subscribe id: ${value.id} and version: ${value.version}`
          )
        )}`
      )
    })

    console.log(
      `DeleteIds: ${DeleteIds} - ${DeleteIds.map(value =>
        console.log(
          `outside subscribe id: ${value.id} and version: ${value.version}`
        )
      )}`
    )
    /*
    return getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete + input.minVersionsToKeep,
      input.token
    ).pipe(
      map(versionInfo => {
        const numberVersionsToDelete =
          versionInfo.length - input.minVersionsToKeep

        if (input.minVersionsToKeep > 0) {
          return numberVersionsToDelete <= 0
            ? []
            : versionInfo
                .filter(info => !input.ignoreVersions.test(info.version))
                .map(info => info.id)
                .slice(0, -input.minVersionsToKeep)
        } else {
          return numberVersionsToDelete <= 0
            ? []
            : versionInfo
                .filter(info => !input.ignoreVersions.test(info.version))
                .map(info => info.id)
                .slice(0, numberVersionsToDelete)
        }
      })
    )
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
