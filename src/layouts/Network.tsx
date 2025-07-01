import React, { PropsWithChildren, useEffect } from "react"
import { ApolloProvider, ApolloClient, InMemoryCache } from "@apollo/client"
import { DefaultOptions } from "@apollo/client"
import useNetwork from "hooks/useNetwork"
import { useModal } from "components/Modal"
import UnsupportedNetworkModal from "components/UnsupportedNetworkModal"
import { AVAILABLE_CHAIN_ID } from "constants/networks"
import { useWallet } from "libs/CosmesWalletProvider"
import useConnectedWallet from "hooks/useConnectedWallet"

export const DefaultApolloClientOptions: DefaultOptions = {
  watchQuery: { notifyOnNetworkStatusChange: true },
  query: { errorPolicy: "all" },
}

const Network: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const { status } = useWallet()
  const network = useNetwork()
  const connectedWallet = useConnectedWallet()
  const unsupportedNetworkModal = useModal()
  const client = new ApolloClient({
    uri: network.mantle,
    cache: new InMemoryCache(),
    connectToDevTools: true,
    defaultOptions: DefaultApolloClientOptions,
  })

  useEffect(() => {
    const timerId = setTimeout(() => {
      if (
        network &&
        status === "connected" &&
        connectedWallet &&
        !AVAILABLE_CHAIN_ID.includes(network?.chainID)
      ) {
        unsupportedNetworkModal.open()
      }
    }, 10)

    return () => {
      clearTimeout(timerId)
    }
  }, [unsupportedNetworkModal, network, connectedWallet, status])

  return (
    <>
      <ApolloProvider client={client}>
        {!unsupportedNetworkModal.isOpen && children}
      </ApolloProvider>
      <UnsupportedNetworkModal isOpen={unsupportedNetworkModal.isOpen} />
    </>
  )
}

export default Network
