import {Input} from './input'
import {EMPTY, Observable, of, SubscribableOrPromise, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, expand, ignoreElements, map, tap} from 'rxjs/operators'
import {FindValueOperator} from 'rxjs/internal/operators/find'

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
  ignoreVersions: RegExp,
  cursor: string,
  token: string
): Observable<VersionInfo[]> {
  return getOldestVersions(
    owner,
    repo,
    packageName,
    2,
    ignoreVersions,
    cursor,
    token
  ).pipe(
    expand(value =>
      value.paginate
        ? getOldestVersions(
            owner,
            repo,
            packageName,
            2,
            ignoreVersions,
            value.cursor,
            token
          )
        : EMPTY
    ),
    map(value => value.versions),
    tap(value =>
      value.map(info =>
        console.log(`id0: ${info.id}, version: ${info.version}`)
      )
    )
  )
}

export function finalIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }
  if (input.hasOldestVersionQueryInfo()) {
    console.log(`in if`)
    return getVersionIds(
      input.owner,
      input.repo,
      input.packageName,
      input.ignoreVersions,
      '',
      input.token
    ).pipe(
      map(value => {
        const temp = input.numOldVersionsToDelete
        input.numOldVersionsToDelete =
          input.numOldVersionsToDelete - value.length
        return value.map(info => info.id).slice(0, temp)
      })
    )
  }

  return throwError(`no package id found`)
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
