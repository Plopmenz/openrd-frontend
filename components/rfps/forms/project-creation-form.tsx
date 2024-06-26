"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { RFPsContract } from "@/openrd-indexer/contracts/RFPs"
import { RFP } from "@/openrd-indexer/types/rfp"
import { zodResolver } from "@hookform/resolvers/zod"
import axios from "axios"
import { useFieldArray, useForm } from "react-hook-form"
import { Address, isAddress } from "viem"
import { z } from "zod"

import { addToIpfs } from "@/lib/api"
import { validAddress } from "@/lib/regex"
import { usePerformTransaction } from "@/hooks/usePerformTransaction"
import { Button } from "@/components/ui/button"
import { DatePicker } from "@/components/ui/date-picker"
import { ErrorWrapper } from "@/components/ui/error-wrapper"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { RichTextArea } from "@/components/ui/rich-textarea"
import { useAbstractWalletClient } from "@/components/context/abstract-wallet-client"
import {
  AddressPicker,
  SelectableAddresses,
} from "@/components/web3/address-picker"
import { ERC20BalanceInput } from "@/components/web3/erc20-balance-input"
import { NativeBalanceInput } from "@/components/web3/native-balance-input"
import {
  TokenMetadataRequest,
  TokenMetadataResponse,
} from "@/app/api/tokenMetadata/route"

const formSchema = z.object({
  // Onchain fields
  deadline: z.date().min(new Date(), "Deadline must be in the future."),
  nativeReward: z
    .object({
      to: z.string().regex(validAddress, "To must be a valid address."),
      amount: z.coerce.bigint().min(BigInt(0), "Amount cannot be negative."),
    })
    .array(),
  reward: z
    .object({
      to: z.string().regex(validAddress, "To must be a valid address."),
      token: z.string().regex(validAddress, "Token must be a valid address."),
      amount: z.coerce.bigint().min(BigInt(0), "Amount cannot be negative."),
    })
    .array(),

  // Metadata fields
  title: z.string().min(1, "Title cannot be empty."),
  tags: z
    .object({
      tag: z.string().min(1, "Tag cannot be empty."),
    })
    .array(),
  projectSize: z.coerce.number().min(0, "Project size cannot be negative."),
  teamSize: z.coerce.number().min(0, "Team size cannot be negative."),
  description: z.string().min(1, "Description cannot be empty."),
  resources: z.string(),
  links: z
    .object({
      name: z.string().min(1, "Name cannot be empty."),
      url: z.string().url("URL is invalid."),
    })
    .array(),
})

export function ProjectCreationForm({
  chainId,
  rfpId,
  rfp,
  refresh,
}: {
  chainId: number
  rfpId: bigint
  rfp: RFP
  refresh: () => Promise<void>
}) {
  const walletClient = useAbstractWalletClient({ chainId })
  const { performTransaction, performingTransaction, loggers } =
    usePerformTransaction({ chainId })

  const [selectableAddresses, setSelectableAddresses] =
    useState<SelectableAddresses>({})
  useEffect(() => {
    if (!walletClient?.account?.address) {
      setSelectableAddresses({})
      return
    }

    setSelectableAddresses({
      [walletClient.account.address]: { name: "Yourself" },
    })
  }, [walletClient?.account?.address])

  const [budgetTokens, setBudgetTokens] = useState<SelectableAddresses>({})
  useEffect(() => {
    const getBudgetTokens = async () => {
      const request: TokenMetadataRequest = {
        chainId: chainId,
        addresses: rfp.budget.map((b) => b.tokenContract),
      }
      const tokensResponse = await axios.post(
        "/api/tokenMetadata/",
        JSON.stringify(request)
      )

      if (tokensResponse.status === 200) {
        const data = tokensResponse.data as TokenMetadataResponse
        setBudgetTokens(
          data.tokens.reduce((acc, token) => {
            let name: string = token.contractAddress
            if (token.name) {
              name = token.name
            }
            if (token.symbol) {
              name = `${name} (${token.symbol})`
            }

            acc[token.contractAddress as Address] = {
              name: name,
              logo: token.logo,
            }
            return acc
          }, {} as SelectableAddresses)
        )
      } else {
        console.warn(
          `Token metadata fetch failed: ${JSON.stringify(tokensResponse)}`
        )
      }
    }

    getBudgetTokens().catch(console.error)
  }, [chainId, rfp.budget])

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      deadline: new Date(),
      nativeReward: [],
      reward: [],

      title: "",
      tags: [],
      projectSize: 0,
      teamSize: 0,
      description: "",
      resources: "",
      links: [],
    },
  })

  async function onSubmit(values: z.infer<typeof formSchema>) {
    await performTransaction({
      transactionName: "Project creation",
      transaction: async () => {
        const metadata = {
          title: values.title,
          tags: values.tags,
          projectSize: values.projectSize,
          teamSize: values.teamSize,
          description: values.description,
          resources: values.resources,
          links: values.links,
        }
        const cid = await addToIpfs(metadata, loggers)
        if (!cid) {
          return undefined
        }

        const nativeReward = values.nativeReward.map((r) => {
          return {
            ...r,
            to: r.to as Address,
          }
        })
        const reward = rfp.budget
          .map((b) =>
            values.reward.filter(
              (r) => r.token === b.tokenContract.toLowerCase()
            )
          )
          .reduce(
            (acc, value) => {
              if (value.length === 0) {
                // Push record to skip this token
                acc.push({
                  nextToken: true,
                  to: "0x519ce4C129a981B2CBB4C3990B1391dA24E8EbF3",
                  amount: BigInt(0),
                })
              } else {
                acc.push(
                  ...value.map((v, i) => {
                    return {
                      nextToken: i === value.length - 1,
                      to: v.to as Address,
                      amount: v.amount,
                    }
                  })
                )
              }
              return acc
            },
            [] as { nextToken: boolean; to: Address; amount: bigint }[]
          )
        return {
          abi: RFPsContract.abi,
          address: RFPsContract.address,
          functionName: "submitProject",
          args: [
            rfpId,
            `ipfs://${cid}`,
            BigInt(Math.round(values.deadline.getTime() / 1000)),
            nativeReward,
            reward,
          ],
        }
      },
      onConfirmed: (receipt) => {
        refresh()
      },
    })
  }

  const {
    fields: tags,
    append: appendTag,
    remove: removeTag,
    update: updateTag,
  } = useFieldArray({
    name: "tags",
    control: form.control,
  })

  const {
    fields: links,
    append: appendLink,
    remove: removeLink,
    update: updateLink,
  } = useFieldArray({
    name: "links",
    control: form.control,
  })

  const {
    fields: nativeReward,
    append: appendNativeReward,
    remove: removeNativeReward,
    update: updateNativeReward,
  } = useFieldArray({
    name: "nativeReward",
    control: form.control,
  })

  const {
    fields: reward,
    append: appendReward,
    remove: removeReward,
    update: updateReward,
  } = useFieldArray({
    name: "reward",
    control: form.control,
  })

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title</FormLabel>
              <FormControl>
                <Input
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("title")
                  }}
                />
              </FormControl>
              <FormDescription>
                High level description what your project is about.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Tags</FormLabel>
          <FormControl>
            <div>
              {tags.map((tag, i) => (
                <ErrorWrapper
                  key={i}
                  error={form.formState.errors.tags?.at?.(i)}
                >
                  <div className="flex gap-x-1">
                    <Input
                      value={tag.tag}
                      onChange={(change) => {
                        updateTag(i, { ...tag, tag: change.target.value })
                        form.trigger("tags")
                      }}
                    />
                    <Button onClick={() => removeTag(i)} variant="destructive">
                      X
                    </Button>
                  </div>
                </ErrorWrapper>
              ))}
              <Button onClick={() => appendTag({ tag: "" })}>Add tag</Button>
            </div>
          </FormControl>
          <FormDescription>Tags help people find the project.</FormDescription>
          <FormMessage />
        </FormItem>
        <FormField
          control={form.control}
          name="projectSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Project Duration</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("projectSize")
                  }}
                />
              </FormControl>
              <FormDescription>
                An estimate of how many (combined) hours are required to
                complete the project.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="teamSize"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Team Size</FormLabel>
              <FormControl>
                <Input
                  type="number"
                  min={0}
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("teamSize")
                  }}
                />
              </FormControl>
              <FormDescription>
                Expected team size for completing the project.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="description"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Description</FormLabel>
              <FormControl>
                <RichTextArea
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("description")
                  }}
                />
              </FormControl>
              <FormDescription>
                Full description with all details needed to understand and
                complete the project. This is important to be on the same line
                as your manager, ambiguity could cause you to complete the
                project as you envisioned it, but different from the expectation
                and interpretation of the task manager. This description will
                also be leading in case of a dispute.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="resources"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Resources</FormLabel>
              <FormControl>
                <RichTextArea
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("resources")
                  }}
                />
              </FormControl>
              <FormDescription>
                Additional section to help people find information relevant to
                the project.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormItem>
          <FormLabel>Links</FormLabel>
          <FormControl>
            <div>
              <div className="mb-[10px] grid gap-y-[10px]">
                {links.map((link, i) => (
                  <ErrorWrapper
                    key={i}
                    error={form.formState.errors.links?.at?.(i)}
                  >
                    <div className="flex gap-x-4">
                      <Input
                        placeholder="Name"
                        value={link.name}
                        onChange={(change) => {
                          updateLink(i, { ...link, name: change.target.value })
                          form.trigger("links")
                        }}
                      />
                      <Input
                        placeholder="URL"
                        value={link.url}
                        onChange={(change) => {
                          updateLink(i, { ...link, url: change.target.value })
                          form.trigger("links")
                        }}
                      />
                      <Button
                        onClick={() => removeLink(i)}
                        variant="destructive"
                        className="my-auto h-[25px] w-[45px] p-[2px]"
                      >
                        <Image
                          height={20}
                          width={20}
                          src={`/images/utils/x.svg`}
                          alt={"Remove"}
                        />
                      </Button>
                      {form.formState.errors.links && (
                        <p>{form.formState.errors.links[i]?.message}</p>
                      )}
                    </div>
                  </ErrorWrapper>
                ))}
              </div>
              <Button onClick={() => appendLink({ name: "", url: "" })}>
                Add link
              </Button>
            </div>
          </FormControl>
          <FormDescription>
            Links to the project github or how to contact the proposer. Email
            addresses should be formatted as mailto:info@example.com
          </FormDescription>
          <FormMessage />
        </FormItem>

        <FormField
          control={form.control}
          name="deadline"
          render={({ field }) => (
            <FormItem className="flex flex-col">
              <FormLabel>Deadline</FormLabel>
              <FormControl>
                <DatePicker
                  {...field}
                  onChange={(change) => {
                    field.onChange(change)
                    form.trigger("deadline")
                  }}
                  minValue={new Date()}
                />
              </FormControl>
              <FormDescription>
                In case the project is not completed before this date, the task
                manager will be able to refund the funds. The executor could
                apply for a partial reward before this date if it seems like
                they will not manage to complete it in time. The deadline can be
                extended by the task manager at any point.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormItem>
          <FormLabel>Native Rewards</FormLabel>
          <FormControl>
            <div>
              {nativeReward.map((nativeRewardItem, i) => (
                <ErrorWrapper
                  key={i}
                  error={form.formState.errors.nativeReward?.at?.(i)}
                >
                  <div className="flex w-full gap-x-1">
                    <AddressPicker
                      chainId={chainId}
                      addressName="receiver"
                      selectableAddresses={selectableAddresses}
                      value={nativeRewardItem.to}
                      onChange={(change) => {
                        updateNativeReward(i, {
                          ...nativeRewardItem,
                          to: change ?? "",
                        })
                        form.trigger("nativeReward")
                      }}
                      customAllowed={true}
                    />
                    <NativeBalanceInput
                      chainId={chainId}
                      value={nativeRewardItem.amount}
                      onChange={(change) => {
                        updateNativeReward(i, {
                          ...nativeRewardItem,
                          amount: change,
                        })
                        form.trigger("nativeReward")
                      }}
                      account={walletClient?.account?.address}
                    />
                    <Button
                      onClick={() => removeNativeReward(i)}
                      variant="destructive"
                    >
                      X
                    </Button>
                  </div>
                </ErrorWrapper>
              ))}
              <Button
                onClick={() =>
                  appendNativeReward({ to: "", amount: BigInt(0) })
                }
              >
                Add native reward
              </Button>
            </div>
          </FormControl>
          <FormDescription>
            The amount of native currency that your require for completing this
            project. This can exceed the current budget amount.
          </FormDescription>
          <FormMessage />
        </FormItem>

        {rfp.budget.length !== 0 && (
          <FormItem>
            <FormLabel>ERC20 Rewards</FormLabel>
            <FormControl>
              <div>
                {reward.map((rewardItem, i) => (
                  <ErrorWrapper
                    key={i}
                    error={form.formState.errors.reward?.at?.(i)}
                  >
                    <div className="flex w-full gap-x-1">
                      <AddressPicker
                        chainId={chainId}
                        addressName="receiver"
                        selectableAddresses={selectableAddresses}
                        value={rewardItem.to}
                        onChange={(change) => {
                          updateReward(i, {
                            ...rewardItem,
                            to: change ?? "",
                          })
                          form.trigger("reward")
                        }}
                        customAllowed={true}
                      />
                      <AddressPicker
                        chainId={chainId}
                        addressName="ERC20 token"
                        selectableAddresses={budgetTokens}
                        value={rewardItem.token}
                        onChange={(change) => {
                          updateReward(i, {
                            ...rewardItem,
                            token: change ?? "",
                          })
                          form.trigger("reward")
                        }}
                      />
                      <ERC20BalanceInput
                        chainId={chainId}
                        token={
                          isAddress(rewardItem.token)
                            ? rewardItem.token
                            : undefined
                        }
                        value={rewardItem.amount}
                        onChange={(change) => {
                          updateReward(i, { ...rewardItem, amount: change })
                          form.trigger("reward")
                        }}
                        account={walletClient?.account?.address}
                        showAvailable={false}
                      />
                      <Button
                        onClick={() => removeReward(i)}
                        variant="destructive"
                      >
                        X
                      </Button>
                    </div>
                  </ErrorWrapper>
                ))}
                <Button
                  onClick={() =>
                    appendReward({ to: "", token: "", amount: BigInt(0) })
                  }
                >
                  Add ERC20 reward
                </Button>
              </div>
            </FormControl>
            <FormDescription>
              The amount of ERC20 currency that your require for completing this
              project. This is limited to the ERC20 tokens set as budget, but
              can exceed the current budget amount.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
        <Button type="submit" disabled={performingTransaction}>
          Create project
        </Button>
      </form>
    </Form>
  )
}
