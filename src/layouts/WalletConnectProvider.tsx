import React, { PropsWithChildren, useEffect, useState } from "react"
import { useModal } from "components/Modal"
import ConnectListModal from "./ConnectListModal"
import { ConnectModalProvider } from "hooks/useConnectModal"
import { getChainOptions } from "libs/getChainOptions"
import CosmeWalletProvider, {
  useWallet,
  useLCD,
  useLCDClient,
} from "libs/CosmesWalletProvider"

const WalletConnectProvider: React.FC<PropsWithChildren<{}>> = ({
  children,
}) => {
  const modal = useModal()
  const [chainOptions, setChainOptions] = useState<any>()

  useEffect(() => {
    getChainOptions().then((res) => setChainOptions(res))
  }, [])

  return chainOptions ? (
    <CosmeWalletProvider
      walletConnectChainIds={chainOptions.walletConnectChainIds || {}}
      defaultNetwork={chainOptions.defaultNetwork?.chainID || "columbus-5"}
      connectorOpts={{ bridge: "https://walletconnect.terra.dev/" }}
    >
      <ConnectModalProvider value={modal}>
        <ConnectListModal {...modal} isCloseBtn />
        {children}
      </ConnectModalProvider>
    </CosmeWalletProvider>
  ) : (
    <></>
  )
}
export default WalletConnectProvider

// Re-export hooks from CosmeWalletProvider
export { useWallet, useLCD, useLCDClient }
