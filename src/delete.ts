import {Input} from './input'
import {EMPTY, Observable, of, SubscribableOrPromise, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, expand, ignoreElements, map} from 'rxjs/operators'

export interface VersionInfo {
  id: string
  version: string
}

export interface QueryInfo {
  versions: VersionInfo[]
  cursor: string
  paginate: boolean
}

export function getVersionIds(
  owner: string,
  repo: string,
  packageName: string,
  cursor: string,
  token: string
): Observable<VersionInfo[]> {
  return getOldestVersions(owner, repo, packageName, 2, cursor, token).pipe(
    expand(value =>
      value.paginate
        ? getOldestVersions(owner, repo, packageName, 2, value.cursor, token)
        : EMPTY
    ),
    map(value => value.versions)
  )
}

export function finalIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }
  if (input.hasOldestVersionQueryInfo()) {
    getVersionIds(
      input.owner,
      input.repo,
      input.packageName,
      '',
      input.token
    ).pipe(
      map(value =>
        value.map(info =>
          console.log(`id0: ${info.id}, version0: ${info.version}`)
        )
      )
    )
  }
  return of(<string[]>[])
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

  return finalIds(input).pipe(
    concatMap(ids => deletePackageVersions(ids, input.token))
  )
}
