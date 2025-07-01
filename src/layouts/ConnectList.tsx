import { ReactNode } from "react"
import styles from "./ConnectList.module.scss"
import { useConnectModal } from "hooks"
import SupportModal from "./SupportModal"
import { useModal } from "components/Modal"
import classNames from "classnames"
import { useWallet, WalletLabel } from "libs/CosmesWalletProvider"
import { isMobile, WalletType } from "@goblinhunt/cosmes/wallet"

declare global {
  interface Window {
    xfi: {
      terra: any
    }
  }
}

const size = { width: 30, height: "auto" }
type Button = {
  label: string
  image: ReactNode
  type: WalletType
  onClick: () => void
  isInstalled?: boolean
}

const ConnectList = () => {
  const { connect, installedWallets, installableWallets } = useWallet()
  const connectModal = useConnectModal()
  const supportModal = useModal()
  const walletTypes: WalletType[] = isMobile()
    ? [WalletType.WALLETCONNECT]
    : [WalletType.EXTENSION, WalletType.WALLETCONNECT]

  const buttons: Button[] = []
  for (const walletType of walletTypes) {
    buttons.push(
      ...installedWallets.map((walletName) => ({
        label: WalletLabel[walletName],
        image: (
          <img
            src={"/wallet-icons/" + walletName + ".png"}
            {...size}
            alt={walletName}
          />
        ),
        type: walletType,
        isInstalled: true,
        onClick: () => {
          connect(walletName, walletType)
          connectModal.close()
        },
      })),
      ...installableWallets.map((walletName) => ({
        label: "Install " + WalletLabel[walletName],
        image: (
          <img
            src={"/wallet-icons/" + walletName + ".png"}
            {...size}
            alt={walletName}
          />
        ),
        type: walletType,
        ...(walletType === WalletType.WALLETCONNECT
          ? {
              isInstalled: true,
              onClick: () => {
                connect(walletName, walletType)
                connectModal.close()
              },
            }
          : {
              onClick: () => {
                supportModal.setInfo(
                  "/wallet-icons/" + walletName + ".png",
                  walletName
                )
                supportModal.open()
              },
            }),
      }))
    )
  }

  return (
    <article className={styles.component}>
      <SupportModal {...supportModal} />
      <section>
        {Object.entries(buttons).map(
          ([key, { label, image, isInstalled, type, onClick }]) => (
            <button
              className={classNames(
                styles.button,
                isInstalled && styles["button--installed"]
              )}
              onClick={onClick}
              key={key}
            >
              {image}
              &nbsp;&nbsp;
              {label}
              {type === WalletType.WALLETCONNECT && (
                <img
                  src={"/wallet-icons/walletconnect.png"}
                  {...size}
                  alt="walletconnect"
                />
              )}
            </button>
          )
        )}
      </section>
    </article>
  )
}

export default ConnectList
