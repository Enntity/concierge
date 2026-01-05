import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import config from "../config";
import App from "../src/App";
import Providers from "./providers";
import classNames from "./utils/class-names";
import {
    HydrationBoundary,
    QueryClient,
    dehydrate,
} from "@tanstack/react-query";
import { headers } from "next/headers";

const font = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-inter",
    weight: ["300", "400", "500", "600", "700"],
    adjustFontFallback: true,
    preload: true,
});
const neuralspaceEnabled = process.env.ENABLE_NEURALSPACE === "true";

export default async function RootLayout({ children }) {
    const { getLogo } = config.global;

    const host = headers().get("x-forwarded-host");
    const protocol = headers().get("x-forwarded-proto");
    const serverUrl = `${protocol}://${host}`;
    const useBlueGraphQL = !!process.env.CORTEX_GRAPHQL_API_BLUE_URL;
    const graphQLPublicEndpoint = config.global.getPublicGraphQLEndpoint(
        process.env.CORTEX_GRAPHQL_API_URL || "http://localhost:4000/graphql",
    );

    const cookieStore = cookies();
    const language = cookieStore.get("i18next")?.value || "en";
    const theme = cookieStore.get("theme")?.value || "light";

    // QueryClient for hydration - user data is fetched client-side
    // to ensure apps are properly populated via /api/users/me
    const queryClient = new QueryClient();

    return (
        <html lang={language} dir={language === "ar" ? "rtl" : "ltr"}>
            <head>
                <link
                    rel="stylesheet"
                    href="https://fonts.googleapis.com/css?family=Playfair Display"
                />
                <link rel="icon" type="image/png" href={theme === "dark" ? "/app/assets/logo_dark.png" : getLogo(language)} />
            </head>
            <body
                id="labeeb-root"
                className={classNames(theme, font.className, font.variable)}
            >
                <Providers>
                    <HydrationBoundary state={dehydrate(queryClient)}>
                        <App
                            theme={theme}
                            language={language}
                            serverUrl={serverUrl}
                            graphQLPublicEndpoint={graphQLPublicEndpoint}
                            neuralspaceEnabled={neuralspaceEnabled}
                            useBlueGraphQL={useBlueGraphQL}
                        >
                            {children}
                        </App>
                    </HydrationBoundary>
                </Providers>
            </body>
        </html>
    );
}
