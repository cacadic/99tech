import { SwapForm } from "@/widgets/SwapForm";
import { SwitchTheme } from "@/widgets/SwitchTheme";
import { WalletDetail } from "@/widgets/WalletDetail";

const HomePage = () => {
  return (
    <div className="relative flex min-h-dvh w-full items-center bg-[url('/images/background.jpg')] bg-cover bg-no-repeat py-24 light:bg-[url('/images/background-light.jpg')]">
      <header className="absolute left-0 top-0 flex w-full items-center justify-end gap-x-2 p-4">
        <SwitchTheme />
        <WalletDetail />
      </header>
      <main className="w-full">
        <SwapForm />
      </main>
    </div>
  );
};

export default HomePage;
