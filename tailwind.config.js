const plugin = require("tailwindcss/plugin");

/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: [
        "./app/**/*.{js,ts,jsx,tsx,mdx}", // Note the addition of the `app` directory.
        "./pages/**/*.{js,ts,jsx,tsx,mdx}",
        "./@/components/**/*.{js,ts,jsx,tsx,mdx}",
        "./components/**/*.{js,ts,jsx,tsx,mdx}",
        "./app.config/**/*.{js,ts,jsx,tsx,mdx}",
        "./config/**/*.{js,ts,jsx,tsx,mdx}",

        // Or if using `src` directory:
        "./src/**/*.{js,ts,jsx,tsx,mdx}",
    ],
    prefix: "",
    theme: {
        container: {
            center: true,
            padding: "2rem",
            screens: {
                "2xl": "1400px",
            },
        },
        extend: {
            fontFamily: {
                sans: [
                    "var(--font-inter)",
                    "Inter",
                    "system-ui",
                    "-apple-system",
                    "Segoe UI",
                    "Roboto",
                    "Helvetica Neue",
                    "Arial",
                    "sans-serif",
                ],
            },
            letterSpacing: {
                tighter: "-0.02em",
                tight: "-0.015em",
                normal: "-0.011em",
                wide: "0.01em",
            },
            lineHeight: {
                relaxed: "1.65",
                loose: "1.75",
            },
            keyframes: {
                "accordion-down": {
                    from: { height: "0" },
                    to: { height: "var(--radix-accordion-content-height)" },
                },
                "accordion-up": {
                    from: { height: "var(--radix-accordion-content-height)" },
                    to: { height: "0" },
                },
                "fade-in": {
                    "0%": { opacity: "0" },
                    "100%": { opacity: "1" },
                },
                shimmer: {
                    "0%": {
                        backgroundPosition: "200% 0",
                    },
                    "100%": {
                        backgroundPosition: "0% 0",
                    },
                },
                "scroll-text": {
                    "0%, 100%": {
                        transform: "translateX(0)",
                    },
                    "50%": {
                        transform: "translateX(var(--scroll-distance, -50px))",
                    },
                },
                // Login page animations
                float: {
                    "0%, 100%": {
                        transform: "translateY(0)",
                    },
                    "50%": {
                        transform: "translateY(-8px)",
                    },
                },
                "pulse-slow": {
                    "0%, 100%": {
                        opacity: "0.2",
                    },
                    "50%": {
                        opacity: "0.4",
                    },
                },
                "pulse-slower": {
                    "0%, 100%": {
                        opacity: "0.3",
                    },
                    "50%": {
                        opacity: "0.15",
                    },
                },
                "ping-slow": {
                    "0%": {
                        transform: "scale(1)",
                        opacity: "0.6",
                    },
                    "75%, 100%": {
                        transform: "scale(2)",
                        opacity: "0",
                    },
                },
                "ping-slower": {
                    "0%": {
                        transform: "scale(1)",
                        opacity: "0.5",
                    },
                    "75%, 100%": {
                        transform: "scale(2.5)",
                        opacity: "0",
                    },
                },
                "fade-up": {
                    "0%": {
                        opacity: "0",
                        transform: "translateY(20px)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "translateY(0)",
                    },
                },
                "fade-in-scale": {
                    "0%": {
                        opacity: "0",
                        transform: "scale(0.95)",
                    },
                    "100%": {
                        opacity: "1",
                        transform: "scale(1)",
                    },
                },
                "grid-pulse": {
                    "0%, 100%": {
                        opacity: "0.03",
                    },
                    "50%": {
                        opacity: "0.06",
                    },
                },
                "particle-float": {
                    "0%, 100%": {
                        transform: "translateY(0) translateX(0)",
                        opacity: "0",
                    },
                    "10%": {
                        opacity: "0.8",
                    },
                    "90%": {
                        opacity: "0.8",
                    },
                    "100%": {
                        transform: "translateY(-100vh) translateX(20px)",
                        opacity: "0",
                    },
                },
                "shake-gentle": {
                    "0%, 100%": {
                        transform: "translateX(0)",
                    },
                    "25%": {
                        transform: "translateX(-4px)",
                    },
                    "75%": {
                        transform: "translateX(4px)",
                    },
                },
            },
            animation: {
                "accordion-down": "accordion-down 0.2s ease-out",
                "accordion-up": "accordion-up 0.2s ease-out",
                "fade-in": "fade-in 0.3s ease-in-out",
                shimmer: "shimmer 3s infinite linear",
                "scroll-text": "scroll-text 6s ease-in-out infinite 1s",
                // Login page animations
                float: "float 6s ease-in-out infinite",
                "pulse-slow": "pulse-slow 4s ease-in-out infinite",
                "pulse-slower": "pulse-slower 6s ease-in-out infinite",
                "ping-slow": "ping-slow 3s cubic-bezier(0, 0, 0.2, 1) infinite",
                "ping-slower": "ping-slower 4s cubic-bezier(0, 0, 0.2, 1) infinite",
                "fade-up": "fade-up 0.8s ease-out forwards",
                "fade-in-scale": "fade-in-scale 0.5s ease-out forwards",
                "grid-pulse": "grid-pulse 8s ease-in-out infinite",
                "particle-float": "particle-float 15s linear infinite",
                "shake-gentle": "shake-gentle 0.5s ease-in-out",
            },
        },
    },
    plugins: [
        require("tailwindcss-animate"),
        require("@tailwindcss/forms"),
        require("tailwind-scrollbar"),
        require("tailwind-typography"),
        plugin(function ({ addVariant, e }) {
            addVariant("rtl", ({ modifySelectors, separator }) => {
                modifySelectors(({ className }) => {
                    return `html[dir="ltr"] .${e(`rtl${separator}${className}`)}, div[dir="ltr"] .${e(`rtl${separator}${className}`)}`;
                });
            });
        }),
    ],
};
