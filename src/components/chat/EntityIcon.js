import React from "react";

// Accept an optional size prop (defaults to 'small' if not provided)
const EntityIcon = ({ entity, size = "sm" }) => {
    // Size classes mapping
    const sizeClasses =
        {
            "2xl": "w-16 h-16",
            xl: "w-12 h-12",
            lg: "w-8 h-8",
            md: "w-6 h-6",
            sm: "w-5 h-5",
            xs: "w-4 h-4",
        }[size] || "w-5 h-5"; // Default to sm classes if invalid size

    // Text size classes for emoji/letter fallback
    const textSizeClasses =
        {
            "2xl": "text-4xl",
            xl: "text-3xl",
            lg: "text-xl",
            md: "text-lg",
            sm: "text-lg",
            xs: "text-sm",
        }[size] || "text-lg";

    // Check for avatar image first
    if (entity?.avatar?.image?.url) {
        return (
            <img
                src={entity.avatar.image.url}
                alt={entity?.name || "Entity"}
                className={`${sizeClasses} rounded-full object-cover`}
            />
        );
    }

    // Check for avatar text (emoji)
    if (entity?.avatar?.text) {
        return (
            <div
                className={`flex items-center justify-center ${sizeClasses} ${textSizeClasses}`}
            >
                {entity.avatar.text}
            </div>
        );
    }

    // Fallback: Get the first letter of the entity name
    const letter = entity?.name ? entity.name[0].toUpperCase() : "?";

    // Default colors if not provided
    const bgColorClass = entity?.bgColorClass || "bg-sky-500";
    const textColorClass = entity?.textColorClass || "text-white";

    return (
        <div
            className={`flex items-center justify-center font-bold ${sizeClasses} ${textSizeClasses} ${bgColorClass} rounded-full ${textColorClass}`}
        >
            {letter}
        </div>
    );
};

export default EntityIcon;
