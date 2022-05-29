import { PropsWithChildren } from "react"
import { useWallet, WalletStatus } from "@terra-money/wallet-provider"
import { DefaultOptions } from "@apollo/client"
import Loading from "components/Loading"

export const DefaultApolloClientOptions: DefaultOptions = {
  watchQuery: { notifyOnNetworkStatusChange: true },
  query: { errorPolicy: "all" },
}

const Network: React.FC<PropsWithChildren<{}>> = ({ children }) => {
  const { status } = useWallet()

  return (
    <>
      {status === WalletStatus.INITIALIZING ? (
        <div
          style={{
            width: "100vw",
            height: "100vh",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Loading />
        </div>
      ) : (
        children
      )}
    </>
  )
}

export default Network
