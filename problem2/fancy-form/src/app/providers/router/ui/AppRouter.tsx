import { Route, Routes } from "react-router";
import { routeConfig } from "../routerConfig";
import { Suspense } from "react";
import { LoadingScreen } from "@/widgets/LoadingScreen";

const AppRouter = () => {
    return (
        <Routes>
            {routeConfig.map(({ path, element }) => (
                <Route key={path} path={path} element={<Suspense key={path} fallback={<LoadingScreen />}>{element}</Suspense>} />
            ))}
        </Routes>
    );
};

export default AppRouter;