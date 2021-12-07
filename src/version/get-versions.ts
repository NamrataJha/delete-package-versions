import {GraphQlQueryResponse} from '@octokit/graphql/dist-types/types'
import {Observable, from, throwError, concat} from 'rxjs'
import {catchError, map} from 'rxjs/operators'
import {graphql} from './graphql'
import {Input} from '../input'

export interface VersionInfo {
  id: string
}

let paginationCursor = ''
let paginate = false

export interface GetVersionsQueryResponse {
  repository: {
    packages: {
      edges: {
        node: {
          name: string
          versions: {
            edges: {
              node: {
                id: string
                version: string
              }[]
            }
            pageInfo: {
              startCursor: string
              hasPreviousPage: boolean
            }
          }
        }
      }[]
    }
  }
}

const query = `
  query getVersions($owner: String!, $repo: String!, $package: String!, $last: Int!) {
    repository(owner: $owner, name: $repo) {
      packages(first: 1, names: [$package]) {
        edges {
          node {
            name
            versions(last: $last) {
              edges {
                node {
                  id
                  version
                }
              }
              pageInfo{
                startCursor
                hasPreviousPage
              }
            }
          }
        }
      }
    }
  }`

const paginatequery = `
  query getVersions($owner: String!, $repo: String!, $package: String!, $last: Int!, $after: String!) {
    repository(owner: $owner, name: $repo) {
      packages(first: 1, names: [$package]) {
        edges {
          node {
            name
            versions(last: $last, after: $after) {
              edges {
                node {
                  id
                  version
                }
              }
              pageInfo{
                startCursor
                hasPreviousPage
              }
            }
          }
        }
      }
    }
  }`

export function queryForOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  token: string
): Observable<GetVersionsQueryResponse> {
  if (!paginate) {
    console.log('graphql call without pagination')
    return from(
      graphql(token, query, {
        owner,
        repo,
        package: packageName,
        last: numVersions,
        headers: {
          Accept: 'application/vnd.github.packages-preview+json'
        }
      }) as Promise<GetVersionsQueryResponse>
    ).pipe(
      catchError((err: GraphQlQueryResponse) => {
        const msg = 'query for oldest version failed.'
        return throwError(
          err.errors && err.errors.length > 0
            ? `${msg} ${err.errors[0].message}`
            : `${msg} verify input parameters are correct`
        )
      })
    )
  } else {
    console.log('graphql call with pagination')
    return from(
      graphql(token, paginatequery, {
        owner,
        repo,
        package: packageName,
        last: numVersions,
        paginationCursor,
        headers: {
          Accept: 'application/vnd.github.packages-preview+json'
        }
      }) as Promise<GetVersionsQueryResponse>
    ).pipe(
      catchError((err: GraphQlQueryResponse) => {
        const msg = 'query for oldest version failed.'
        return throwError(
          err.errors && err.errors.length > 0
            ? `${msg} ${err.errors[0].message}`
            : `${msg} verify input parameters are correct`
        )
      })
    )
  }
}

/*Check in delete.ts

export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  minVersions: number,
  ignoreVersions: RegExp,
  token: string
): Observable<VersionInfo[]> {
  var deletable = new Observable<string[]>()
  var deleteVersionIds = queryForOldestVersions(
    owner,
    repo,
    packageName,
    100,
    token
  ).pipe(
    map(result => {
      // revisit this
      if (result.repository.packages.edges.length < 1) {
        throwError(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      const versions = result.repository.packages.edges[0].node.versions.edges
      const pageInfo = result.repository.packages.pageInfo

      console.log(`graphql call`)

      var tempVersions = versions
      .map(value => ({id: value.node.id, version: value.node.version}))
      .reverse()

      
    })
  )
}*/

/*
check here
export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  token: string,
  firstCall: boolean
): Observable<VersionInfo[]> {

  const firstCallResult = queryForOldestVersions(
    owner,
    repo,
    packageName,
    100,
    token
  )

  var paginate = false

  firstCallResult.pipe(
    map( result => {
      if (result.repository.packages.edges.length < 1){
        console.log(`packages: ${packageName} not found for owner: ${owner} in repo: ${repo}`)
        return []
      }
      const versions = result.repository.packages.edges[0].node.versions.edges



      if (versions.length < numVersions){
        console.log(
          `number of versions requested was: ${numVersions}, but found: ${versions.length}`
        )
      }

    })
  )
}
*/

/*
Original*/

export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  ignoreVersions: RegExp,
  token: string
): Observable<string[]> {
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    numVersions,
    token
  ).pipe(
    map(result => {
      console.log(`point 1`)
      if (result.repository.packages.edges.length < 1) {
        console.log(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      const versions =
        result.repository.packages.edges[0].node.versions.edges.node
      const paginationInfo =
        result.repository.packages.edges[0].node.versions.pageInfo

      paginationCursor = paginationInfo.startCursor
      paginate = paginationInfo.hasPreviousPage

      console.log(`cursor: ${paginationCursor}, paginate: ${paginate}`)
      if (versions.length !== numVersions) {
        console.log(
          `number of versions requested was: ${numVersions}, but found: ${versions.length}`
        )
      }

      return versions
        .filter(value => !ignoreVersions.test(value.version))
        .map(value => value.id)
        .reverse()
    })
  )
}

export function getRequiredVersions(input: Input): Observable<string[]> {
  let resultIds = new Observable<string[]>()
  console.log(`point 2`)
  //make first graphql call

  let temp = getOldestVersions(
    input.owner,
    input.repo,
    input.packageName,
    100,
    input.ignoreVersions,
    input.token
  )

  if (temp.pipe(map(value => value.length === 0))) {
    return throwError(
      `package: ${input.packageName} not found for owner: ${input.owner} in repo: ${input.repo}`
    )
  }
  const a = temp.pipe(map(value => value.length))
  const b = temp.pipe(map(value => value.length < input.numOldVersionsToDelete))
  console.log(`a: ${a}, b: ${b}, `)

  if (input.minVersionsToKeep < 0) {
    console.log('in if condition')
    while (
      resultIds.pipe(
        map(value => value.length < input.numOldVersionsToDelete)
      ) &&
      paginate
    ) {
      console.log('In loop for pagination')
      resultIds = concat(resultIds, temp)
      temp = getOldestVersions(
        input.owner,
        input.repo,
        input.packageName,
        100,
        input.ignoreVersions,
        input.token
      )
    }
  }

  return resultIds
}
