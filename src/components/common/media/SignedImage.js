"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useSignedFileUrl } from "../../../hooks/useSignedFileUrl";

const SignedImage = React.forwardRef(function SignedImage(
    {
        src = null,
        blobPath = null,
        onError,
        fallback = null,
        alt = "",
        ...props
    },
    ref,
) {
    const { url, refreshOnError } = useSignedFileUrl({
        url: src,
        blobPath,
    });
    const [hasFailed, setHasFailed] = useState(false);

    useEffect(() => {
        setHasFailed(false);
    }, [src, blobPath]);

    const handleError = useCallback(
        async (event) => {
            const refreshedUrl = await refreshOnError();
            if (!refreshedUrl) {
                setHasFailed(true);
                onError?.(event);
            }
        },
        [onError, refreshOnError],
    );

    if (hasFailed && fallback) {
        return fallback;
    }

    return (
        <img
            ref={ref}
            src={url || src || undefined}
            alt={alt}
            onError={handleError}
            {...props}
        />
    );
});

export default SignedImage;
