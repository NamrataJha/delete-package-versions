import {GraphQlQueryResponse} from '@octokit/graphql/dist-types/types'
import {Observable, from, throwError, EMPTY} from 'rxjs'
import {catchError, expand, map} from 'rxjs/operators'
import {graphql} from './graphql'

export interface VersionInfo {
  id: string
  version: string
}

export interface PageInfo {
  startCursor: string
  hasPreviousPage: boolean
}

export interface GetVersionsQueryResponse {
  repository: {
    packages: {
      edges: {
        node: {
          name: string
          versions: {
            edges: {
              node: VersionInfo
            }[]
            pageInfo: PageInfo
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
  query getVersions($owner: String!, $repo: String!, $package: String!, $last: Int!, $before: String!) {
    repository(owner: $owner, name: $repo) {
      packages(first: 1, names: [$package]) {
        edges {
          node {
            name
            versions(last: $last, before: $before) {
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
  pendingVersions: number,
  cursor: string,
  token: string
): Observable<GetVersionsQueryResponse> {
  console.log(`cursor: ${cursor}`)
  const noVersions =
    pendingVersions > numVersions ? numVersions : pendingVersions
  if (cursor === '') {
    console.log('graphql call without pagination')
    return from(
      graphql(token, query, {
        owner,
        repo,
        package: packageName,
        last: noVersions,
        before: cursor,
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
        last: pendingVersions,
        before: cursor,
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

export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  pendingVersions: number,
  ignoreVersions: RegExp,
  cursor: string,
  token: string
): Observable<VersionInfo[]> {
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    2,
    pendingVersions,
    cursor,
    token
  ).pipe(
    expand(({repository}) =>
      repository.packages.edges[0].node.versions.pageInfo.hasPreviousPage &&
      repository.packages.edges[0].node.versions.edges.length < pendingVersions
        ? queryForOldestVersions(
            owner,
            repo,
            packageName,
            2,
            pendingVersions -
              repository.packages.edges[0].node.versions.edges.length,
            repository.packages.edges[0].node.versions.pageInfo.startCursor,
            token
          )
        : EMPTY
    ),
    map(result => {
      console.log(`in map pending versions: ${pendingVersions}`)
      if (result.repository.packages.edges.length < 1) {
        console.log(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      const versionsInfo =
        result.repository.packages.edges[0].node.versions.edges

      pendingVersions = pendingVersions - versionsInfo.length

      return versionsInfo
        .filter(value => !ignoreVersions.test(value.node.version))
        .map(value => ({id: value.node.id, version: value.node.version}))
        .reverse()
    })
  )
}
/*
export function getOldestVersions(
  owner:string,
  repo: string,
  packageName: string,
  numVersions: number,
  ignoreVersions: RegExp,
  cursor: string,
  token: string
): Observable<VersionInfo>{
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    numVersions,
    cursor,
    token
  ).pipe(
    expand(({repository}) => repository.packages.edges[0].node.versions.pageInfo.paginate && repository.packages.edges[0].node.versions.edges.filter
    (value => !ignoreVersions.test(value.node.version)).length < numVersions ? queryForOldestVersions(owner, repo, packageName, numVersions,token) : EMPTY),
    
    )
    
    /*
    tap(result => {
      if (result.repository.packages.edges.length < 1) {
        console.log(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      let packageVersions = result.repository.packages.edges[0].node.versions.edges
      const resultPackages = packageVersions.node.filter(value => !ignoreVersions.test(value.version))

      let versionsPage = result.repository.packages.edges[0].node.versions.pageInfo

      if (versionsPage.hasPreviousPage){
        if(resultPackages.length < numVersions){
          //get next page
          concat(resultPackages.map(value => ({id: value.id, version: value.version})).reverse()
            , getOldestVersions(owner, repo, packageName, numVersions, ignoreVersions, versionsPage.startCursor, token))
        }
      }
      
      return resultPackages
      .map(value => ({id: value.id, version: value.version}))
      .reverse()
      
    })

/*
export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  ignoreVersions: RegExp,
  cursor: string,
  token: string
):Observable<VersionInfo[]> {
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    2,
    token
  ).pipe(
    map(result => {
      if (result.repository.packages.edges.length < 1) {
        console.log(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      let packageVersions = result.repository.packages.edges[0].node.versions.edges
      const resultPackages = packageVersions.node.filter(value => !ignoreVersions.test(value.version))

      let versionsPage = result.repository.packages.edges[0].node.versions.pageInfo

      if (versionsPage.hasPreviousPage){
        if(resultPackages.length < numVersions){
          //get next page
          concat(resultPackages.map(value => ({id: value.id, version: value.version})).reverse()
            , getOldestVersions(owner, repo, packageName, numVersions, ignoreVersions, versionsPage.startCursor, token))
        }
      }
      
      return resultPackages
      .map(value => ({id: value.id, version: value.version}))
      .reverse()
      
    })
    .
  )
}

*/

/*
export function getOldestVersions(
  owner: string,
  repo: string,
  packageName: string,
  numVersions: number,
  ignoreVersions: RegExp,
  token: string
):Observable<PageInfo[]> {
  return queryForOldestVersions(
    owner,
    repo,
    packageName,
    numVersions,
    token
  ).pipe(
    map(result => {
      console.log(` Return from graphql call point 1`)
      if (result.repository.packages.edges.length < 1) {
        console.log(
          `package: ${packageName} not found for owner: ${owner} in repo: ${repo}`
        )
        return []
      }

      const versions =
        result.repository.packages.edges[0].node.versions.edges
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

      return 
    })
  )
}
*/
/*
export function getRequiredVersions(input: Input): Observable<string[]> {
  let resultIds = new Observable<VersionInfo[]>()
  console.log(`point 2`)
  //make first graphql call

  let temp = getOldestVersions(
    input.owner,
    input.repo,
    input.packageName,
    2,
    input.ignoreVersions,
    input.token
  )

  temp.pipe(
    map(value => {
      console.log(
        `checking if package exists: ${
          value.length
        }, condition: ${value.length === 0}`
      )
      if (value.length === 0) {
        return throwError(
          `package: ${input.packageName} not found for owner: ${input.owner} in repo: ${input.repo}`
        )
      }
    })
  )

  if (input.minVersionsToKeep < 0) {
    let resultLength = 0
    temp.pipe(
      map(value => {
        console.log(`inside observable`)
        do {
          console.log(`append observable`)
          resultLength += value.length
          resultIds = concat(resultIds, temp)
          temp = getOldestVersions(
            input.owner,
            input.repo,
            input.packageName,
            2,
            input.ignoreVersions,
            input.token
          )
        } while (
          resultLength < input.numOldVersionsToDelete ||
          value.map(info => info.paginate)
        )
      })
    )
    return resultIds.pipe(map(value => value.map(info => info.id)))
  }
  
  let idsLength = 0
  if (input.minVersionsToKeep < 0) {
    console.log('in if condition')
    do {
      temp.pipe(map(value => (idsLength += value.length)))
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
      console.log(`after loop`)
    } while (idsLength < input.minVersionsToKeep && paginate)

    return resultIds.pipe(map(value => value.map(info => info.id)))
  }
  
  return resultIds.pipe(map(value => value.map(info => info.id)))
}
*/
