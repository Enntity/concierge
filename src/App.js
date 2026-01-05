"use client";
import { ApolloNextAppProvider } from "@apollo/experimental-nextjs-app-support";
import React, { useContext, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { getClient } from "./graphql";
import "./i18n";

import * as amplitude from "@amplitude/analytics-browser";
import { useDebounce } from "@uidotdev/usehooks";
import dayjs from "dayjs";
import i18next from "i18next";
import {
    useCurrentUser,
    useUpdateUserState,
    useUserState,
} from "../app/queries/users";
import classNames from "../app/utils/class-names";
import "./App.scss";
import StoreProvider from "./StoreProvider";
import { LanguageContext, LanguageProvider } from "./contexts/LanguageProvider";
import { ThemeProvider } from "./contexts/ThemeProvider";
import { AutoTranscribeProvider } from "./contexts/AutoTranscribeContext";
import Layout from "./layout/Layout";
import "./tailwind.css";

// Routes that don't require authentication
const PUBLIC_ROUTES = ["/auth/login", "/privacy", "/published"];

const NEXT_PUBLIC_AMPLITUDE_API_KEY = process.env.NEXT_PUBLIC_AMPLITUDE_API_KEY;

// Only initialize Amplitude if API key is present and not in test environment
if (
    typeof document !== "undefined" &&
    process.env.NODE_ENV !== "test" &&
    NEXT_PUBLIC_AMPLITUDE_API_KEY
) {
    try {
        amplitude.init(NEXT_PUBLIC_AMPLITUDE_API_KEY, {
            defaultTracking: true,
            logLevel: amplitude.Types.LogLevel.Warn,
        });
    } catch (error) {
        console.error("Failed to initialize Amplitude:", error);
    }
}

export const AuthContext = React.createContext({});

const STATE_DEBOUNCE_TIME = 1000;

const App = ({
    children,
    language,
    theme,
    serverUrl,
    graphQLPublicEndpoint,
    neuralspaceEnabled,
    useBlueGraphQL,
}) => {
    const pathname = usePathname();
    const isPublicRoute = PUBLIC_ROUTES.some((route) => pathname?.startsWith(route));
    
    // Only fetch user data for authenticated routes
    const { data: currentUser } = useCurrentUser();
    const { data: serverUserState, refetch: refetchServerUserState } =
        useUserState();
    const updateUserState = useUpdateUserState();

    const [userState, setUserState] = useState(null);
    const debouncedUserState = useDebounce(userState, STATE_DEBOUNCE_TIME);
    const refetchCalledRef = useRef(false);

    const refetchUserState = () => {
        refetchCalledRef.current = true;
        refetchServerUserState();
    };

    useEffect(() => {
        // set user state from server if it exists, but only if there's no client
        // state yet
        if (
            (!userState || refetchCalledRef.current) &&
            serverUserState !== undefined &&
            JSON.stringify(serverUserState) !== JSON.stringify(userState)
        ) {
            setUserState(serverUserState);
            refetchCalledRef.current = false;
        }
    }, [userState, serverUserState]);

    useEffect(() => {
        if (i18next.language !== language) {
            i18next.changeLanguage(language);
        }
        dayjs.locale(language);
    }, [language]);

    useEffect(() => {
        updateUserState.mutate(debouncedUserState);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [debouncedUserState]);

    // For public routes, render children directly without requiring auth
    if (isPublicRoute) {
        return children;
    }

    if (!currentUser) {
        return null;
    }

    const debouncedUpdateUserState = (value) => {
        if (typeof value === "function") {
            setUserState((prev) => {
                return {
                    ...prev,
                    ...value(prev),
                };
            });
        } else {
            setUserState((prev) => ({
                ...prev,
                ...value,
            }));
        }
    };

    return (
        <ApolloNextAppProvider
            makeClient={() => getClient(serverUrl, useBlueGraphQL)}
        >
            <ServerContext.Provider
                value={{ graphQLPublicEndpoint, serverUrl, neuralspaceEnabled }}
            >
                <StoreProvider>
                    <AutoTranscribeProvider>
                        <React.StrictMode>
                            <AuthContext.Provider
                                value={{
                                    user: currentUser,
                                    userState,
                                    refetchUserState,
                                    debouncedUpdateUserState,
                                }}
                            >
                                <ThemeProvider savedTheme={theme}>
                                    <LanguageProvider savedLanguage={language}>
                                        <Layout>
                                            <Body>{children}</Body>
                                        </Layout>
                                    </LanguageProvider>
                                </ThemeProvider>
                            </AuthContext.Provider>
                        </React.StrictMode>
                    </AutoTranscribeProvider>
                </StoreProvider>
            </ServerContext.Provider>
        </ApolloNextAppProvider>
    );
};

const Body = ({ children, tosTimestamp }) => {
    const containerStyles = {};
    const { language } = useContext(LanguageContext);

    return (
        <div
            dir={language === "ar" ? "rtl" : "ltr"}
            className={classNames("h-full")}
            style={containerStyles}
        >
            {children}
        </div>
    );
};

export const ServerContext = React.createContext({});

export default App;
