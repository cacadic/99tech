import { SwapForm } from "@/widgets/SwapForm";
import { SwitchTheme } from "@/widgets/SwitchTheme";
import { WalletDetail } from "@/widgets/WalletDetail";

const HomePage = () => {
    return (
        <div className="w-full h-screen bg-[url('/images/background.jpg')] light:bg-[url('/images/background-light.jpg')] bg-no-repeat bg-cover flex items-center relative">
            <nav className="absolute top-0 left-0 w-full flex justify-end items-center p-4 gap-x-2">
                <SwitchTheme />
                <WalletDetail />
            </nav>
            <SwapForm />
        </div>
    );
};

export default HomePage;