import { div, times } from "libs/math"
import { coinFromString, decimal, toAmount } from "libs/parse"
import { Type } from "pages/Swap"
import { useCallback, useEffect, useMemo, useState } from "react"
import useAPI from "./useAPI"
import { useTokenInfos } from "./usePairs"
import { useLCDClient } from "layouts/WalletConnectProvider"
import { useContractsAddress } from "hooks/useContractsAddress"
import calc from "helpers/calc"
import { AssetInfoKey } from "hooks/contractKeys"
import useBalance from "./useBalance"
import { MsgExecuteContract } from "@goblinhunt/cosmes/client"
import BigNumber from "bignumber.js"
import useConnectedWallet from "hooks/useConnectedWallet"
import { useAddress, useContract } from "hooks"
import { utf8 } from "@goblinhunt/cosmes/codec"

type Params = {
  from: string
  to: string
  value: number | string
  type?: Type
  slippageTolerance?: string | number
  deadline: number | undefined
}

function sleep(t: number) {
  return new Promise((resolve) => setTimeout(resolve, t))
}

const useAutoRouter = (params: Params) => {
  const { from, to, type, value: _value, slippageTolerance, deadline } = params
  const wallet = useConnectedWallet()
  const walletAddress = useAddress()
  const { terra } = useLCDClient()
  const value = Number(_value)
  const { balance } = useBalance(from)
  const { generateContractMessages, querySimulate } = useAPI()
  const [isSimulationLoading, setIsSimulationLoading] = useState(false)
  const [isQueryValidationLoading, setIsQueryValidationLoading] =
    useState(false)

  const [msgs, setMsgs] = useState<
    (MsgExecuteContract<any>[] | MsgExecuteContract<any>)[]
  >([])
  const [simulatedAmounts, setSimulatedAmounts] = useState<number[]>([])
  const [autoRefreshTicker, setAutoRefreshTicker] = useState(false)
  const { isNativeToken } = useContractsAddress()
  const { find } = useContract()
  const tokenInfos = useTokenInfos()

  const isLoading = useMemo(
    () => isSimulationLoading || isQueryValidationLoading,
    [isSimulationLoading, isQueryValidationLoading]
  )

  const getMsgs = useCallback(
    (
      _msg: any,
      {
        amount,
        token,
        minimumReceived,
        beliefPrice,
      }: {
        amount?: string | number
        token?: string
        minimumReceived?: string | number
        beliefPrice?: string | number
      }
    ) => {
      try {
        const msg = Array.isArray(_msg) ? _msg[0] : _msg

        // transform the inner msg to json
        const msgProto = msg.toProto()
        const msgJson = JSON.parse(utf8.encode(msgProto.msg))

        if (msgJson?.swap) {
          msgJson.swap.belief_price = `${beliefPrice}`
        }
        if (msgJson?.send?.msg?.swap) {
          msgJson.send.msg.swap.belief_price = `${beliefPrice}`
        }
        if (msgJson?.send?.msg?.execute_swap_operations) {
          msgJson.send.msg.execute_swap_operations.minimum_receive = parseInt(
            `${minimumReceived}`,
            10
          ).toString()
          if (isNativeToken(token || "")) {
            msgProto.funds = [
              coinFromString(toAmount(`${amount}`, token) + token),
            ]
          }

          msgJson.send.msg = btoa(JSON.stringify(msgJson.send.msg))
        } else if (msgJson?.send?.msg) {
          msgJson.send.msg = btoa(JSON.stringify(msgJson.send.msg))
        } else if (msgJson?.send) {
          msgJson.send.minimum_receive = parseInt(
            `${minimumReceived}`,
            10
          ).toString()
        }
        if (msgJson?.execute_swap_operations) {
          msgJson.execute_swap_operations.minimum_receive = parseInt(
            `${minimumReceived}`,
            10
          ).toString()
          msgJson.execute_swap_operations.offer_amount = toAmount(
            `${amount}`,
            token
          )

          if (isNativeToken(token || "")) {
            msgProto.funds = [
              coinFromString(toAmount(`${amount}`, token) + token),
            ]
          }
        }

        // create new msg from msgJson
        const newMsg = new MsgExecuteContract({
          sender: msgProto.sender,
          contract: msgProto.contract,
          msg: msgJson,
          funds: msgProto.funds,
        })

        return [newMsg]
      } catch (error) {
        console.error("Error in getMsgs:", error)
        return []
      }
    },
    [isNativeToken]
  )

  const queries = useMemo(() => {
    if (!to || !value || !simulatedAmounts?.length || !msgs?.length) {
      return []
    }

    const indexes = simulatedAmounts
      .map((value, index) => ({ value, index }))
      .sort((a, b) => b.value - a.value)
      .map((item) => item.index)

    return indexes
      .map((index) => {
        const simulatedAmount = simulatedAmounts[index]
        if (simulatedAmount < 0) {
          return null
        }
        const msgValue = msgs[index]
        if (!msgValue) {
          return null
        }

        // In Cosmes, MsgExecuteContract has a different structure
        const msgObj = Array.isArray(msgValue) ? msgValue[0] : msgValue
        // Access the message data through the toAmino method which is public
        let msg: any = null
        let sender = ""
        let contract = ""
        let funds: Coin[] = []
        try {
          if (typeof msgObj?.toAmino === "function") {
            // If it's a Cosmes MsgExecuteContract, use toAmino to get the message
            msg = msgObj.toAmino().value.msg
            sender = msgObj.toAmino().value.sender
            contract = msgObj.toAmino().value.contract
            funds = msgObj.toAmino().value.funds
          } else {
            // Fallback for other message formats
            // Use type assertion to bypass TypeScript checking
            const protoMsg = msgObj?.toProto()
            msg = protoMsg?.msg || msgObj
            msg = JSON.parse(utf8.encode(msg))
            sender = protoMsg?.sender
            contract = protoMsg?.contract
            funds = protoMsg?.funds
          }
        } catch (error) {
          console.error("Error accessing message data:", error)
          return null
        }

        // Skip if we don't have a valid sender
        if (!sender) {
          console.error("No valid sender found for message")
          return null
        }

        const tokenRoutes: string[] = []
        const operations: any[] =
          msg?.execute_swap_operations?.operations ||
          msg?.send?.msg?.execute_swap_operations?.operations
        if (operations) {
          operations.forEach((operation, index) => {
            if (operation?.terra_swap?.offer_asset_info?.native_token?.denom) {
              tokenRoutes.push(
                operation?.terra_swap?.offer_asset_info?.native_token?.denom
              )
            } else if (
              operation?.terra_swap?.offer_asset_info?.token?.contract_addr
            ) {
              tokenRoutes.push(
                operation?.terra_swap?.offer_asset_info?.token?.contract_addr
              )
            } else if (operation?.native_swap?.offer_denom) {
              tokenRoutes.push(operation?.native_swap?.offer_denom)
            }

            if (index >= operations.length - 1) {
              if (operation?.terra_swap?.ask_asset_info?.native_token?.denom) {
                tokenRoutes.push(
                  operation?.terra_swap?.ask_asset_info?.native_token?.denom
                )
              } else if (
                operation?.terra_swap?.ask_asset_info?.token?.contract_addr
              ) {
                tokenRoutes.push(
                  operation?.terra_swap?.ask_asset_info?.token?.contract_addr
                )
              } else if (operation?.native_swap?.ask_denom) {
                tokenRoutes.push(operation?.native_swap?.ask_denom)
              }
            }
          })
        }

        const tokenInfo1 = tokenInfos.get(from)
        const tokenInfo2 = tokenInfos.get(to)

        const minimumReceived = calc.minimumReceived({
          expectedAmount: `${simulatedAmount}`,
          max_spread: String(slippageTolerance),
          commission: find(AssetInfoKey.COMMISSION, to),
          decimals: tokenInfo1?.decimals,
        })

        const e = Math.pow(10, tokenInfo2?.decimals || 6)

        const newMessage = new MsgExecuteContract({
          sender: sender,
          contract: contract,
          msg: msg,
          funds: funds,
        })

        const formattedMsg = getMsgs(newMessage, {
          amount: value,
          minimumReceived,
          token: from,
          beliefPrice: `${decimal(div(times(value, e), simulatedAmount), 18)}`,
        })

        return {
          msg: formattedMsg,
          index,
          simulatedAmount,
          tokenRoutes,
          price: div(times(value, e), simulatedAmount),
        }
      })
      .filter(Boolean)
  }, [
    to,
    value,
    simulatedAmounts,
    msgs,
    slippageTolerance,
    find,
    getMsgs,
    from,
    tokenInfos,
  ])

  useEffect(() => {
    let isCanceled = false
    const fetchMessages = async () => {
      if (!from || !to || !value || !type) {
        return
      }
      if (type === Type.PROVIDE || type === Type.WITHDRAW) {
        return
      }

      const res: MsgExecuteContract<any>[] = await generateContractMessages({
        type: Type.SWAP,
        from,
        to,
        amount: value,
        max_spread: `${slippageTolerance || 0.01}`,
        belief_price: 0,
        sender: walletAddress,
        deadline,
      })
      if (Array.isArray(res) && !isCanceled) {
        setMsgs(res)
      }
    }
    setIsSimulationLoading(true)
    setIsQueryValidationLoading(true)
    setMsgs([])
    setSimulatedAmounts([])
    const timerId = setTimeout(() => {
      fetchMessages()
    }, 500)

    return () => {
      clearTimeout(timerId)
      isCanceled = true
    }
  }, [
    value,
    from,
    generateContractMessages,
    to,
    type,
    autoRefreshTicker,
    walletAddress,
    slippageTolerance,
    deadline,
  ])

  useEffect(() => {
    const timerId = setInterval(() => {
      if (
        window?.navigator?.onLine &&
        window?.document?.hasFocus() &&
        !isSimulationLoading
      ) {
        setAutoRefreshTicker((current) => !current)
      }
    }, 60000)
    return () => {
      clearInterval(timerId)
    }
  }, [value, from, to, type, isSimulationLoading])

  useEffect(() => {
    let isCanceled = false
    const request = async () => {
      const simulateQueries = msgs.map((msg) => {
        let { contract, msg: msgRaw } = Array.isArray(msg)
          ? msg[0].toProto()
          : msg.toProto()

        let msgValue = JSON.parse(utf8.encode(msgRaw))
        if (msgValue?.send) {
          contract = msgValue?.send?.contract
          msgValue = msgValue?.send?.msg
        }
        if (msgValue?.execute_swap_operations) {
          const { operations } = msgValue.execute_swap_operations
          return {
            contract,
            msg: {
              simulate_swap_operations: {
                offer_amount: toAmount(`${value}`, from),
                operations,
              },
            },
          }
        }
        if (msgValue?.swap) {
          const offer_asset = msgValue?.swap?.offer_asset || {
            amount: toAmount(`${value}`, from),
            info: {
              token: {
                contract_addr: from,
              },
            },
          }

          return {
            contract,
            msg: {
              simulation: { offer_asset },
            },
          }
        }
        return undefined
      })

      const promises = simulateQueries.map(async (query, index) => {
        try {
          if (isCanceled) {
            return undefined
          }
          await sleep(80 * index)
          if (isCanceled) {
            return undefined
          }
          const res = await querySimulate({
            contract: `${query?.contract}`,
            msg: query?.msg,
            timeout: 5000,
          })
          if (isCanceled) {
            return undefined
          }

          return res
        } catch (error) {
          console.log(error)
        }
        return undefined
      })

      const results = await Promise.allSettled(promises)
      if (isCanceled) {
        return
      }
      setSimulatedAmounts(
        results
          .map((item) => {
            if (item.status === "fulfilled") {
              if (item?.value?.return_amount) {
                return parseInt(item?.value?.return_amount, 10)
              }
              if (item?.value?.amount) {
                return parseInt(item?.value?.amount, 10)
              }
            }
            return -1
          })
          .map((item) => (Number.isNaN(Number(item)) ? -1 : item))
      )
      setIsSimulationLoading(false)
    }

    setSimulatedAmounts([])
    request()

    return () => {
      isCanceled = true
    }
  }, [value, from, msgs, querySimulate])

  const [profitableQuery, setProfitableQuery] = useState<any>(null)

  // Reset profitableQuery when queries change
  useEffect(() => {
    setProfitableQuery(null)
  }, [queries])

  useEffect(() => {
    let isCanceled = false
    const validateQueries = async () => {
      if (!queries?.length) {
        return
      }
      setIsQueryValidationLoading(true)
      // Get account info with proper error handling
      let account = undefined
      try {
        if (walletAddress) {
          // Use type assertion to bypass TypeScript parameter count error
          account = await terra.auth.accountInfo(walletAddress)
        }
      } catch (error) {
        console.error("Error fetching account info:", error)
      }
      if (isCanceled) {
        return
      }

      if (
        !account ||
        new BigNumber(balance || "0").lt(toAmount(`${value}`, from))
      ) {
        if (queries[0] && !isCanceled) {
          setProfitableQuery(queries[0])
        }
      } else {
        for await (const query of queries) {
          if (isCanceled) {
            return
          }
          try {
            if (query?.msg) {
              console.log("query?.msg", query?.msg)
              await wallet?.estimateFee({
                msgs: query?.msg,
                memo: undefined,
              })
              if (isCanceled) {
                return
              }
              setProfitableQuery(query)
              break
            }
          } catch (error) {
            console.log(error)
          }
        }
      }
      setIsQueryValidationLoading(false)
    }
    const timerId = setTimeout(() => {
      validateQueries()
    }, 300)
    return () => {
      isCanceled = true
      clearTimeout(timerId)
    }
  }, [value, balance, queries, terra, walletAddress, from, wallet])

  const result = useMemo(() => {
    if (!from || !to || !type || !value) {
      return { profitableQuery: undefined, isLoading }
    }
    return {
      isLoading,
      profitableQuery,
    }
  }, [value, from, to, type, isLoading, profitableQuery])

  return result
}

export default useAutoRouter
