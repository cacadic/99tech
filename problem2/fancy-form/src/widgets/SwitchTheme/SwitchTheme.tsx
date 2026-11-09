import { LucideMoon, LucideSun } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/shared/components/ui/button";
import { currentLanguage } from "@/shared/config/i18n/i18n";
import { applyTheme, getInitialTheme, storeTheme, type Theme } from "@/shared/lib/theme";
import { cn } from "@/shared/lib/utils";

const SwitchTheme = () => {
  const { t, i18n } = useTranslation();
  const [theme, setTheme] = useState<Theme>(getInitialTheme);

  const language = currentLanguage();
  const otherLanguage = language === "en" ? "vi" : "en";

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  const chooseTheme = (next: Theme): void => {
    setTheme(next);
    storeTheme(next);
  };

  return (
    <div
      role="group"
      aria-label={t("theme_group")}
      className="flex h-10 items-center rounded-md border-2 border-blue-200 bg-blue-500"
    >
      <Button
        variant="ghost"
        className="text-white"
        aria-label={t("switch_language", {
          current: language.toUpperCase(),
          language: t(`language_name_${otherLanguage}`),
        })}
        onClick={() => void i18n.changeLanguage(otherLanguage)}
      >
        {language.toUpperCase()}
      </Button>
      <Button
        variant="ghost"
        aria-label={t("theme_light")}
        aria-pressed={theme === "light"}
        className={cn({ "bg-blue-base": theme === "light" })}
        onClick={() => {
          chooseTheme("light");
        }}
      >
        <LucideSun className="text-white" aria-hidden="true" />
      </Button>
      <Button
        variant="ghost"
        aria-label={t("theme_dark")}
        aria-pressed={theme === "dark"}
        className={cn({ "bg-blue-base": theme === "dark" })}
        onClick={() => {
          chooseTheme("dark");
        }}
      >
        <LucideMoon className="text-white" aria-hidden="true" />
      </Button>
    </div>
  );
};

export default SwitchTheme;
