#!/usr/bin/env -S tea -E

/*---
args:
  - deno
  - run
  - --allow-net
  - --allow-env=GITHUB_TOKEN
  - --import-map={{ srcroot }}/import-map.json
---*/

/// Test
/// ./scripts/fetch-pr-artifacts.ts e582b03fe6efedde80f9569403555f4513dbec91

import { panic, undent } from "utils/index.ts";

/// Main
/// -------------------------------------------------------------------------------

const ref = Deno.args[0] ?? panic("usage: fetch-pr-artifacts.ts {SHA}")

const res = await queryGraphQL<CommitQuery>(commitQuery())

const node = res.repository?.ref?.target?.history?.edges.find(n => n.node.oid === ref)
const prOid = node?.node.associatedPullRequests.nodes[0].commits.nodes[0].commit.oid

console.log({node, prOid})

/// Functions
/// -------------------------------------------------------------------------------

async function queryGraphQL<T>(query: string): Promise<T> {
  const headers: HeadersInit = {}
  const token = Deno.env.get("GITHUB_TOKEN") ?? panic("GitHub GraphQL requires you set $GITHUB_TOKEN")
  if (token) headers['Authorization'] = `bearer ${token}`

  const rsp = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    body: JSON.stringify({ query }),
    headers
  })
  const json = await rsp.json()

  if (!rsp.ok) {
    console.error({ rsp, json })
    throw new Error()
  } else {
    console.debug(json)
  }

  return json.data as T ?? panic("No `data` returns from GraphQL endpoint")
}

/// Types
/// -------------------------------------------------------------------------------

type CommitQuery = {
  repository: {
    ref: {
      target: {
        history: {
          edges: Node[]
        }
      }
    }
  }
}

type Node = {
  node: {
    url: URL
    oid: string
    associatedPullRequests: { nodes: PullRequest[] }
  }
}

type PullRequest = {
  url: URL
  commits: { nodes: Commit[]}
}

type Commit = {
  url: URL
  commit: { oid: string }
}

/// Queries
/// -------------------------------------------------------------------------------

function commitQuery(): string {
  return undent`
    query {
      repository(name: "pantry.core", owner: "teaxyz") {
        ref(qualifiedName: "main") {
          target {
            ... on Commit {
              history(first: 50) {
                edges {
                  node {
                    url
                    oid
                    associatedPullRequests(first: 1) {
                      nodes {
                        url
                        commits(last: 1) {
                          nodes {
                            url
                            commit {
                              oid
                            }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }`
}