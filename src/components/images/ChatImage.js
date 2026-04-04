"use client";

import React from "react";
import SignedImage from "../common/media/SignedImage";

const ChatImage = React.memo(
    function ChatImage({
        src,
        blobPath = null,
        alt = "",
        className = "min-w-[240px] max-w-[80%] [.docked_&]:max-w-[90%] rounded my-2 shadow-lg dark:shadow-black/30",
        style = {},
        onLoad,
        onError,
        ...props
    }) {
        return (
            <SignedImage
                src={src}
                blobPath={blobPath}
                alt={alt}
                className={className}
                style={{
                    backgroundColor: "transparent",
                    border: "none",
                    outline: "none",
                    ...style,
                }}
                onLoad={onLoad}
                onError={onError}
                {...props}
            />
        );
    },
    (prevProps, nextProps) => {
        // Only re-render if src or alt changes
        return (
            prevProps.src === nextProps.src && prevProps.alt === nextProps.alt
        );
    },
);

export default ChatImage;
