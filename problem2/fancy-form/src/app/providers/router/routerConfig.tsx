import type { RouteProps } from "react-router";
import { HomePage } from "@/pages/Home";
import { AppRoutes, routePaths } from "@/shared/config";

export const routeConfig: RouteProps[] = [
  {
    path: routePaths[AppRoutes.HOME],
    element: <HomePage />,
  },
];
