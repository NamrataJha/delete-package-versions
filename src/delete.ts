import {Input} from './input'
import {Observable, of, SubscribableOrPromise, throwError} from 'rxjs'
import {deletePackageVersions, getOldestVersions} from './version'
import {concatMap, ignoreElements, map} from 'rxjs/operators'

export interface VersionInfo {
  id: string
  version: string
}

export interface QueryInfo {
  versions: VersionInfo[]
  cursor: string
  paginate: boolean
}

export function getVersionIds(input: Input): Observable<string[]> {
  if (input.packageVersionIds.length > 0) {
    return of(input.packageVersionIds)
  }

  if (input.hasOldestVersionQueryInfo()) {
    let DeleteIds: QueryInfo = {versions: [], cursor: '', paginate: false}
    let ResultIds: string[] = []
    getOldestVersions(
      input.owner,
      input.repo,
      input.packageName,
      input.numOldVersionsToDelete + input.minVersionsToKeep,
      '',
      input.token
    )
      .toPromise()
      .then(async result => {
        DeleteIds = result as QueryInfo

        console.log(
          `cursor: ${DeleteIds.cursor} and paginate: ${DeleteIds.paginate}`
        )
        DeleteIds.versions.map(value =>
          console.log(`id0: ${value.id}, version0: ${value.version}`)
        )

        //method call to check conditions
        ResultIds = ResultIds.concat(
          DeleteIds.versions
            .filter(value => !input.ignoreVersions.test(value.version))
            .map(value => value.id)
        )

        ResultIds.map(value => console.log(` inside subscribe id1: ${value}`))

        console.log(`ResultIds length0: ${ResultIds.length}`)

        while (
          ResultIds.length < input.numOldVersionsToDelete &&
          DeleteIds.paginate
        ) {
          console.log(`Call graphQL again`)

          await getOldestVersions(
            input.owner,
            input.repo,
            input.packageName,
            input.numOldVersionsToDelete + input.minVersionsToKeep,
            DeleteIds.cursor,
            input.token
          )
            .toPromise()
            .then(resultnew => {
              //DeleteIds = result as ArrayCast[]
              DeleteIds = resultnew as QueryInfo

              console.log(
                `cursor: ${DeleteIds.cursor} and paginate: ${DeleteIds.paginate}`
              )
              DeleteIds.versions.map(value =>
                console.log(`id0: ${value.id}, version0: ${value.version}`)
              )

              //method call to check conditions
              ResultIds = ResultIds.concat(
                DeleteIds.versions
                  .filter(value => !input.ignoreVersions.test(value.version))
                  .map(value => value.id)
              )

              ResultIds.map(value =>
                console.log(` inside subscribe id1: ${value}`)
              )
            })
          console.log(`end while`)
        }
        ResultIds.map(value => console.log(`ids3: ${value}`))
        return of(ResultIds)
      })
    ResultIds.map(value => console.log(`ids4: ${value}`))
    return of(ResultIds)
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
