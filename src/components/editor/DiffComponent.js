import { useCallback } from "react";
import Diff from "./Diff";

const DiffComponent = ({
    inputText,
    outputText,
    setSelectedText,
    type = "default",
}) => {
    const setSelectedTextCallback = useCallback(
        (text) => {
            setSelectedText(text);
        },
        [setSelectedText],
    );

    // Normalize quotes
    inputText = inputText.replace(/"|"|'|'/g, (match) =>
        match === "'" || match === "'" ? "'" : '"',
    );

    return (
        <Diff
            string1={inputText}
            string2={outputText}
            setSelectedText={setSelectedTextCallback}
        />
    );
};

export default DiffComponent;
