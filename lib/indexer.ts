import { ObjectFilter } from "@/openrd-indexer/api/filter"
import {
  DisputesReturn,
  EventReturn,
  FilterRFPsReturn,
  FilterTasksReturn,
  RFPEventReturn,
  RFPReturn,
  TaskReturn,
  TotalEventsReturn,
  TotalRFPEventsReturn,
  TotalUsdValueReturn,
  TotalUsersReturn,
  UserEventsReturn,
  UserReturn,
} from "@/openrd-indexer/api/return-types"
import { replacer, reviver } from "@/openrd-indexer/utils/json"
import axios, { AxiosResponse } from "axios"
import { Address } from "viem"

const backendBaseUrl = "/indexer" as const

function checkError(res: AxiosResponse): void {
  if (res.status != 200) {
    throw new Error(
      `(${res.status}) Backend error: ${res.statusText}, Server response: ${res.data}`
    )
  }
}

export async function getTask(
  chainId: number,
  taskId: bigint
): Promise<TaskReturn> {
  const res = await axios.get(
    `${backendBaseUrl}/task/${chainId.toString()}/${taskId.toString()}`
  )
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getEvent(eventIndex: number): Promise<EventReturn> {
  const res = await axios.get(`${backendBaseUrl}/event/${eventIndex}`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getUser(address: Address): Promise<UserReturn> {
  const res = await axios.get(`${backendBaseUrl}/user/${address}`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function filterTasks(
  filter: ObjectFilter
): Promise<FilterTasksReturn> {
  const res = await axios.post(
    `${backendBaseUrl}/filterTasks/`,
    JSON.parse(JSON.stringify(filter, replacer))
  )
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function userEvents(address: Address): Promise<UserEventsReturn> {
  const res = await axios.get(`${backendBaseUrl}/userEvents/${address}`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getTotalEvents(): Promise<TotalEventsReturn> {
  const res = await axios.get(`${backendBaseUrl}/totalEvents`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getTotalUsers(): Promise<TotalUsersReturn> {
  const res = await axios.get(`${backendBaseUrl}/totalUsers`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getTotalUsdValue(): Promise<TotalUsdValueReturn> {
  const res = await axios.get(`${backendBaseUrl}/totalUsdValue`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function setMetadata(
  account: Address,
  metadataUri: string,
  signature: `0x${string}`
): Promise<void> {
  const res = await axios.post(`${backendBaseUrl}/setMetadata/`, {
    account: account,
    metadata: metadataUri,
    signature: signature,
  })
  checkError(res)
}

export async function getDisputes(
  chainId: number,
  taskId: bigint
): Promise<DisputesReturn> {
  const res = await axios.get(
    `${backendBaseUrl}/disputes/${chainId.toString()}/${taskId.toString()}`
  )
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getRFP(
  chainId: number,
  rfpId: bigint
): Promise<RFPReturn> {
  const res = await axios.get(
    `${backendBaseUrl}/rfp/${chainId.toString()}/${rfpId.toString()}`
  )
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getRFPEvent(eventIndex: number): Promise<RFPEventReturn> {
  const res = await axios.get(`${backendBaseUrl}/rfpEvent/${eventIndex}`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function filterRFPs(
  filter: ObjectFilter
): Promise<FilterRFPsReturn> {
  const res = await axios.post(
    `${backendBaseUrl}/filterRFPs/`,
    JSON.parse(JSON.stringify(filter, replacer))
  )
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}

export async function getTotalRFPEvents(): Promise<TotalRFPEventsReturn> {
  const res = await axios.get(`${backendBaseUrl}/totalRFPEvents`)
  checkError(res)
  return JSON.parse(JSON.stringify(res.data), reviver)
}
