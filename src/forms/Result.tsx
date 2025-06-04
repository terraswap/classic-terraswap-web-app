import { useEffect, useRef, useState } from "react"
import classNames from "classnames/bind"

import { MAX_TX_POLLING_RETRY, TX_POLLING_INTERVAL } from "constants/constants"
import MESSAGE from "lang/MESSAGE.json"

import SwapCard from "components/SwapCard"
import Icon from "components/Icon"
import Loading from "components/Loading"
import Button from "components/Button"
import SwapTxHash from "./SwapTxHash"
import SwapTxInfo from "./SwapTxInfo"
import styles from "./Result.module.scss"

import { AxiosError } from "axios"

// Removed unused TxDescription import
import { useLCDClient } from "layouts/WalletConnectProvider"
import {
  // Removed unused MsgExecuteContract import
  CosmosTxV1beta1GetTxResponse as TxResult,
  CosmosBaseAbciV1beta1TxResponse as TxResponse,
} from "@goblinhunt/cosmes/protobufs"
// Removed empty import
// Removed unused utf8 import
export interface ResultProps {
  response?: TxResult
  error?: AxiosError | Error
  onFailure: () => void
  parserKey: string
}

/*// Define a type that matches the structure we need from TxInfo
interface TxInfo {
  txhash: string
  raw_log: string
  code?: number
  logs?: Array<{
    events: Array<{
      type: string
      attributes: Array<{
        key: string
        value: string
      }>
    }>
  }>
  height: number // Changed to number to match Terra.js TxInfo
  gas_wanted?: string
  gas_used?: string
  timestamp?: string
  tx: {
    value: {
      msg: any[]
    }
  }
}*/

const cx = classNames.bind(styles)

enum STATUS {
  SUCCESS = "success",
  LOADING = "loading",
  FAILURE = "failure",
  TIMEOUT = "timeout",
}

const Result = ({ response, error, onFailure, parserKey }: ResultProps) => {
  const { terra } = useLCDClient()

  // Extract txhash and raw_log from TxResult
  // In Cosmes, the structure is different from Terra.js
  const txHash = response?.txResponse?.txhash || ""
  const raw_log = response?.txResponse?.rawLog || ""
  /* polling */
  const [txInfo, setTxInfo] = useState<TxResponse>()

  const [status, setStatus] = useState<STATUS>(STATUS.LOADING)

  const retryCount = useRef(0)

  useEffect(() => {
    let isDestroyed = false
    const load = async () => {
      if (isDestroyed) {
        return
      }
      if (retryCount.current >= MAX_TX_POLLING_RETRY) {
        setStatus(STATUS.TIMEOUT)
        return
      }
      if (!txHash) {
        setStatus(STATUS.FAILURE)
        return
      }
      try {
        // Using the new cosmes client to get transaction info
        const res = await terra.tx.getTx(txHash)

        if (isDestroyed) {
          return
        }

        // Ensure res is not null before proceeding
        if (!res) {
          throw new Error("Failed to get transaction information")
        }

        if (res.txResponse?.code && res.txResponse.code !== 0) {
          setTxInfo(res.txResponse)
          setStatus(STATUS.FAILURE)
          return
        }
        if (res.txResponse?.txhash) {
          setTxInfo(res.txResponse)
          setStatus(STATUS.SUCCESS)
          return
        }
        throw new Error("Unknown")
      } catch (error) {
        retryCount.current += 1
        setTimeout(() => {
          load()
        }, TX_POLLING_INTERVAL)
      }
    }
    load()

    return () => {
      isDestroyed = true
    }
  }, [txHash, terra.tx])

  /*const tx = useMemo(() => {
    if (!txInfo?.tx?.value) return null
    const tx = Tx.fromBinary(txInfo.tx.value)
    return tx
  }, [txInfo])*/

  /* render */
  const name = {
    [STATUS.SUCCESS]: "check_circle_outline",
    [STATUS.LOADING]: "",
    [STATUS.FAILURE]: "highlight_off",
    [STATUS.TIMEOUT]: "highlight_off",
  }[status]

  const icon = name ? (
    <Icon name={name} className={cx(status)} size={50} />
  ) : (
    <Loading size={40} />
  )

  const title = {
    [STATUS.SUCCESS]: (
      <span className={styles.success}>{MESSAGE.Result.SUCCESS}</span>
    ),
    [STATUS.LOADING]: MESSAGE.Result.LOADING,
    [STATUS.FAILURE]: (
      <span className={styles.failure}>{MESSAGE.Result.FAILURE}</span>
    ),
    [STATUS.TIMEOUT]: (
      <span className={styles.failure}>{MESSAGE.Result.FAILURE}</span>
    ),
  }[status]

  const message =
    raw_log ||
    (error as AxiosError)?.response?.data?.message ||
    error?.message ||
    JSON.stringify(error)

  const content = {
    [STATUS.SUCCESS]: txInfo && (
      <>
        {/*<div style={{ textAlign: "center", marginTop: 16 }}>
          <div>
            {tx?.body?.messages?.map((msg, index: number) => {
              if (!msg || msg.typeUrl !== '/cosmwasm.wasm.v1.MsgExecuteContract') {
                return <>{msg.typeUrl}</>
              }

              const executeMsg = MsgExecuteContract.fromBinary(msg.value)

              return (
                <React.Fragment key={index}>
                        <div key={`${index}`} style={{ color: "#5c5c5c", fontSize: 18 }}>
                          <TxDescription
                            network={{
                              ...config,
                              name: network?.name,
                              // Add required properties for NetworkConfig
                              URL: network?.lcd || '',
                              chainID: network?.chainID || '',
                              gasAdjustment: 1.4
                            } as any}
                            config={{ printCoins: 3 }}
                          >
                            {utf8.encode(executeMsg.msg)}
                          </TxDescription>
                        </div>
                  <br />
                </React.Fragment>
              )
            })}
          </div>
        </div>*/}
        <SwapTxInfo txInfo={txInfo} parserKey={parserKey} />
      </>
    ),
    [STATUS.LOADING]: (
      <div>
        <Loading className={styles.progress} color="#0222ba" size={48} />
        <br />
        <br />
        <p className={styles.hash}>
          <SwapTxHash>{txHash}</SwapTxHash>
        </p>
      </div>
    ),
    [STATUS.FAILURE]: (
      <>
        {txInfo && <SwapTxInfo txInfo={txInfo} parserKey={parserKey} />}
        <p className={styles.feedback}>{txInfo?.rawLog || message}</p>
      </>
    ),
    [STATUS.TIMEOUT]: (
      <>
        {txInfo && <SwapTxInfo txInfo={txInfo} parserKey={parserKey} />}
        <p className={styles.feedback}>{MESSAGE.Result.TIMEOUT}</p>
        <p className={styles.hash}>
          <SwapTxHash>{txHash}</SwapTxHash>
        </p>
      </>
    ),
  }[status]

  const button = {
    [STATUS.SUCCESS]: (
      <Button onClick={() => window.location.reload()} size="swap" submit>
        Done
      </Button>
    ),
    [STATUS.LOADING]: null,
    [STATUS.FAILURE]: (
      <Button onClick={onFailure} size="swap" submit>
        {MESSAGE.Result.Button.FAILURE}
      </Button>
    ),
    [STATUS.TIMEOUT]: (
      <Button onClick={() => window.location.reload()} size="swap" submit>
        Done
      </Button>
    ),
  }[status]

  return (
    <SwapCard icon={icon} title={title} lg>
      <section className={styles.contents}>{content}</section>
      <footer>{button}</footer>
    </SwapCard>
  )
}

export default Result
