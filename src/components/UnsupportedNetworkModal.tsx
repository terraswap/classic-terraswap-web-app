import { AVAILABLE_CHAIN_ID } from "constants/networks"
import { useNetwork } from "hooks"
import { useMemo } from "react"
import styled from "styled-components"
import Button from "./Button"
import Modal from "./Modal"
import { useWallet } from "libs/CosmesWalletProvider"
import useChainOptions from "hooks/useChainOptions"

const ModalContent = styled.div`
  width: 100%;
  max-width: calc(100vw - 32px);
  margin: 0 auto;
  border-radius: 20px;
  box-shadow: 0 0 40px 0 rgba(0, 0, 0, 0.35);
  background-color: #fff;
  padding: 30px 0px;
  color: #5c5c5c;
  & > div {
    position: relative;
    width: 100%;
    height: auto;
    max-height: 80vh;
    overflow-y: auto;
    padding: 0 30px;

    font-size: 14px;
    font-weight: normal;
    font-stretch: normal;
    font-style: normal;
    line-height: 1.71;
    letter-spacing: normal;
    text-align: center;
    color: #5c5c5c;
  }

  @media screen and (max-width: ${({ theme }) => theme.breakpoint}) {
    padding: 30px 0px;
    & > div {
      padding: 0 16px;
    }
  }
`

const ModalTitle = styled.div`
  display: block;
  font-size: 20px;
  font-weight: bold;
  font-stretch: normal;
  font-style: normal;
  line-height: 1.35;
  letter-spacing: normal;
  text-align: center;
  color: #0222ba;
  margin-bottom: 30px;
`

interface NetworkDisplay {
  name: string
  chainID: string
}

const UnsupportedNetworkModal: React.FC<{ isOpen?: boolean }> = ({
  isOpen = false,
}) => {
  const network = useNetwork()
  const { disconnect } = useWallet()
  const chainOptions = useChainOptions()

  // Safely extract network information
  const networkName =
    typeof network?.name === "string" ? network.name : "unknown"
  const networkChainID =
    typeof network?.chainID === "string" ? network.chainID : "unknown"

  const availableNetworks = useMemo<NetworkDisplay[]>(() => {
    if (!chainOptions?.walletConnectChainIds) return []

    const result: NetworkDisplay[] = []

    try {
      const keys = Object.keys(chainOptions.walletConnectChainIds).map(Number)

      for (const key of keys) {
        const networkInfo = chainOptions.walletConnectChainIds[key]
        if (!networkInfo) continue

        const chainId = networkInfo.chainID
        if (!chainId || !AVAILABLE_CHAIN_ID.includes(chainId)) continue

        result.push({
          name: String(networkInfo.name || ""),
          chainID: String(chainId || ""),
        })
      }
    } catch (error) {
      console.error("Error processing network options:", error)
    }

    return result
  }, [chainOptions])

  const formattedNetworks = useMemo(() => {
    return availableNetworks
      .map((network) => {
        return `${network.name}(${network.chainID})`
      })
      .reverse()
      .join(", ")
  }, [availableNetworks])

  return (
    <Modal isOpen={isOpen} close={() => {}} open={() => {}}>
      <ModalContent>
        <div>
          <ModalTitle>Wrong network connection</ModalTitle>
          <div style={{ marginBottom: 20 }}>
            Your wallet is connected to{" "}
            <b>
              {networkName}({networkChainID})
            </b>
            . <br />
            Please change your network setting of the wallet to
            <div
              style={{
                border: "1px solid #eeeeee",
                borderRadius: 8,
                padding: 10,
                marginTop: 10,
                fontWeight: 700,
              }}
            >
              {formattedNetworks}
            </div>
          </div>
          <Button
            size="lg"
            onClick={() => window.location.reload()}
            style={{
              textTransform: "unset",
              maxWidth: 235,
              borderRadius: 10,
              marginBottom: 4,
            }}
          >
            Reload
          </Button>
          <Button
            outline
            size="lg"
            onClick={() => {
              disconnect()
              window.location.reload()
            }}
            style={{
              textTransform: "unset",
              maxWidth: 235,
              fontWeight: "bold",
              borderRadius: 10,
            }}
          >
            Disconnect
          </Button>
          {networkName !== "classic" && (
            <div style={{ color: "#aaaaaa", fontSize: 12 }}>
              Or
              <br />
              <a
                href="https://app.terraswap.io"
                style={{ fontWeight: 500, fontSize: 13 }}
              >
                Go to{" "}
                <b style={{ textDecoration: "underline" }}>app.terraswap.io</b>
              </a>
            </div>
          )}
        </div>
      </ModalContent>
    </Modal>
  )
}

export default UnsupportedNetworkModal
