import {Input} from './input'
import {EMPTY, Observable, of, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, expand, map, tap} from 'rxjs/operators'

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
  numVersions: number,
  ignoreVersions: RegExp,
  cursor: string,
  token: string
): Observable<VersionInfo[]> {
  return getOldestVersions(
    owner,
    repo,
    packageName,
    numVersions,
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
            numVersions,
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
    return getVersionIds(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete,
      input.ignoreVersions,
      '',
      input.token
    ).pipe(
      map(value => {
        const temp = input.numOldVersionsToDelete
        input.numOldVersionsToDelete =
          input.numOldVersionsToDelete - value.length <= 0
            ? 0
            : input.numOldVersionsToDelete - value.length
        console.log(
          `temp: ${temp} numVersions: ${input.numOldVersionsToDelete}`
        )
        return value
          .filter(info => !input.ignoreVersions.test(info.version))
          .map(info => info.id)
          .slice(0, temp)
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
