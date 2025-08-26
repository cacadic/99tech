import { Button } from "@/shared/components/ui/button";
import { cn } from "@/shared/lib/utils";
import { LucideMoon, LucideSun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

type Theme = "light" | "dark";

const STORAGE_KEY = "theme";

const SwitchTheme = () => {
    const [theme, setTheme] = useState<Theme>(() => {
        if (typeof window === "undefined") return "light";
        const stored = localStorage.getItem(STORAGE_KEY) as Theme | null;
        const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
        return stored ?? (systemDark ? "dark" : "light");
    });

    const { i18n } = useTranslation();

    const changeLanguage = () => {
        i18n.changeLanguage(i18n.language === "en" ? "vn" : "en");
    };

    useEffect(() => {
        if (typeof window === "undefined") return;

        document.documentElement.classList.remove("light", "dark");
        document.documentElement.classList.add(theme);

        localStorage.setItem(STORAGE_KEY, theme);
    }, [theme]);

    return (
        <div className="bg-blue-500 border-blue-200 border-2 rounded-md flex items-center h-10">
            <Button variant="ghost" className="text-white uppercase" onClick={changeLanguage}>
                {i18n.language}
            </Button>
            <Button
                variant="ghost"
                className={cn({
                    "bg-blue-base": theme === "light",
                })}
                onClick={() => setTheme("light")}
            >
                <LucideSun className="text-white" />
            </Button>
            <Button
                variant="ghost"
                className={cn({
                    "bg-blue-base": theme === "dark",
                })}
                onClick={() => setTheme("dark")}>
                <LucideMoon className="text-white" />
            </Button>
        </div>
    );
};

export default SwitchTheme;